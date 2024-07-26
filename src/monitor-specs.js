'use strict';
import fs from "node:fs/promises";
import core from '@actions/core';
import monitorList from "./data/monitor.json" with { type: "json" };

const toGhUrl = repo => `https://${repo.split("/")[0].toLowerCase()}.github.io/${repo.split("/")[1]}/`;

const today = new Date().toJSON().slice(0, 10);

// Check last-modified HTTP header for specs to highlight those that needs
// re-review
let review_needed = [];
const candidates = Object.keys(monitorList.repos).map(r => {return {...monitorList.repos[r], url: toGhUrl(r)};}).concat(
  Object.keys(monitorList.specs).map(s => {return {...monitorList.specs[s], url: s};}));
for (let candidate of candidates) {
  const response = await fetch(candidate.url);
  const { headers } = response;
  // The CSS drafts use a proprietary header to expose the real last modification date
  const lastRevised = headers.get('Last-Revised') ? new Date(headers.get('Last-Revised')) : new Date(headers.get('Last-Modified'));
  if (lastRevised > new Date(candidate.lastreviewed)) {
    review_needed.push({...candidate, lastupdated: lastRevised.toJSON()});
  }
  // We don't need the response's body, but not reading it means Node will keep
  // the network request in memory, which prevents the CLI from returning until
  // a timeout occurs.
  await response.arrayBuffer();
}
const review_list = review_needed.map(c => `- [ ] ${c.url} updated on ${c.lastupdated}; last comment: “${c.comment}” made on ${c.lastreviewed}`).join("\n");
core.exportVariable("review_list", review_list);
console.log(review_list);

// Update monitor.json setting lastreviewed date today on all entries
// This will serve as input to the automated pull request
Object.values(monitorList.repos).forEach(r => r.lastreviewed = today);
Object.values(monitorList.specs).forEach(r => r.lastreviewed = today);
await fs.writeFile("./src/data/monitor.json", JSON.stringify(monitorList, null, 2));
