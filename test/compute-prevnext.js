const assert = require("assert");
const computePrevNext = require("../src/compute-prevnext.js");

describe("compute-prevnext module", () => {
  function getSpec(level) {
    if (level) {
      return {
        name: `spec-${level}`,
        shortname: "spec",
        level
      };
    }
    else {
      return {
        name: `spec-${level}`,
        shortname: "spec"
      };
    }
  }
  function getOther(level) {
    if (level) {
      return {
        name: `other-${level}`,
        shortname: "other",
        level
      };
    }
    else {
      return {
        name: `other-${level}`,
        shortname: "other"
      };
    }
  }

  it("sets previous link if it exists", () => {
    const prev = getSpec(1);
    const spec = getSpec(2);
    assert.deepStrictEqual(
      computePrevNext(spec, [prev]),
      { previousLevel: prev.name });
  });

  it("sets next link if it exists", () => {
    const spec = getSpec(1);
    const next = getSpec(2);
    assert.deepStrictEqual(
      computePrevNext(spec, [next]),
      { nextLevel: next.name });
  });

  it("sets previous/next links when both exist", () => {
    const prev = getSpec(1);
    const spec = getSpec(2);
    const next = getSpec(3);
    assert.deepStrictEqual(
      computePrevNext(spec, [next, prev, spec]),
      { previousLevel: prev.name, nextLevel: next.name });
  });

  it("sets previous/next links when level are version numbers", () => {
    const prev = getSpec(1.1);
    const spec = getSpec(1.2);
    const next = getSpec(1.3);
    assert.deepStrictEqual(
      computePrevNext(spec, [next, prev, spec]),
      { previousLevel: prev.name, nextLevel: next.name });
  });

  it("selects the right previous level when multiple exist", () => {
    const old = getSpec(1);
    const prev = getSpec(2);
    const spec = getSpec(4);
    assert.deepStrictEqual(
      computePrevNext(spec, [spec, prev, old]),
      { previousLevel: prev.name });
  });

  it("selects the right next level when multiple exist", () => {
    const spec = getSpec(1);
    const next = getSpec(2);
    const last = getSpec(3);
    assert.deepStrictEqual(
      computePrevNext(spec, [spec, last, next]),
      { nextLevel: next.name });
  });

  it("considers absence of level to be level 0", () => {
    const spec = getSpec();
    const next = getSpec(1);
    assert.deepStrictEqual(
      computePrevNext(spec, [next]),
      { nextLevel: next.name });
  });

  it("is not affected by presence of other specs", () => {
    const prev = getSpec(1);
    const spec = getSpec(3);
    const next = getSpec(5);
    assert.deepStrictEqual(
      computePrevNext(spec, [next, getOther(2), spec, getOther(4), prev]),
      { previousLevel: prev.name, nextLevel: next.name });
  });

  it("returns an empty object if list is empty", () => {
    const spec = getSpec();
    assert.deepStrictEqual(computePrevNext(spec), {});
  });

  it("returns an empty object if list is the spec to check", () => {
    const spec = getSpec();
    assert.deepStrictEqual(computePrevNext(spec, [spec]), {});
  });

  it("returns an empty object in absence of other levels", () => {
    const spec = getSpec(2);
    assert.deepStrictEqual(
      computePrevNext(spec, [getOther(1), spec, getOther(3)]), {});
  });

  it("throws if spec object is not given", () => {
    assert.throws(
      () => computePrevNext(),
      /^Invalid spec object passed as parameter$/);
  });

  it("throws if spec object is empty", () => {
    assert.throws(
      () => computePrevNext({}),
      /^Invalid spec object passed as parameter$/);
  });

  it("throws if spec object does not have a name", () => {
    assert.throws(
      () => computePrevNext({ shortname: "spec" }),
      /^Invalid spec object passed as parameter$/);
  });

  it("throws if spec object does not have a shortname", () => {
    assert.throws(
      () => computePrevNext({ name: "spec" }),
      /^Invalid spec object passed as parameter$/);
  });
});