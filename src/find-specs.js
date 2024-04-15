#!/usr/bin/env node
'use strict';
const fs = require("fs");
const puppeteer = require('puppeteer');
const path = require("path");
const { Command } = require("commander");
const { execSync } = require("child_process");
const { version } = require(path.join(__dirname, "..", "package.json"));
const execParams = { cwd: path.join(__dirname, '..') };

const computeShortname = require("./compute-shortname");

const specs = require("../index.json");
const ignorable = require("./data/ignore.json");
const monitorList = require("./data/monitor.json");

const {repos: temporarilyIgnorableRepos, specs: temporarilyIgnorableSpecs} = monitorList;

const nonBrowserSpecWgs = Object.keys(ignorable.groups);
const watchedBrowserCgs = [
  "Web Platform Incubator Community Group",
  "Web Assembly Community Group",
  "Immersive Web Community Group",
  "Audio Community Group",
  "Privacy Community Group",
  "GPU for the Web Community Group"
];
const cssMetaDir = ["shared", "indexes", "bin", ".github", "css-module", "css-module-bikeshed"];
const svgMetaDir = ["template"];
const fxtfMetaDir = [".github", "shared"];
const houdiniMetaDir = [".github", "images"];

function canonicalizeGhUrl(r) {
  const url = new URL(r.homepageUrl);
  url.protocol = 'https:';
  // Exceptionally, the homepage URL may link to the explainer instead of to the
  // spec. One example at the time of writing is Storage Buckets:
  // https://github.com/WICG/storage-buckets which targets:
  // https://wicg.github.io/storage-buckets/explainer
  url.pathname = url.pathname.replace(/(\/explainer(\.[^\/]+|\/)?)$/, '/');
  if (url.pathname.lastIndexOf('/') === 0 && url.pathname.length > 1) {
      url.pathname += '/';
  }

  // Exceptionally, the homepage URL may link to a fragment within a spec. One
  // example at the time of writing is Close Watcher to redirect to the HTML
  // spec: https://github.com/WICG/close-watcher
  if (url.hash) {
    url.hash = '';
  }
  return {repo: r.owner.login + '/' + r.name, spec: url.toString()};
}

function canonicalizeTRUrl(url) {
  url = new URL(url);
  url.protocol = 'https:';
  return url.toString();
}

const trimSlash = url => url.endsWith('/') ? url.slice(0, -1) : url;
const toGhUrl = repo => { return {repo: `${repo.owner.login}/${repo.name}`, spec: `https://${repo.owner.login.toLowerCase()}.github.io/${repo.name}/`}; };
const matchRepoName = fullName => r => fullName === r.owner.login + '/' + r.name;
const isRelevantRepo = fullName => !Object.keys(ignorable.repos).includes(fullName) && !Object.keys(temporarilyIgnorableRepos).includes(fullName);
const isInScope = ({spec: url, repo: fullName}) =>
  !Object.keys(ignorable.specs).includes(url) &&
  !Object.keys(temporarilyIgnorableSpecs).includes(url) &&
  isRelevantRepo(fullName);
// Set loose parameter when checking loosely if another version exists
const hasMoreRecentLevel = (s, url, loose) => {
  try {
    const shortnameData = computeShortname(url);
    return s.series.shortname === shortnameData.series.shortname
      && (s.seriesVersion > (shortnameData.seriesVersion ?? '')
          || loose && (s.seriesVersion === shortnameData.seriesVersion
                       // case of CSS drafts whose known editors drafts are version-less, but the directories in the repo use versions
                       || !s.seriesVersion
                       // Case of houdini drafts whose known editors drafts are versioned, but the directories in the repo use version-less
                       || (!shortnameData.seriesVersion && s.seriesVersion == 1)
                      ));
  } catch (e) {
    return false;
  }
};
const hasUntrackedURL = ({spec: url}) => {
  // Compare URLs case-insentively as we sometimes end up with different
  // casing (and difference is usually not significant)
  const lurl = trimSlash(url.toLowerCase());
  return !specs.find(s => s.nightly?.url?.toLowerCase()?.startsWith(lurl)
                       || (s.release && trimSlash(s.release.url.toLowerCase()) === lurl)
                       || (s.nightly?.pages && s.nightly.pages.find(u => trimSlash(u.toLowerCase()) === lurl)))
      && !specs.find(s => hasMoreRecentLevel(s, url, url.match(/\/drafts\./) && !url.match(/\/w3\.org/) // Because CSS specs have editors draft with and without levels, we look loosely for more recent levels when checking with editors draft
                                            ));
};
const hasUnknownTrSpec = ({spec: url}) => !specs.find(s => s.release && trimSlash(s.release.url) === trimSlash(url)) && !specs.find(s => hasMoreRecentLevel(s,url));

const eitherFilter = (f1, f2) => value => f1(value) || f2(value);
const hasRepoType = type => r => r.w3c && r.w3c["repo-type"]
      && (r.w3c["repo-type"] === type || r.w3c["repo-type"].includes(type));
const hasPublishedContent = (candidate) => fetch(candidate.spec).then(({ok, url}) => {
  if (ok) return {...candidate, spec: url};
});

async function findSpecs() {
  let candidates = [];

  const {groups, repos} = await fetch("https://w3c.github.io/validate-repos/report.json").then(r => r.json());
  const specRepos = await fetch("https://w3c.github.io/spec-dashboard/repo-map.json").then(r => r.json());
  const whatwgSpecs = await fetch("https://raw.githubusercontent.com/whatwg/sg/master/db.json").then(r => r.json())
        .then(d => d.workstreams.map(w => w.standards.map(s => { return {...s, id: s.href.replace(/.*\/([a-z]+)\.spec\.whatwg\.org\//, '$1')}; }) ).flat());
  const cssSpecs = await fetch("https://api.github.com/repos/w3c/csswg-drafts/contents/").then(r => r.json()).then(data => data.filter(p => p.type === "dir" && !cssMetaDir.includes(p.path)).map(p => p.path));
  const svgSpecs = await fetch("https://api.github.com/repos/w3c/svgwg/contents/specs").then(r => r.json()).then(data => data.filter(p => p.type === "dir" && !svgMetaDir.includes(p.name)).map(p => p.path));
  const fxtfSpecs = await fetch("https://api.github.com/repos/w3c/fxtf-drafts/contents/").then(r => r.json()).then(data => data.filter(p => p.type === "dir" && !fxtfMetaDir.includes(p.path)).map(p => p.path));
  const houdiniSpecs = await fetch("https://api.github.com/repos/w3c/css-houdini-drafts/contents/").then(r => r.json()).then(data => data.filter(p => p.type === "dir" && !houdiniMetaDir.includes(p.path)).map(p => p.path));

  // ECMA proposals are in markdown pages on GitHub. We only watch stage 3
  // proposals, which are in the first table on the page.
  // Same thing for Web Assembly proposals: let's extract phase 3+ proposals.
  const extractEcmaStage3Proposals = _=>
    [...document.querySelector("table").querySelectorAll("tr td:first-child a")].map(a => a.href);
  const extractWasmProposals = _ =>
    [...document.querySelectorAll("table")]
      .filter(table => table.previousElementSibling.nodeName === "H3" && table.previousElementSibling.textContent.match(/Phase (3|4|5)/))
      .map(table => [...table.querySelectorAll("tr td:first-child a")].map(a => a.href))
      .flat();
  let ecmaProposals;
  let ecmaIntlProposals;
  let wasmProposals;
  const browser = await puppeteer.launch();
  try {
    const page = await browser.newPage();
    await page.goto("https://github.com/tc39/proposals/blob/main/README.md");
    ecmaProposals = await page.evaluate(extractEcmaStage3Proposals);

    await page.goto("https://github.com/tc39/proposals/blob/main/ecma402/README.md");
    ecmaIntlProposals = await page.evaluate(extractEcmaStage3Proposals);

    await page.goto("https://github.com/WebAssembly/proposals/blob/main/README.md");
    wasmProposals = await page.evaluate(extractWasmProposals);
  }
  finally {
    await browser.close();
  }

  const chromeFeatures = await fetch("https://www.chromestatus.com/features.json").then(r => r.json());

  const wgs = Object.values(groups).filter(g => g.type === "working group" && !nonBrowserSpecWgs.includes(g.name));
  const cgs = Object.values(groups).filter(g => g.type === "community group" && watchedBrowserCgs.includes(g.name));

  // WGs
  // * check repos with w3c.json/repo-type including rec-track
  const wgRepos = wgs.map(g => g.repos.map(r => r.fullName)).flat()
        .map(fullName => repos.find(matchRepoName(fullName)));
  const recTrackRepos = wgRepos.filter(eitherFilter(hasRepoType('rec-track'), hasRepoType('registry')));

  // * look if those with homepage URLs have a match in the list of specs
  candidates = recTrackRepos.filter(r => r.homepageUrl)
    .map(canonicalizeGhUrl)
    .filter(hasUntrackedURL)
    .filter(isInScope);

  // * look if those without a homepage URL have a match with their generated URL
  candidates = candidates.concat((await Promise.all(recTrackRepos.filter(r => !r.homepageUrl)
                                    .map(toGhUrl)
                                    .filter(hasUntrackedURL)
                                    .filter(isInScope)
                                                    .map(hasPublishedContent))).filter(x => x));

  // Look which of the specRepos on recTrack from a browser-producing WG have no match
  candidates = candidates.concat(
    Object.keys(specRepos).map(
      r => specRepos[r].filter(s => s.recTrack && wgs.find(g => g.id === s.group)).map(s => { return {repo: r, spec: canonicalizeTRUrl(s.url)};}))
      .flat()
      .filter(hasUnknownTrSpec)
      .filter(isInScope)
  );

  // CGs
  //check repos with w3c.json/repo-type includes cg-report or with no w3c.json
  const cgRepos = cgs.map(g => g.repos.map(r => r.fullName)).flat()
        .map(fullName => repos.find(matchRepoName(fullName)));

  const cgSpecRepos = cgRepos.filter(r => !r.w3c
                                     || hasRepoType('cg-report')(r));
  // * look if those with homepage URLs have a match in the list of specs
  candidates = candidates.concat(cgSpecRepos.filter(r => r.homepageUrl)
              .map(canonicalizeGhUrl)
              .filter(hasUntrackedURL)
              .filter(isInScope)
                                );

  // for those without homepageUrl, check which have published content
  const publishedCandidates = (await Promise.all(cgSpecRepos.filter(r => !r.homepageUrl)
                                                .map(toGhUrl)
                                                .filter(hasUntrackedURL)
                                                .filter(isInScope)
                                                 .map(hasPublishedContent)
                                                )).filter(x => x);

  candidates = candidates.concat(publishedCandidates);

  // * look if those without homepage URLs but marked as a cg-report
  // have a match in the list of specs
  const monitorAdditions = cgSpecRepos
        .filter(r => !r.homepageUrl && hasRepoType('cg-report')(r) &&
            !publishedCandidates.find(p => p.repo === `${r.owner.login}/${r.name}`))
        .map(toGhUrl)
        .filter(hasUntrackedURL)
        .filter(isInScope)
  // we remove the spec field since we haven't found a usable url
        .map(c => Object.assign({}, {repo: c.repo}));

  // Check for new WHATWG streams
  candidates = candidates.concat(whatwgSpecs.map(s => { return {repo: `whatwg/${s.id}`, spec: s.href};})
                                 .filter(hasUntrackedURL)
                                 .filter(isInScope));

  // Check for new CSS specs
  candidates = candidates.concat(cssSpecs.map(s => { return {repo: "w3c/csswg-drafts", spec: `https://drafts.csswg.org/${s}/`};})
                                 .filter(hasUntrackedURL)
                                 .filter(isInScope));

  // Check for new SVG specs
  candidates = candidates.concat(svgSpecs.map(s => { return {repo: "w3c/svgwg", spec: `https://svgwg.org/${s}/`};})
                                 .filter(hasUntrackedURL)
                                 .filter(isInScope));

  // Check for new FXTF specs
  candidates = candidates.concat(fxtfSpecs.map(s => { return {repo: "w3c/fxtf-drafts", spec: `https://drafts.fxtf.org/${s}/`};})
                                 .filter(hasUntrackedURL)
                                 .filter(isInScope));

  // Check for new Houdini specs
  candidates = candidates.concat(houdiniSpecs.map(s => { return {repo: "w3c/css-houdini-drafts", spec: `https://drafts.css-houdini.org/${s}/`};})
                                 .filter(hasUntrackedURL)
                                 .filter(isInScope));

  // Check for new TC39 Stage 3 proposals
  candidates = candidates.concat(ecmaProposals.concat(ecmaIntlProposals).map(s => { return {repo: s.replace('https://github.com/', ''), spec: s.replace('https://github.com/tc39/', 'https://tc39.es/').replace('https://github.com/tc39-transfer/', 'https://tc39.es/') + '/'};})
                                 .filter(hasUntrackedURL)
                                 .filter(isInScope));

  // Check for new WASM phase 3+ proposals
  candidates = candidates.concat(wasmProposals.map(s => { return {repo: s.replace('https://github.com/', ''), spec: s.replace(/^https:\/\/github.com\/WebAssembly\/([^/]+)/i, 'https://webassembly.github.io/$1/')}})
                                 .filter(hasUntrackedURL)
                                 .filter(isInScope));

  // Add information from Chrome Feature status
  candidates = candidates.map(c => { return {...c, impl: { chrome: (chromeFeatures.find(f => f.standards.spec && f.standards.spec.startsWith(c.spec)) || {}).id}};});

  // Filter out specs that cannot be fetched (e.g., because the URL we computed
  // for the spec simply does not exist yet
  for (const candidate of candidates) {
    const exists = await fetch(candidate.spec).then(r => r.status === 200);
    if (!exists) {
      candidate.spec = null;
    }
  }
  candidates = candidates.filter(candidate => !!candidate.spec);
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
      try {
        issuesStr = execSync(`gh issue list --label "new spec" --json body,number`);
      }
      catch (err) {
        console.log(`Could not retrieve open issues from w3c/browser-specs repository.`);
        console.log(err);
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
        const bodyFile = path.join(__dirname, "..", "__issue.md");
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
