const fetch = require("node-fetch");

const specs = require("../index.json");

const nonBrowserSpecWgs = ["Accessibility Guidelines Working Group", "Accessible Platform Architectures Working Group", "Automotive Working Group", "Dataset Exchange Working Group", "Decentralized Identifier Working Group", "Distributed Tracing Working Group", "Education and Outreach Working Group", "JSON-LD Working Group", "Publishing Working Group", "Verifiable Credentials Working Group", "Web of Things Working Group"];
const watchedBrowserCgs = ["Web Platform Incubator Community Group", "Web Assembly Community Group", "Immersive Web Community Group", "Audio Community Group", "Privacy Community Group", "GPU for the Web Community Group"];

const canonicalizeGhUrl = url => (url.indexOf("github.io") > 0 && url.split("/").length === 4 ? url + '/' : url).replace('http:', 'https:');

fetch("https://w3c.github.io/validate-repos/report.json")
  .then(r => r.json())
  .then(({groups, repos}) => {
    const wgs = Object.values(groups).filter(g => g.type === "working group" && !nonBrowserSpecWgs.includes(g.name));
    const cgs = Object.values(groups).filter(g => g.type === "community group" && watchedBrowserCgs.includes(g.name));

    // WGs
    // * check repos with w3c.json/repo-type includes rec-track
    const wgRepos = [].concat(...wgs.map(g => g.repos.map(r => r.fullName)))
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
                .map(u => fetch(u).then(({status, url}) => {
                  if (status !== 404) return url;
                }))).then(urls => {
                  console.log("Unadvertized URLs from a repo of a browser-spec producing WG with no matching URL in spec list")
                  console.log(urls.filter(x => x));
                }
                         );

    // CGs
    //check repos with w3c.json/repo-type includes cg-report or with no w3c.json
    const cgRepos = [].concat(...cgs.map(g => g.repos.map(r => r.fullName)))
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
                .map(r => `https://${r.owner.login}.github.io/${r.name}/`)
                .filter(u => !specs.find(s => s.nightly.url.startsWith(u)))
                .map(u => fetch(u).then(({status, url}) => {
                  if (status !== 404) return url;
                }))).then(urls => {
                  console.log("Unadvertized URLs from a repo of a browser-spec producing CG with no matching URL in spec list")
                  console.log(urls.filter(x => x));
                }
                         );
  });
