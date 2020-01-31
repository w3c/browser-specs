"use strict";

const specs = require("./specs.json")
  .map(spec => (typeof spec === "string") ? { url: spec } : spec);

module.exports = { specs };
