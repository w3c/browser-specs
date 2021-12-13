'use strict';
const fs = require("fs");

const core = require('@actions/core');

const fetch = require("node-fetch");

const {JSDOM} = require("jsdom");

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
  if (url.pathname.lastIndexOf('/') === 0 && url.pathname.length > 1) {
      url.pathname += '/';
  }
  return {repo: r.owner.login + '/' + r.name, spec: url.toString()};
}

function canonicalizeTRUrl(url) {
  url = new URL(url);
  url.protocol = 'https:';
  return url.toString();
}

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
      && (s.seriesVersion > shortnameData.seriesVersion
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
const hasUntrackedURL = ({spec: url}) => !specs.find(s => s.nightly.url.startsWith(url)
                                                    || (s.release && s.release.url === url))
      && !specs.find(s => hasMoreRecentLevel(s, url, url.match(/\/drafts\./) && !url.match(/\/w3\.org/) // Because CSS specs have editors draft with and without levels, we look loosely for more recent levels when checking with editors draft
                                            ));
const hasUnknownTrSpec = ({spec: url}) => !specs.find(s => s.release && s.release.url === url) && !specs.find(s => hasMoreRecentLevel(s,url));

const hasRepoType = type => r => r.w3c && r.w3c["repo-type"]
      && (r.w3c["repo-type"] === type || r.w3c["repo-type"].includes(type));
const hasPublishedContent = (candidate) => fetch(candidate.spec).then(({ok, url}) => {
  if (ok) return {...candidate, spec: url};
});

(async function() {
  let candidates = [];

  const {groups, repos} = await fetch("https://w3c.github.io/validate-repos/report.json").then(r => r.json());
  const specRepos = await fetch("https://w3c.github.io/spec-dashboard/repo-map.json").then(r => r.json());
  const whatwgSpecs = await fetch("https://raw.githubusercontent.com/whatwg/sg/master/db.json").then(r => r.json())
        .then(d => d.workstreams.map(w => w.standards.map(s => { return {...s, id: s.href.replace(/.*\/([a-z]+)\.spec\.whatwg\.org\//, '$1')}; }) ).flat());
  const cssSpecs = await fetch("https://api.github.com/repos/w3c/csswg-drafts/contents/").then(r => r.json()).then(data => data.filter(p => p.type === "dir" && !cssMetaDir.includes(p.path)).map(p => p.path));
  const svgSpecs = await fetch("https://api.github.com/repos/w3c/svgwg/contents/specs").then(r => r.json()).then(data => data.filter(p => p.type === "dir" && !svgMetaDir.includes(p.name)).map(p => p.path));
  const fxtfSpecs = await fetch("https://api.github.com/repos/w3c/fxtf-drafts/contents/").then(r => r.json()).then(data => data.filter(p => p.type === "dir" && !fxtfMetaDir.includes(p.path)).map(p => p.path));
  const houdiniSpecs = await fetch("https://api.github.com/repos/w3c/css-houdini-drafts/contents/").then(r => r.json()).then(data => data.filter(p => p.type === "dir" && !houdiniMetaDir.includes(p.path)).map(p => p.path));

  const ecmaProposals = await JSDOM.fromURL("https://github.com/tc39/proposals/blob/master/README.md")
  // we only watch stage 3 proposals, which are in the first table on the page above
    .then(dom => [...dom.window.document.querySelector("table").querySelectorAll("tr td:first-child a")].map(a => a.href));

  const ecmaIntlProposals = await JSDOM.fromURL("https://github.com/tc39/proposals/blob/master/ecma402/README.md")
  // we only watch stage 3 proposals, which are in the first table on the page above
    .then(dom => [...dom.window.document.querySelector("table").querySelectorAll("tr td:first-child a")].map(a => a.href));

  const chromeFeatures = await fetch("https://www.chromestatus.com/features.json").then(r => r.json());

  const wgs = Object.values(groups).filter(g => g.type === "working group" && !nonBrowserSpecWgs.includes(g.name));
  const cgs = Object.values(groups).filter(g => g.type === "community group" && watchedBrowserCgs.includes(g.name));

  // WGs
  // * check repos with w3c.json/repo-type including rec-track
  const wgRepos = wgs.map(g => g.repos.map(r => r.fullName)).flat()
        .map(fullName => repos.find(matchRepoName(fullName)));
  const recTrackRepos = wgRepos.filter(hasRepoType('rec-track'));

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


  // Add information from Chrome Feature status
  candidates = candidates.map(c => { return {...c, impl: { chrome: (chromeFeatures.find(f => f.standards.spec && f.standards.spec.startsWith(c.spec)) || {}).id}};});

  const candidate_list = candidates.sort((c1, c2) => c1.spec.localeCompare(c2.spec))
        .map(c => `- [ ] ${c.spec} from [${c.repo}](https://github.com/${c.repo})` + (c.impl.chrome ? ` [chrome status](https://www.chromestatus.com/features/${c.impl.chrome})` : '')).join("\n");
  core.exportVariable("candidate_list", candidate_list);
  console.log(candidate_list);
  if (monitorAdditions.length) {
    const today = new Date().toJSON().slice(0, 10);
    const monitored = monitorAdditions.map(({repo}) => `- [ ] [${repo}](https://github.com/${repo})`).join("\n");
    core.exportVariable("monitor_list", monitored);
    monitorAdditions.forEach(({repo}) => {
      monitorList.repos[repo] = {
        lastreviewed: today,
        comment: "no published content yet"
      };
    });
    fs.writeFileSync("./src/data/monitor.json", JSON.stringify(monitorList, null, 2));
    console.log(monitored);
  }
})().catch(e => {
  console.error(e);
  process.exit(1);
});
