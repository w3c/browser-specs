"use strict";

const computeShortname = require("./src/compute-shortname.js");
const computePrevNext = require("./src/compute-prevnext.js");

const specs = require("./specs.json")
  // Turn all specs into objects
  // (and handle syntactic sugar notation for "delta" flag)
  .map(spec => {
    if (typeof spec === "string") {
      if (spec.split(" ")[1] === "delta") {
        return { url: spec.split(" ")[0], delta: true };
      }
      else {
        return { url: spec };
      }
    }
    else {
      return spec;
    }
  })

  // Complete information and output result starting with the URL, names,
  // level, and additional info
  .map(spec => Object.assign(
    { "url": spec.url },
    computeShortname(spec.name || spec.url),
    spec))

  // Complete information with previous/next level links
  .map((spec, _, list) => Object.assign(spec, computePrevNext(spec, list)));

module.exports = { specs };
