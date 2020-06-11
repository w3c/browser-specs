'use strict';

const fetch = require("node-fetch");

const specs = require("../index.json");

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

function canonicalizeGhUrl(r) {
  const url = new URL(r.homepageUrl);
  url.protocol = 'https:';
  if (url.pathname.lastIndexOf('/') === 0 && url.pathname.length > 1) {
      url.pathname += '/';
  }
  return url.toString();
}

function canonicalizeTRUrl(url) {
  url = new URL(url);
  url.protocol = 'https:';
  return url.toString();
}

const toGhUrl = repo => `https://${repo.owner.login.toLowerCase()}.github.io/${repo.name}/`
const matchRepoName = fullName => r => fullName === r.owner.login + '/' + r.name;
const isUnknownSpec = url => !specs.find(s => s.nightly.url === url
                                         || (s.release && s.release.url === url))
const hasRepoType = type => r => r.w3c && r.w3c["repo-type"]
      && (r.w3c["repo-type"] === type || r.w3c["repo-type"].includes(type));
const urlIfExists = u => fetch(u).then(({ok, url}) => {
  if (ok) return url;
});

(async function() {
  const {groups, repos} = await fetch("https://w3c.github.io/validate-repos/report.json").then(r => r.json());
  const specRepos = await fetch("https://w3c.github.io/spec-dashboard/repo-map.json").then(r => r.json());
  const whatwgSpecs = await fetch("https://raw.githubusercontent.com/whatwg/sg/master/db.json").then(r => r.json())
        .then(d => d.workstreams.map(w => w.standards).flat());

  const wgs = Object.values(groups).filter(g => g.type === "working group" && !nonBrowserSpecWgs.includes(g.name));
  const cgs = Object.values(groups).filter(g => g.type === "community group" && watchedBrowserCgs.includes(g.name));

  // WGs
  // * check repos with w3c.json/repo-type including rec-track
  const wgRepos = wgs.map(g => g.repos.map(r => r.fullName)).flat()
        .map(fullName => repos.find(matchRepoName(fullName)));
  const recTrackRepos = wgRepos.filter(hasRepoType('rec-track'));

  // * look if those with homepage URLs have a match in the list of specs
  console.log("URLs from a repo of a browser-spec producing WG with no matching URL in spec list")
  console.log(recTrackRepos.filter(r => r.homepageUrl)
              .map(canonicalizeGhUrl)
              .filter(isUnknownSpec)
             );

  // * look if those without a homepage URL have a match with their generated URL
  const wgUrls = (await Promise.all(recTrackRepos.filter(r => !r.homepageUrl)
                                 .map(toGhUrl)
                                 .filter(isUnknownSpec)
                                  .map(urlIfExists))).filter(x => x);
  console.log("Unadvertized URLs from a repo of a browser-spec producing WG with no matching URL in spec list")
  console.log(wgUrls);

  // Look which of the specRepos on recTrack from a browser-producing WG have no match
  console.log("TR specs from browser-producing WGs")
  console.log(
    Object.keys(specRepos).map(
      r => specRepos[r].filter(s => s.recTrack && wgs.find(g => g.id === s.group)).map(s => canonicalizeTRUrl(s.url)))
      .flat()
      .filter(isUnknownSpec)
  );

  // CGs
  //check repos with w3c.json/repo-type includes cg-report or with no w3c.json
  const cgRepos = cgs.map(g => g.repos.map(r => r.fullName)).flat()
        .map(fullName => repos.find(matchRepoName(fullName)));
  const cgSpecRepos = cgRepos.filter(r => !r.w3c
                                     || hasRepoType('cg-report')(r));
  // * look if those with homepage URLs have a match in the list of specs
  console.log("URLs from a repo of a browser-spec producing CG with no matching URL in spec list")
  console.log(cgSpecRepos.filter(r => r.homepageUrl)
              .map(canonicalizeGhUrl)
              .filter(isUnknownSpec)
             );
  // * look if those without a homepage URL have a match with their generated URL
  const cgUrls = (await Promise.all(cgSpecRepos.filter(r => !r.homepageUrl)
                                   .map(toGhUrl)
                                   .filter(isUnknownSpec)
                                   .map(urlIfExists))).filter(x => x);
  console.log("Unadvertized URLs from a repo of a browser-spec producing CG with no matching URL in spec list")
  console.log(cgUrls);


  const whatwgUrls = whatwgSpecs.map(s => s.href)
        .filter(isUnknownSpec);
  console.log("URLs from WHATWG with no matching URL in spec list")
  console.log(whatwgUrls);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
