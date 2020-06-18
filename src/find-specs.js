'use strict';
const core = require('@actions/core');

const fetch = require("node-fetch");

const computeShortname = require("./compute-shortname");

const specs = require("../index.json");
const ignorable = require("./data/ignore.json");
const {repos: temporarilyIgnorableRepos, specs: temporarilyIgnorableSpecs} = require("./data/monitor.json");

const nonBrowserSpecWgs = [
  "Accessibility Guidelines Working Group",
  "Accessible Platform Architectures Working Group",
  "Automotive Working Group",
  "Dataset Exchange Working Group",
  "Decentralized Identifier Working Group",
  "Distributed Tracing Working Group",
  "Education and Outreach Working Group",
  "JSON-LD Working Group",
  "Publishing Working Group",
  "Verifiable Credentials Working Group",
  "Web of Things Working Group"
];
const watchedBrowserCgs = [
  "Web Platform Incubator Community Group",
  "Web Assembly Community Group",
  "Immersive Web Community Group",
  "Audio Community Group",
  "Privacy Community Group",
  "GPU for the Web Community Group"
];
const cssMetaDir = ["shared", "indexes", "bin", ".github", "css-module", "css-module-bikeshed"];


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
const hasRelevantSpec = ({spec: url}) => !Object.keys(ignorable.specs).includes(url) && !Object.keys(temporarilyIgnorableSpecs).includes(url);
// Set loose parameter when checking loosely if another version exists
const hasMoreRecentLevel = (s, url, loose) => {
  try {
    const shortnameData = computeShortname(url);
    return s.series.shortname === shortnameData.series.shortname && (s.seriesVersion > shortnameData.seriesVersion || loose && (s.seriesVersion === shortnameData.seriesVersion || !s.seriesVersion));
  } catch (e) {
    return false;
  }
};
const hasUnknownSpec = ({spec: url}) => !specs.find(s => s.nightly.url.startsWith(url)
                                                    || (s.release && s.release.url === url))
      && !specs.find(s => hasMoreRecentLevel(s, url, true // Because CSS specs have editors draft with and without levels, we look loosely for more recent levels when checking with editors draft
                                            ));
const hasUnknownTrSpec = ({spec: url}) => !specs.find(s => s.release && s.release.url === url) && !specs.find(s => hasMoreRecentLevel(s,url));

const hasRepoType = type => r => r.w3c && r.w3c["repo-type"]
      && (r.w3c["repo-type"] === type || r.w3c["repo-type"].includes(type));
const hasExistingSpec = (candidate) => fetch(candidate.spec).then(({ok, url}) => {
  if (ok) return {...candidate, spec: url};
});

(async function() {
  let candidates = [];

  const {groups, repos} = await fetch("https://w3c.github.io/validate-repos/report.json").then(r => r.json());
  const specRepos = await fetch("https://w3c.github.io/spec-dashboard/repo-map.json").then(r => r.json());
  const whatwgSpecs = await fetch("https://raw.githubusercontent.com/whatwg/sg/master/db.json").then(r => r.json())
        .then(d => d.workstreams.map(w => { return {...w.standards[0], id: w.id}; }));
  const cssSpecs = await fetch("https://api.github.com/repos/w3c/csswg-drafts/contents/").then(r => r.json()).then(data => data.filter(p => p.type === "dir" && !cssMetaDir.includes(p.path)).map(p => p.path));

  const chromeFeatures = await fetch("https://www.chromestatus.com/features.json").then(r => r.json());

  const wgs = Object.values(groups).filter(g => g.type === "working group" && !nonBrowserSpecWgs.includes(g.name));
  const cgs = Object.values(groups).filter(g => g.type === "community group" && watchedBrowserCgs.includes(g.name));

  // WGs
  // * check repos with w3c.json/repo-type including rec-track
  const wgRepos = wgs.map(g => g.repos.map(r => r.fullName)).flat()
        .filter(isRelevantRepo)
        .map(fullName => repos.find(matchRepoName(fullName)));
  const recTrackRepos = wgRepos.filter(hasRepoType('rec-track'));

  // * look if those with homepage URLs have a match in the list of specs
  candidates = recTrackRepos.filter(r => r.homepageUrl)
    .map(canonicalizeGhUrl)
    .filter(hasUnknownSpec)
    .filter(hasRelevantSpec);

  // * look if those without a homepage URL have a match with their generated URL
  candidates = candidates.concat((await Promise.all(recTrackRepos.filter(r => !r.homepageUrl)
                                    .map(toGhUrl)
                                    .filter(hasUnknownSpec)
                                    .filter(hasRelevantSpec)
                                                    .map(hasExistingSpec))).filter(x => x));

  // Look which of the specRepos on recTrack from a browser-producing WG have no match
  candidates = candidates.concat(
    Object.keys(specRepos).map(
      r => specRepos[r].filter(s => s.recTrack && wgs.find(g => g.id === s.group)).map(s => { return {repo: r, spec: canonicalizeTRUrl(s.url)};}))
      .flat()
      .filter(hasUnknownTrSpec)
      .filter(hasRelevantSpec)
  );

  // CGs
  //check repos with w3c.json/repo-type includes cg-report or with no w3c.json
  const cgRepos = cgs.map(g => g.repos.map(r => r.fullName)).flat()
        .filter(isRelevantRepo)
        .map(fullName => repos.find(matchRepoName(fullName)));

  const cgSpecRepos = cgRepos.filter(r => !r.w3c
                                     || hasRepoType('cg-report')(r));
  // * look if those with homepage URLs have a match in the list of specs
  candidates = candidates.concat(cgSpecRepos.filter(r => r.homepageUrl)
              .map(canonicalizeGhUrl)
              .filter(hasUnknownSpec)
              .filter(hasRelevantSpec)
             );
  // * look if those without a homepage URL have a match with their generated URL
  candidates = candidates.concat((await Promise.all(cgSpecRepos.filter(r => !r.homepageUrl)
                                                    .map(toGhUrl)
                                                    .filter(hasUnknownSpec)
                                                    .filter(hasRelevantSpec)
                                                    .map(hasExistingSpec))
                                 ).filter(x => x));

  // Check for new WHATWG streams
  candidates = candidates.concat(whatwgSpecs.map(s => { return {repo: `whatwg/${s.id}`, spec: s.href};})
                                 .filter(hasUnknownSpec)
                                 .filter(hasRelevantSpec));

  // Check for new CSS specs
  candidates = candidates.concat(cssSpecs.map(s => { return {repo: "w3c/csswg-drafts", spec: `https://drafts.csswg.org/${s}/`};})
                                 .filter(hasUnknownSpec)
                                 .filter(hasRelevantSpec));

  // Add information from Chrome Feature status
  candidates = candidates.map(c => { return {...c, impl: { chrome: (chromeFeatures.find(f => f.standards.spec && f.standards.spec.startsWith(c.spec)) || {}).id}};});

  const candidate_list = candidates.sort((c1, c2) => c1.spec.localeCompare(c2.spec))
        .map(c => `- [ ] ${c.spec} from [${c.repo}](https://github.com/${c.repo})` + (c.impl.chrome ? ` [chrome status](https://www.chromestatus.com/features/${c.impl.chrome})` : '')).join("\n");
  core.exportVariable("candidate_list", candidate_list);
  console.log(candidate_list);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
