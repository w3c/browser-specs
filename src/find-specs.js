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

function canonicalizeGhUrl(url) {
  url = new URL(url);
  url.protocol = 'https:';
  if (url.pathname.lastIndexOf('/') === 0) {
      url.pathname += '/';
  }
  return url.toString();
}

function canonicalizeTRUrl(url) {
  url = new URL(url);
  url.protocol = 'https:';
  return url.toString();
}

Promise.all(
  ["https://w3c.github.io/validate-repos/report.json",
   "https://w3c.github.io/spec-dashboard/repo-map.json"].map(
     dataUrl => fetch(dataUrl)
       .then(r => r.json())
   )
).then(([{groups, repos}, specRepos]) => {
  const wgs = Object.values(groups).filter(g => g.type === "working group" && !nonBrowserSpecWgs.includes(g.name));
  const cgs = Object.values(groups).filter(g => g.type === "community group" && watchedBrowserCgs.includes(g.name));

  // WGs
  // * check repos with w3c.json/repo-type including rec-track
  const wgRepos = wgs.map(g => g.repos.map(r => r.fullName)).flat()
        .map(fullName => repos.find(r => fullName === r.owner.login + '/' + r.name));
  const recTrackRepos = wgRepos.filter(r => r.w3c && r.w3c["repo-type"] && (r.w3c["repo-type"] === 'rec-track' || r.w3c["repo-type"].includes('rec-track')));
  // * look if those with homepage URLs have a match in the list of specs
  console.log("URLs from a repo of a browser-spec producing WG with no matching URL in spec list")
  console.log(recTrackRepos.filter(r => r.homepageUrl)
              .map(r => canonicalizeGhUrl(r.homepageUrl))
              .filter(u => !specs.find(s => s.nightly.url === u || (s.release && s.release.url === u)))
             );
  // * look if those without a homepage URL have a match with their generated URL
  Promise.all(recTrackRepos.filter(r => !r.homepageUrl)
              .map(r => `https://${r.owner.login}.github.io/${r.name}/`)
              .filter(u => !specs.find(s => s.nightly.url.startsWith(u)))
              .map(u => fetch(u).then(({ok, url}) => {
                if (ok) return url;
              }))).then(urls => {
                console.log("Unadvertized URLs from a repo of a browser-spec producing WG with no matching URL in spec list")
                console.log(urls.filter(x => x));
              }
                       );

  // Look which of the specRepos on recTrack from a browser-producing WG have no match
  console.log("TR specs from browser-producing WGs")
  console.log(
    Object.keys(specRepos).map(
      r => specRepos[r].filter(s => s.recTrack && wgs.find(g => g.id === s.group)).map(s => canonicalizeTRUrl(s.url)))
      .flat()
      .filter(u  => !specs.find(s => s.release && s.release.url === u))
  );

  // CGs
  //check repos with w3c.json/repo-type includes cg-report or with no w3c.json
  const cgRepos = cgs.map(g => g.repos.map(r => r.fullName)).flat()
        .map(fullName => repos.find(r => fullName === r.owner.login + '/' + r.name));
  const cgSpecRepos = cgRepos.filter(r => !r.w3c || (r.w3c && r.w3c["repo-type"] && (r.w3c["repo-type"] === 'cg-report' || r.w3c["repo-type"].includes('cg-report'))));
  // * look if those with homepage URLs have a match in the list of specs
  console.log("URLs from a repo of a browser-spec producing CG with no matching URL in spec list")
  console.log(cgSpecRepos.filter(r => r.homepageUrl)
              .map(r => canonicalizeGhUrl(r.homepageUrl))
              .filter(u => !specs.find(s => s.nightly.url === u))
             );
  // * look if those without a homepage URL have a match with their generated URL
  Promise.all(cgSpecRepos.filter(r => !r.homepageUrl)
              .map(r => `https://${r.owner.login.toLowerCase()}.github.io/${r.name}/`)
              .filter(u => !specs.find(s => s.nightly.url === u))
              .map(u => fetch(u).then(({status, url}) => {
                if (status !== 404) return url;
              }))).then(urls => {
                console.log("Unadvertized URLs from a repo of a browser-spec producing CG with no matching URL in spec list")
                console.log(urls.filter(x => x));
              }
                       );
});
