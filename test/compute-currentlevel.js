const assert = require("assert");
const computeCurrentLevel = require("../src/compute-currentlevel.js");

describe("compute-currentlevel module", () => {
  function getCurrentName(spec, list) {
    return computeCurrentLevel(spec, list).currentLevel;
  }
  function getSpec(options) {
    options = options || {};
    const res = {
      name: (options.level ? `spec-${options.level}` : "spec"),
      shortname: "spec",
    };
    for (const property of Object.keys(options)) {
      res[property] = options[property];
    }
    return res;
  }
  function getOther(options) {
    options = options || {};
    const res = {
      name: (options.level ? `other-${options.level}` : "other"),
      shortname: "other",
    };
    for (const property of Object.keys(options)) {
      res[property] = options[property];
    }
    return res;
  }

  it("returns the spec name if list is empty", () => {
    const spec = getSpec();
    assert.equal(getCurrentName(spec), spec.name);
  });

  it("returns the name of the latest level", () => {
    const spec = getSpec({ level: 1 });
    const current = getSpec({ level: 2 });
    assert.equal(
      getCurrentName(spec, [spec, current]),
      current.name);
  });

  it("returns the name of the latest level that is not a delta spec", () => {
    const spec = getSpec({ level: 1 });
    const delta = getSpec({ level: 2, levelComposition: "delta" });
    assert.equal(
      getCurrentName(spec, [spec, delta]),
      spec.name);
  });

  it("gets back to the latest level when spec is a delta spec", () => {
    const spec = getSpec({ level: 1 });
    const delta = getSpec({ level: 2, levelComposition: "delta" });
    assert.equal(
      getCurrentName(delta, [spec, delta]),
      spec.name);
  });

  it("returns the spec name if it is flagged as current", () => {
    const spec = getSpec({ level: 1, forceCurrent: true });
    const last = getSpec({ level: 2 });
    assert.equal(
      getCurrentName(spec, [spec, last]),
      spec.name);
  });

  it("returns the name of the level flagged as current", () => {
    const spec = getSpec({ level: 1 });
    const current = getSpec({ level: 2, forceCurrent: true });
    const last = getSpec({ level: 3 });
    assert.equal(
      getCurrentName(spec, [spec, current, last]),
      current.name);
  });

  it("does not take other shortnames into account", () => {
    const spec = getSpec({ level: 1 });
    const other = getOther({ level : 2});
    assert.equal(
      getCurrentName(spec, [spec, other]),
      spec.name);
  });
});