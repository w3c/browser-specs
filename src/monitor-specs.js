'use strict';
const fs = require("fs");

const core = require('@actions/core');

const fetch = require("node-fetch");

const monitorList = require("./data/monitor.json");

const toGhUrl = repo => `https://${repo.split("/")[0].toLowerCase()}.github.io/${repo.split("/")[1]}/`;

const today = new Date().toJSON().slice(0, 10);

(async function() {
  // Check last-modified HTTP header for specs to highlight those that needs
  // re-review
  let review_needed = [];
  const candidates = Object.keys(monitorList.repos).map(r => {return {...monitorList.repos[r], url: toGhUrl(r)};}).concat(
    Object.keys(monitorList.specs).map(s => {return {...monitorList.specs[s], url: s};}));
 for (let candidate of candidates) {
   await fetch(candidate.url).then(({headers}) => {
     // The CSS drafts use a proprietary header to expose the real last modification date
     const lastRevised = headers.get('Last-Revised') ? new Date(headers.get('Last-Revised') : new Date(headers.get('Last-Modified');
     if (lastRevised > new Date(candidate.lastreviewed)) {
       review_needed.push({...candidate, lastupdated: lastRevised.toJSON()});
     }
   });
 }
 const review_list = review_needed.map(c => `- [ ] ${c.url} updated on ${c.lastupdated}; last comment: “${c.comment}” made on ${c.lastreviewed}`).join("\n");
 core.exportVariable("review_list", review_list);
 console.log(review_list);

  // Update monitor.json setting lastreviewed date today on all entries
  // This will serve as input to the automated pull request
  Object.values(monitorList.repos).forEach(r => r.lastreviewed = today);
  Object.values(monitorList.specs).forEach(r => r.lastreviewed = today);
 fs.writeFileSync("./src/data/monitor.json", JSON.stringify(monitorList, null, 2));
})().catch(e => {
  console.error(e);
  process.exit(1);
});


