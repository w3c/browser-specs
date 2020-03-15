"use strict";

const computeShortname = require("./src/compute-shortname.js");

const specs = require("./specs.json")
  .map(spec => (typeof spec === "string") ? { url: spec } : spec)
  .map(spec => Object.assign({ "url": spec.url }, computeShortname(spec.name || spec.url), spec));

module.exports = { specs };
