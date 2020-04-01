"use strict";

const computeShortname = require("./src/compute-shortname.js");
const computePrevNext = require("./src/compute-prevnext.js");
const computeCurrentLevel = require("./src/compute-currentlevel.js");

// Retrieve generated spec info (if file was properly generated)
const specInfo = (function () {
  try {
    return require("./specs-info.json");
  }
  catch (err) {
    return {};
  }
})();

const specs = require("./specs.json")
  // Turn all specs into objects
  // (and handle syntactic sugar notation for delta/current flags)
  .map(spec => {
    if (typeof spec === "string") {
      const parts = spec.split(" ");
      const res = { url: parts[0] };
      if (parts[1] === "delta") {
        res.levelComposition = "delta";
      }
      else if (parts[1] === "current") {
        res.forceCurrent = true;
      }
      return res;
    }
    else {
      return spec;
    }
  })

  // Complete information and output result starting with the URL, names,
  // level, and additional info
  .map(spec => Object.assign(
    { url: spec.url, levelComposition: spec.levelComposition || "full" },
    computeShortname(spec.name || spec.url),
    spec))

  // Complete information with currentLevel property and drop forceCurrent flags
  // that no longer need to be exposed
  .map((spec, _, list) => Object.assign(spec, computeCurrentLevel(spec, list)))
  .map(spec => { delete spec.forceCurrent; return spec; })

  // Complete information with previous/next level links
  .map((spec, _, list) => Object.assign(spec, computePrevNext(spec, list)))

  // Complete information with title and link to TR/ED URLs, when known
  .map(spec => Object.assign(spec, specInfo[spec.name]));


if (require.main === module) {
  // Code used as command-line interface (CLI), output info about known specs.
  // If a parameter was provided, use it to find the right spec(s):
  // - if it's an integer, return the spec at that index in the list
  // - if parameter is full or delta, return specs with same level composition
  // - return specs that have the same URL, name or shortname otherwise
  // Otherwise, return the whole list
  const id = process.argv[2];
  if (id) {
    const res = id.match(/^\d+$/) ?
      [specs[parseInt(id, 10)]] :
      specs.filter(s =>
        s.url === id ||
        s.name === id ||
        s.shortname === id ||
        s.levelComposition === id ||
        s.title === id ||
        s.trUrl === id ||
        s.edUrl === id ||
        s.source === id);
    console.log(JSON.stringify(res.length === 1 ? res[0] : res, null, 2));
  }
  else {
    console.log(JSON.stringify(specs, null, 2));
  }
}
else {
  // Code referenced from another JS module, export
  module.exports = { specs };
}