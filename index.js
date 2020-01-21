"use strict";

const isString = obj =>
  Object.prototype.toString.call(obj) === "[object String]";

const specs = require("./specs.json")
  .map(spec => isString(spec) ? { url: spec } : spec);

module.exports = { specs };
