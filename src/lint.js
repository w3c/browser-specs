"use strict";

const fs = require("fs").promises;
const computeShortname = require("./compute-shortname.js");
const computePrevNext = require("./compute-prevnext.js");


function compareSpecs(a, b) {
  return a.url.localeCompare(b.url);
}


// Shorten definition of spec to more human-readable version
function shortenDefinition(spec) {
  const short = {};
  for (const property of Object.keys(spec)) {
    if (!((property === "seriesComposition" && spec[property] === "full") ||
        (property === "multipage" && !spec[property]) ||
        (property === "forceCurrent" && !spec[property]))) {
      short[property] = spec[property];
    }
  }
  if (Object.keys(short).length === 1) {
    return short.url;
  }
  else if (Object.keys(short).length === 2 &&
      spec.seriesComposition === "delta") {
    return `${spec.url} delta`;
  }
  else if (Object.keys(short).length === 2 &&
      spec.seriesComposition === "fork") {
    return `${spec.url} fork`;
  }
  else if (Object.keys(short).length === 2 &&
      spec.forceCurrent) {
    return `${spec.url} current`;
  }
  else if (Object.keys(short).length === 2 &&
      spec.multipage) {
    return `${spec.url} multipage`;
  }
  else {
    return short;
  }
}


// Lint specs list defined as a JSON string
function lintStr(specsStr) {
  const specs = JSON.parse(specsStr);

  // Normalize end of lines, different across platforms, for comparison
  specsStr = specsStr.replace(/\r\n/g, "\n");

  // Convert entries to spec objects, drop duplicates, and sort per URL
  const sorted = specs
    .map(spec => (typeof spec === "string") ?
      {
        url: new URL(spec.split(" ")[0]).toString(),
        seriesComposition: (spec.split(' ')[1] === "delta") ? "delta" :
          (spec.split(' ')[1] === "fork") ? "fork" : "full",
        forceCurrent: (spec.split(' ')[1] === "current"),
        multipage: (spec.split(' ')[1] === "multipage"),
      } :
      Object.assign({}, spec, { url: new URL(spec.url).toString() }))
    .filter((spec, idx, list) =>
      !list.find((s, i) => i < idx && compareSpecs(s, spec) === 0))
    .sort(compareSpecs);

  // Generate names and links between levels
  const linkedList = sorted
    .map(s => Object.assign({}, s, computeShortname(s.shortname || s.url)))
    .map((s, _, list) => Object.assign({}, s, computePrevNext(s, list)));

  // Drop useless forceCurrent flag and shorten definition when possible
  const fixed = sorted
    .map(spec => {
      const linked = linkedList.find(p => p.url === spec.url);
      const next = linked.seriesNext ?
        linkedList.find(p => p.shortname === linked.seriesNext) :
        null;
      const isLast = !next || next.seriesComposition === "delta" ||
        next.seriesComposition === "fork";
      if (spec.forceCurrent && isLast) {
        spec.forceCurrent = false;
      }
      return spec;
    })
    .map(shortenDefinition);

  const linted = JSON.stringify(fixed, null, 2) + "\n";
  return (linted !== specsStr) ? linted : null;
}


// Lint by normalizing specs.json and comparing it to the original,
// fixing it in place if |fix| is true.
async function lint(fix = false) {
  const specs = await fs.readFile("./specs.json", "utf8");
  const linted = lintStr(specs);
  if (linted) {
    if (fix) {
      console.log("specs.json has lint issues, updating in place");
      await fs.writeFile("./specs.json", linted, "utf8");
    }
    else {
      console.log("specs.json has lint issues, run with --fix");
    }
    return false;
  }

  console.log("specs.json passed lint");
  return true;
}


if (require.main === module) {
  // Code used as command-line interface (CLI), run linting process
  lint(process.argv.includes("--fix")).then(
    ok => {
      process.exit(ok ? 0 : 1);
    },
    reason => {
      console.error(reason);
      process.exit(1);
    }
  );
}
else {
  // Code imported to another JS module, export lint functions
  module.exports.lintStr = lintStr;
  module.exports.lint = lint;
}
