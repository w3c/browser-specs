"use strict";

const computeShortname = require("./src/compute-shortname.js");
const computePrevNext = require("./src/compute-prevnext.js");
const computeCurrentLevel = require("./src/compute-currentlevel.js");

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

  // Complete information with currentLevel property
  .map((spec, _, list) => Object.assign(spec, computeCurrentLevel(spec, list)))

  // Complete information with previous/next level links
  .map((spec, _, list) => Object.assign(spec, computePrevNext(spec, list)));

module.exports = { specs };
