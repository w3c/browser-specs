import assert from "node:assert";
import computeCurrentLevel from "../src/compute-currentlevel.js";

describe("compute-currentlevel module", () => {
  function getCurrentName(spec, list) {
    return computeCurrentLevel(spec, list).currentSpecification;
  }
  function getSpec(options) {
    options = options || {};
    const res = {
      shortname: options.shortname ?? (options.seriesVersion ? `spec-${options.seriesVersion}` : "spec"),
      series: { shortname: "spec" },
    };
    for (const property of Object.keys(options)) {
      res[property] = options[property];
    }
    return res;
  }
  function getOther(options) {
    options = options || {};
    const res = {
      shortname: (options.seriesVersion ? `other-${options.seriesVersion}` : "other"),
      series: { shortname: "other" },
    };
    for (const property of Object.keys(options)) {
      res[property] = options[property];
    }
    return res;
  }

  it("returns the spec name if list is empty", () => {
    const spec = getSpec();
    assert.equal(getCurrentName(spec), spec.shortname);
  });

  it("returns the name of the latest level", () => {
    const spec = getSpec({ seriesVersion: "1" });
    const current = getSpec({ seriesVersion: "2" });
    assert.equal(
      getCurrentName(spec, [spec, current]),
      current.shortname);
  });

  it("returns the name of the latest level that is not a delta spec", () => {
    const spec = getSpec({ seriesVersion: "1" });
    const delta = getSpec({ seriesVersion: "2", seriesComposition: "delta" });
    assert.equal(
      getCurrentName(spec, [spec, delta]),
      spec.shortname);
  });

  it("returns the name of the latest level that is not a fork spec", () => {
    const spec = getSpec({ seriesVersion: "1" });
    const fork = getSpec({ seriesVersion: "2", seriesComposition: "fork" });
    assert.equal(
      getCurrentName(spec, [spec, fork]),
      spec.shortname);
  });

  it("gets back to the latest level when spec is a delta spec", () => {
    const spec = getSpec({ seriesVersion: "1" });
    const delta = getSpec({ seriesVersion: "2", seriesComposition: "delta" });
    assert.equal(
      getCurrentName(delta, [spec, delta]),
      spec.shortname);
  });

  it("gets back to the latest level when spec is a fork spec", () => {
    const spec = getSpec({ seriesVersion: "1" });
    const fork = getSpec({ seriesVersion: "2", seriesComposition: "fork" });
    assert.equal(
      getCurrentName(fork, [spec, fork]),
      spec.shortname);
  });

  it("returns the spec name if it is flagged as current", () => {
    const spec = getSpec({ seriesVersion: "1", forceCurrent: true });
    const last = getSpec({ seriesVersion: "2" });
    assert.equal(
      getCurrentName(spec, [spec, last]),
      spec.shortname);
  });

  it("returns the name of the level flagged as current", () => {
    const spec = getSpec({ seriesVersion: "1" });
    const current = getSpec({ seriesVersion: "2", forceCurrent: true });
    const last = getSpec({ seriesVersion: "3" });
    assert.equal(
      getCurrentName(spec, [spec, current, last]),
      current.shortname);
  });

  it("does not take other shortnames into account", () => {
    const spec = getSpec({ seriesVersion: "1" });
    const other = getOther({ seriesVersion: "2"});
    assert.equal(
      getCurrentName(spec, [spec, other]),
      spec.shortname);
  });

  it("does not take forks into account", () => {
    const spec = getSpec({ shortname: "spec-1-fork-1", seriesVersion: "1", seriesComposition: "fork" });
    const base = getSpec({ seriesVersion: "1" });
    assert.equal(
      getCurrentName(spec, [spec, base]),
      base.shortname);
  });
});