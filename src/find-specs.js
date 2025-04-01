#!/usr/bin/env node
'use strict';

/**
 * The find-specs script checks a number of spec sources to report new specs
 * that may be worth including in browser-specs.
 *
 * Command usage:
 * node src/find-specs.js --help
 *
 * Sources include WHATWG's database, TC39 proposals, and all known
 * repositories that W3C tracks in the w3c/validate-repos project.
 *
 * To avoid reporting specs more than once, the script looks at issues already
 * raised in w3c/browser-specs before it proposes a new one. The script won't
 * propose a spec whose URL or repository already appears in:
 * - open issues with a "new spec" label
 * - closed issues with an "ignore" label.
 *
 * Various functions take or produce a spec entry object. That's an object with
 * the following properties:
 * - `repo`: the name of the GitHub repository that contains the spec, owner
 * included. For example: "w3c/wot"
 * - `spec`: The URL of the spec. That URL is the /TR URL when one exists
 * (and when we manage to associate the repository with a /TR URL), the GitHub
 * homepage URL when one is defined, or a github.io URL derived from the name
 * of the repository.
 * - `nightly` (optional): The URL of the Editor's Draft when a /TR URL is
 * found. This allows to report specs in browser-specs whose canonical URL
 * needs to change because the underlying spec got published as FPWD.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import puppeteer from "puppeteer";

import computeShortname from "./compute-shortname.js";
import loadJSON from "./load-json.js";
import fetchJSON from "./fetch-json.js";
import sendGraphQLQuery from "./graphql.js";
import Octokit from "./octokit.js";
import splitIssueBodyIntoSections from "./split-issue-body.js";
import ThrottledQueue from "./throttled-queue.js";

import specs from "../index.json" with { type: "json" };
import packageContents from "../package.json" with { type: "json" };
import multiRepos from "./data/multispecs-repos.json" with { type: "json" };
const { version } = packageContents;

const config = await loadJSON("config.json");
const githubToken = config?.GITHUB_TOKEN ?? process.env.GITHUB_TOKEN;

const scriptPath = path.dirname(fileURLToPath(import.meta.url));
const execParams = { cwd: path.join(scriptPath, '..') };


/**
 * The list of specs that are already known is derived from open and closed
 * issues in the browser-specs repository.
 */
const BROWSER_SPECS_REPO = {
  owner: "w3c",
  name: "browser-specs"
};


/**
 * Although the scope of the browser-specs list keeps expanding, the focus
 * remains on specs that are more directly relevant to web browsers and that
 * have some traction within implementers. As such, we're going to ignore specs
 * from most Community Groups when we loop for new specs. The list below
 * hardcodes Community Groups that are being watched for new specs.
 */
const watchedCGs = [
  "Web Platform Incubator Community Group",
  "Web Assembly Community Group",
  "Immersive Web Community Group",
  "Audio Community Group",
  "Privacy Community Group",
  "GPU for the Web Community Group"
];


/**
 * A few helper functions
 */
const trimSlash = url => url.endsWith('/') ? url.slice(0, -1) : url;
const matchRepoName = fullName => r => fullName === r.owner.login + '/' + r.name;
const eitherFilter = (...filters) => value => filters.some(filter => filter(value));
const hasRepoType = type => r =>
  r.w3c && r.w3c["repo-type"] &&
  (r.w3c["repo-type"] === type || r.w3c["repo-type"].includes(type));



/**
 * Canonicalize a spec URL that appears in a GitHub repository
 *
 * The function takes an object that describes a GitHub repository as input,
 * typically one returned by the w3c/validate-repos project. It returns a
 * spec entry object.
 */
function canonicalizeGhUrl(repository) {
  // GitHub supports is OK with trailing spaces and with omitting the scheme
  // in the homepage URL. We're not.
  let actualUrl = repository.homepageUrl.trim();
  actualUrl = !actualUrl.match(/^https?:\/\//i) ?
    "https://" + actualUrl :
    actualUrl;
  const url = new URL(actualUrl);
  url.protocol = "https:";

  // Exceptionally, the homepage URL may link to the explainer instead of to
  // the spec. One example at the time of writing is Storage Buckets:
  // https://github.com/WICG/storage-buckets which targets:
  // https://wicg.github.io/storage-buckets/explainer
  url.pathname = url.pathname.replace(/(\/explainer(\.[^\/]+|\/)?)$/, "/");
  if (url.pathname.lastIndexOf("/") === 0 && url.pathname.length > 1) {
      url.pathname += "/";
  }

  // Exceptionally, the homepage URL may link to a fragment within a spec. One
  // example at the time of writing is Close Watcher to redirect to the HTML
  // spec: https://github.com/WICG/close-watcher
  if (url.hash) {
    url.hash = '';
  }

  // Exceptionally, the homepage URL may link to a /TR URL and end with
  // "upcoming" to target the upcoming version. One example at the time of
  // writing is DID:
  // https://github.com/w3c/did which targets:
  // https://www.w3.org/TR/did/upcoming
  url.pathname = url.pathname.replace(/\/upcoming\/?$/i, "/");

  return {
    repo: repository.owner.login + "/" + repository.name,
    spec: url.toString()
  };
}


/**
 * Convert a GitHub repository object that does not specify a homepage URL to a
 * spec entry object. The URL of the spec is a github.io URL derived from the
 * repository name (it may not exist!).
 */
function toGhUrl(repo) {
  return {
    repo: `${repo.owner.login}/${repo.name}`,
    spec: `https://${repo.owner.login.toLowerCase()}.github.io/${repo.name}/`
  };
}


/**
 * Return true if the given spec entry in browser-specs is a more recent level
 * for the URL being considered.
 *
 * Set the loose parameter to make the check loose (for CSS and Houdini drafts
 * that mix specs with versions and specs without).
 */
function hasMoreRecentLevel(s, url, loose) {
  try {
    const shortnameData = computeShortname(url);
    return s.series.shortname === shortnameData.series.shortname &&
      (s.seriesVersion > (shortnameData.seriesVersion ?? '') ||
        loose && (s.seriesVersion === shortnameData.seriesVersion ||
          // case of CSS drafts whose known editors drafts are version-less, but the directories in the repo use versions
          !s.seriesVersion ||
          // Case of houdini drafts whose known editors drafts are versioned, but the directories in the repo use version-less
          (!shortnameData.seriesVersion && s.seriesVersion == 1)
        )
      );
  }
  catch (e) {
    return false;
  }
}


/**
 * Return true if the given spec entry object does not match any existing entry
 * in browser-specs.
 */
function hasUntrackedURL({spec: url}) {
  // Compare URLs case-insentively as we sometimes end up with different
  // casing (and difference is usually not significant)
  const lurl = trimSlash(url.toLowerCase());
  return !specs.find(s =>
      s.nightly?.url?.toLowerCase()?.startsWith(lurl) ||
      (s.release && trimSlash(s.release.url.toLowerCase()) === lurl) ||
      (s.nightly?.pages?.find(u => trimSlash(u.toLowerCase()) === lurl))
    ) &&
    !specs.find(s => hasMoreRecentLevel(s, url,
      // CSS specs have editors draft with and without levels,
      // we look loosely for more recent levels when checking with ED URLs
      url.match(/\/drafts\./) && !url.match(/\/w3\.org/)
    ));
}


/**
 * Take the contents of the repo-map.json file within the w3c/spec-dashboard
 * project and the list of groups from the w3c/validate-repos project as input,
 * and return a function that takes a spec entry object, updates the spec's URL
 * in place if needed and returns that object.
 */
function toReleaseUrl(repo2Release, groups) {
  return function (entry) {
    // Note "single spec" repositories may still contain more than one
    // published specs, either because the repository also contains a Note
    // (such as a use cases and requirements document) that we're less
    // interested in, or because the spec got published by more than one
    // group over time.
    const mapping = (repo2Release[entry.repo] ?? [])
      .filter(spec =>
        spec.recTrack &&
        groups[spec.group]?.repos.find(r => r.fullName === entry.repo)
      );
    if (mapping.length > 0) {
      // Save the ED URL so that we can detect the case when a spec that was
      // already in browser-specs gets published as FPWD (in such cases, the
      // canonical URL for that spec in browser-specs needs to change)
      entry.nightly = entry.spec;
      entry.spec = mapping[0].url;
    }
    return entry;
  }
}


/**
 * ECMA proposals are stored in Markdown pages on GitHub. We only watch stage 3
 * proposals, which are in the first table on the page.
 *
 * WebAssembly proposals follow the exact same pattern.
 *
 * The function returns a list of specs, described as an object with a "spec"
 * and a "repo" property.
 *
 * Note: GitHub wraps tables in <markdown-accessibility-table> elements and
 * headings in a <div class="markdown-heading"> element
 */
async function fetchStage3Proposals() {
  const extractEcmaStage3Proposals = _ =>
    [...document.querySelector("table").querySelectorAll("tr td:first-child a")]
      .map(a => a.href.split('#')[0])
      .map(url => url
        .replace("https://github.com/tc39/", "https://tc39.es/")
        .replace("https://github.com/tc39-transfer/", "https://tc39.es/") + '/');

  const proposalsPages = [
    {
      url: "https://github.com/tc39/proposals/blob/main/README.md",
      extract: extractEcmaStage3Proposals
    },
    {
      url: "https://github.com/tc39/proposals/blob/main/ecma402/README.md",
      extract: extractEcmaStage3Proposals
    },
    {
      url: "https://github.com/WebAssembly/proposals/blob/main/README.md",
      extract: _ => [...document.querySelectorAll("table")]
        .filter(table => table.parentElement.previousElementSibling.querySelector('h3')?.textContent?.match(/Phase (3|4|5)/))
        .map(table => [...table.querySelectorAll("tr td:first-child a")].map(a => a.href.split('#')[0]))
        .flat()
        .map(url => url.replace(
          /^https:\/\/github.com\/WebAssembly\/([^/]+)/i,
          "https://webassembly.github.io/$1/"))
    }
  ];

  const allProposals = [];
  const browser = await puppeteer.launch();
  try {
    for (const proposalsPage of proposalsPages) {
      const page = await browser.newPage();
      await page.goto(proposalsPage.url);
      const proposals = await page.evaluate(proposalsPage.extract)
      allProposals.push(...proposals);
    }
  }
  finally {
    await browser.close();
  }

  return allProposals.map(spec => Object.assign({
    spec,
    repo: spec.replace("https://github.com/", ""),
  }));
}


/**
 * Some repositories contain more than one specs. Let's retrieve the list of
 * specs they contain.
 *
 * For W3C specs, we will try to find the /TR URL of the spec if it exists.
 * We're going to use the w3c/spec-dashboard project as done for fetchW3CSpecs
 * but, by definition, there will be multiple specs to choose from. We'll match
 * on the spec's shortname, but note the ED shortname does not always match the
 * /TR shortname, so we may fail to associate the spec with its /TR URL.
 *
 * Note: some of the specs will probably not exist per se, the function merely
 * looks at the folder names (excluding those that are known not to contain
 * anything) and assumes that there's a spec under each of them.
 */
async function fetchMultiReposSpecs() {
  const { groups } = await fetchJSON(
    "https://w3c.github.io/validate-repos/report.json"
  );
  const repo2Release = await fetchJSON(
    "https://w3c.github.io/spec-dashboard/repo-map.json"
  );

  const octokit = new Octokit({ auth: githubToken });

  const allSpecs = [];
  for (const [reponame, desc] of Object.entries(multiRepos)) {
    const { data } = await octokit.git.getTree({
      owner: reponame.split("/")[0],
      repo: reponame.split("/")[1],
      tree_sha: "HEAD",
      recursive: true
    });
    const specs = data.tree
      .filter(entry =>
        entry.type === "tree" &&
        ((!desc.path && entry.path.indexOf("/") === -1) ||
          (entry.path.startsWith(desc.path + "/") &&
          entry.path.indexOf("/") === entry.path.lastIndexOf("/"))) &&
        !desc.exclude.find(p => entry.path.startsWith(p)) &&
        !entry.path.startsWith(".github")
      )
      .map(entry => entry.path)
      .map(name => desc.url.replace("$path", name))
      .map(spec => Object.assign({ spec, repo: reponame }))
      .map(entry => {
        // Similar code as in toReleaseUrl, but this time we'll rather match
        // on the would-be shortname of the spec, and filter out those that
        // turned out not to be on the Recommendation track
        const shortname = computeShortname(entry.spec).shortname;
        const mapping = (repo2Release[entry.repo] ?? [])
          .filter(spec =>
            groups[spec.group]?.repos.find(r => r.fullName === entry.repo) &&
            computeShortname(spec.url).shortname === shortname
          );
        if (mapping.length > 0) {
          if (!mapping[0].recTrack) {
            // Turns out the spec is not on the Recommendation track
            return null;
          }
          entry.nightly = entry.spec;
          entry.spec = mapping[0].url;
        }
        return entry;
      })
      .filter(entry => entry);
    allSpecs.push(...specs);
  }
  return allSpecs;
}


/**
 * Retrieve the list of W3C specs of interest, leveraging the
 * w3c/validate-repos project.
 *
 * The list includes specs developed by Working Groups (published to /TR or
 * not), specs developed by Interest Groups, and specs developed by a few
 * Community Groups of interest.
 *
 * The list excludes:
 * - Specs developed in multi-spec repositories (such as CSS specs). Handled by
 *   the fetchMultiReposSpecs function.
 * - Proposals that follow a multi-stage pattern (such as WebAssembly specs).
 *   Handled by the fetchStage3Proposals function.
 * - WG/IG specs that are not on the Recommendation or Registry track (such as
 *   Notes), coz' we want to focus on specs with more normative content.
 *
 * The source used is the w3c/validate-repos project, which tracks a number of
 * GitHub organizations associated with W3C and analyzes their repositories.
 * We typically want the repositories that have a `w3c.json` file with a
 * `repo-type` property set to `rec-track` or `registry` for WGs/IGs or
 * `cg-report` for CGs.
 *
 * The URLs extracted, or derived, from the repositories are those of the
 * Editor's Drafts. In browser-specs, we prefer to use the /TR URL of a spec as
 * canonical URL for the spec, because it more stable. Mapping from the ED URL
 * to a possible /TR URL is done via the w3c/spec-dashboard project, which
 * leverages the W3C API to associate GitHub repositories with groups and /TR
 * URLs. Note that the w3c/spec-dashboard project is all about tracking
 * unfinished specs and does not contain information about Recommendations,
 * but specs typically enter browser-specs much earlier than the Recommendation
 * stage in any case (unless we voluntarily decided not to track the spec).
 */
async function fetchW3CSpecs() {
  // Retrieve the full list of known W3C groups and repositories
  // from the w3c/validate-repos project.
  const { groups, repos } = await fetchJSON(
    "https://w3c.github.io/validate-repos/report.json"
  );
  const repo2Release = await fetchJSON(
    "https://w3c.github.io/spec-dashboard/repo-map.json"
  );

  // Only keep repositories that should contain content of interest for us
  // (see function comments for details)
  // To convert repositories to specs, two choices: either the repository has
  // a `homepageUrl`, in which case we'll assume it targets the spec, or it
  // does not, in which case we'll generate a github.io URL for the repo.
  return Object.values(groups)
    .filter(g => g.type)
    .filter(g => g.type !== "community group" || watchedCGs.includes(g.name))
    .map(g => g.repos.map(r => r.fullName))
    .flat()
    .filter(repoFullName => !multiRepos[repoFullName])
    .map(repoFullName => repos.find(matchRepoName(repoFullName)))
    .filter(eitherFilter(
      hasRepoType("rec-track"),
      hasRepoType("registry"),
      hasRepoType("cg-report"))
    )
    .map(repo => repo.homepageUrl ?
      canonicalizeGhUrl(repo) :
      toGhUrl(repo))
    .map(toReleaseUrl(repo2Release, groups));
}


/**
 * Retrieve the list of WHATWG specs, leveraging the JSON listing published by
 * the WHATWG.
 */
async function fetchWHATWGSpecs() {
  const whatwgDB = await fetchJSON(
    "https://raw.githubusercontent.com/whatwg/sg/master/db.json"
  );
  const reShortname = /.*\/([a-z]+)\.spec\.whatwg\.org\//;
  const whatwgSpecs = whatwgDB.workstreams
    .map(workstream => workstream.standards.map(spec => Object.assign({
      repo: "whatwg/" + spec.href.replace(reShortname, "$1"),
      spec: spec.href
    })))
    .flat();
  return whatwgSpecs;
}


/**
 * Retrieve the list of specs and repositories that should not be reported
 * because we're already aware of them and their treatment is still pending or
 * we explicitly don't want to add them to browser-specs.
 */
async function fetchKnownCandidates() {
  const list = [];

  // Retrieve the list of open issues that have a "new spec" label
  let hasNextPage = true;
  let endCursor = "";
  while (hasNextPage) {
    const response = await sendGraphQLQuery(`query {
      organization(login: "${BROWSER_SPECS_REPO.owner}") {
        repository(name: "${BROWSER_SPECS_REPO.name}") {
          issues(
            states: OPEN,
            labels: "new spec",
            first: 100
            ${endCursor ? ', after: "' + endCursor + '"' : ''}
          ) {
            pageInfo {
              endCursor
              hasNextPage
            }
            nodes {
              number
              body
            }
          }
        }
      }
    }`, githubToken);
    const issues = response.data.organization.repository.issues;
    list.push(...issues.nodes);
    hasNextPage = issues.pageInfo.hasNextPage;
    endCursor = issues.pageInfo.endCursor;
  }

  // Complete with the list of closed issues that have an ignore label
  hasNextPage = true;
  endCursor = "";
  while (hasNextPage) {
    const response = await sendGraphQLQuery(`query {
      organization(login: "${BROWSER_SPECS_REPO.owner}") {
        repository(name: "${BROWSER_SPECS_REPO.name}") {
          issues(
            states: CLOSED,
            labels: "ignore",
            first: 100
            ${endCursor ? ', after: "' + endCursor + '"' : ''}
          ) {
            pageInfo {
              endCursor
              hasNextPage
            }
            nodes {
              number
              body
            }
          }
        }
      }
    }`, githubToken);
    const issues = response.data.organization.repository.issues;
    list.push(...issues.nodes);
    hasNextPage = issues.pageInfo.hasNextPage;
    endCursor = issues.pageInfo.endCursor;
  }

  // Convert issues to spec entry objects, in other words extract the spec's
  // URL and repository from the issue.
  return list
    .map(issue => {
      const sections = splitIssueBodyIntoSections(issue.body);
      const urlSection = sections.find(section => section.title === 'URL');
      if (!urlSection) {
        // Issue does not follow the expected format
        return null;
      }
      const entry = {
        spec: urlSection.value
      };

      const rationaleSection = sections.find(section => section.title === "Rationale");
      const reRepository = /repository: \[.*?\]\((.+?)\)/i;
      if (rationaleSection) {
        const match = rationaleSection.value.match(reRepository);
        if (match) {
          entry.repo = match[1].replace(/https:\/\/github\.com\//, "");
          if (multiRepos[entry.repo]) {
            // The repository contains multiple specs and thus cannot be used
            // as evidence that the spec is already a known one.
            entry.repo = null;
          }
        }
      }
      return entry;
    })
    .filter(entry => entry);
}


/**
 * Loops through well-known sources that list specs and well-known repositories
 * that contain specs to report candidate specs to consider.
 *
 * Sources include WHATWG's database, TC39 proposals, and all known
 * repositories that W3C tracks in the w3c/validate-repos project.
 */
async function findSpecs() {
  // Collect the list of candidate specs that we're already aware of.
  const knownCandidates = await fetchKnownCandidates();

  let candidates = []
    .concat(await fetchW3CSpecs())
    .concat(await fetchWHATWGSpecs())
    .concat(await fetchStage3Proposals())
    .concat(await fetchMultiReposSpecs())
    .filter(hasUntrackedURL)
    .filter(entry => !knownCandidates.find(known =>
      known.spec === entry.spec ||
      known.repo === entry.repo));

  // Add information from Chrome Feature status
  const chromeFeatures = await fetchJSON("https://www.chromestatus.com/features.json");
  candidates = candidates.map(c => { return {...c, impl: { chrome: (chromeFeatures.find(f => f.standards.spec && f.standards.spec.startsWith(c.spec)) || {}).id}};});

  // Filter out specs that cannot be fetched (e.g., because the URL we computed
  // for the spec simply does not exist yet
  const fetchQueue = new ThrottledQueue({ maxParallel: 2 });
  for (const candidate of candidates) {
    const exists = await fetchQueue.runThrottled(fetch, candidate.spec)
      .then(async response => {
        // Need to consume the body otherwise Node.s fails to terminate the
        // fetch (until a timeout occurs). Not really sure why, we don't return
        // response, Node.js should be able to garbage collect the fetch.
        await response.bytes();
        return response.status === 200;
      });
    if (!exists) {
      candidate.spec = null;
    }
  }
  const monitorAdditions = candidates.filter(candidate => !candidate.spec);
  candidates = candidates.filter(candidate => candidate.spec);

  // Compute a shortname and sort list by shortname
  for (const candidate of candidates) {
    try {
      candidate.shortname = computeShortname(candidate.spec).shortname;
    }
    catch {}
  }
  candidates.sort((c1, c2) => {
    if (c1.shortname && c2.shortname) {
      return c1.shortname.localeCompare(c2.shortname);
    }
    else if (c1.shortname) {
      return -1;
    }
    else if (c2.shortname) {
      return 1;
    }
    else {
      return c1.spec.localeCompare(c2.spec);
    }
  });

  return {
    additions: candidates,
    monitor: monitorAdditions
  };
}


function parseMaxOption(value) {
  const parsedValue = parseInt(value, 10);
  if (isNaN(parsedValue)) {
    throw new Error('The `--max` option value must be a number.');
  }
  return parsedValue;
}


/*****************************************************************************
 * Main loop, create the CLI using Commander.
 *****************************************************************************/
const program = new Command();
program
  .name('find-specs')
  .version(version)
  .description('Find candidate specs that could be worth adding to the main list (`specs.json`).')
  .option('-g, --github', 'report candidates to the `w3c/browser-specs` GitHub repository. The command will create one issue per candidate spec.')
  .option('-m, --max <number>', 'set the maximum number of issues to create. The option is only meaningful when the `--github` option is set. Default value is 5. Set the option to 0 to report all candidate specs.', parseMaxOption, 5)
  .option('-r, --repos', 'report candidate repositories with no published content as well.')
  .addHelpText('after', `
Output:
  - The command reports a list of candidates for addition.
  - Additionally, if the \`--github\` option is set, the command also reports these candidates as issues opened against the \`w3c/browser-specs\` repository.

Notes:
  - The command only creates an issue if there is no open issue that already suggests adding the spec.

Examples:
  $ find-specs
  $ find-specs --github --max 3
`)
  .action(async (options) => {
    const candidates = await findSpecs();
    if (candidates.additions.length + candidates.monitor.length === 0) {
      console.log('No candidate specs found');
      return;
    }

    if (candidates.additions.length > 0) {
      console.log("New candidate specs that may be worth adding:");
      for (const c of candidates.additions) {
        const specName = c.shortname ? `[${c.shortname}](${c.spec})` : c.spec;
        const repoName = `[${c.repo}](https://github.com/${c.repo})`;
        const chromeLink = c.impl?.chrome ?
          ` [chrome status](https://www.chromestatus.com/features/${c.impl.chrome})` :
          "";
        console.log(`- ${specName} from ${repoName}${chromeLink}`);
      }
    }

    if (options.repos && candidates.monitor.length > 0) {
      if (candidates.additions.length > 0) {
        console.log();
      }
      console.log("Non-monitored repositories without published content:");
      for (const {repo} of candidates.monitor) {
        console.log(`- [${repo}](https://github.com/${repo})`);
      }
    }

    if (options.github) {
      console.log();
      let issuesStr;
      try {
        issuesStr = execSync(`gh issue list --label "new spec" --json body,number`);
      }
      catch (err) {
        console.log(`Could not retrieve open issues from w3c/browser-specs repository.`);
        process.exit(1);
      }
      const issues = JSON.parse(issuesStr);

      let created = 0;
      for (const candidate of candidates.additions) {
        const issue = issues.find(issue => issue.body.includes(candidate.spec));
        if (issue) {
          // Skip as there's already an issue opened for that candidate spec
          continue;
        }

        // Important: the issue body must match the `suggest-spec.yml` issue
        // template. There is unfortunately no easy way to create an issue out
        // of such a template directly.
        const title = `Add ${candidate.shortname ?? candidate.spec}`;
        const bodyFile = path.join(scriptPath, "..", "__issue.md");
        const comments = [
          `- See repository: [${candidate.repo}](https://github.com/${candidate.repo})`,
          candidate.impl.chrome ? `- [chrome status](${candidate.impl.chrome})` : null,
          candidate.shortname ? `- Would-be shortname: \`${candidate.shortname}\`` : null
        ].filter(comment => !!comment);
        await fs.writeFile(
          bodyFile,
          `### URL

${candidate.spec}

### Rationale

${comments.join("\n")}

### Additional properties

\`\`\`json
{}
\`\`\`
`
          , 'utf8');
        execSync(`gh issue create --label "new spec" --title "${title}" --body-file "__issue.md"`, execParams);
        await fs.rm(bodyFile, { force: true });
        created++;
        if (options.max > 0 && created > options.max) {
          break;
        }
      }
    }
  });

program.parseAsync(process.argv);
