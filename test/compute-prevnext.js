const assert = require("assert");
const computePrevNext = require("../src/compute-prevnext.js");

describe("compute-prevnext module", () => {
  function getSpec(seriesVersion) {
    if (seriesVersion) {
      return {
        shortname: `spec-${seriesVersion}`,
        series: { shortname: "spec" },
        seriesVersion
      };
    }
    else {
      return {
        shortname: `spec-${seriesVersion}`,
        series: { shortname: "spec" }
      };
    }
  }
  function getOther(seriesVersion) {
    if (seriesVersion) {
      return {
        shortname: `other-${seriesVersion}`,
        series: { shortname: "other" },
        seriesVersion
      };
    }
    else {
      return {
        shortname: `other-${seriesVersion}`,
        series: { shortname: "other" }
      };
    }
  }

  it("sets previous link if it exists", () => {
    const prev = getSpec("1");
    const spec = getSpec("2");
    assert.deepStrictEqual(
      computePrevNext(spec, [prev]),
      { seriesPrevious: prev.shortname });
  });

  it("sets next link if it exists", () => {
    const spec = getSpec("1");
    const next = getSpec("2");
    assert.deepStrictEqual(
      computePrevNext(spec, [next]),
      { seriesNext: next.shortname });
  });

  it("sets previous/next links when both exist", () => {
    const prev = getSpec("1");
    const spec = getSpec("2");
    const next = getSpec("3");
    assert.deepStrictEqual(
      computePrevNext(spec, [next, prev, spec]),
      { seriesPrevious: prev.shortname, seriesNext: next.shortname });
  });

  it("sets previous/next links when level are version numbers", () => {
    const prev = getSpec("1.1");
    const spec = getSpec("1.2");
    const next = getSpec("1.3");
    assert.deepStrictEqual(
      computePrevNext(spec, [next, prev, spec]),
      { seriesPrevious: prev.shortname, seriesNext: next.shortname });
  });

  it("selects the right previous level when multiple exist", () => {
    const old = getSpec("1");
    const prev = getSpec("2");
    const spec = getSpec("4");
    assert.deepStrictEqual(
      computePrevNext(spec, [spec, prev, old]),
      { seriesPrevious: prev.shortname });
  });

  it("selects the right next level when multiple exist", () => {
    const spec = getSpec("1");
    const next = getSpec("2");
    const last = getSpec("3");
    assert.deepStrictEqual(
      computePrevNext(spec, [spec, last, next]),
      { seriesNext: next.shortname });
  });

  it("considers absence of level to be level 0", () => {
    const spec = getSpec();
    const next = getSpec("1");
    assert.deepStrictEqual(
      computePrevNext(spec, [next]),
      { seriesNext: next.shortname });
  });

  it("is not affected by presence of other specs", () => {
    const prev = getSpec("1");
    const spec = getSpec("3");
    const next = getSpec("5");
    assert.deepStrictEqual(
      computePrevNext(spec, [next, getOther("2"), spec, getOther("4"), prev]),
      { seriesPrevious: prev.shortname, seriesNext: next.shortname });
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
    const spec = getSpec("2");
    assert.deepStrictEqual(
      computePrevNext(spec, [getOther("1"), spec, getOther("3")]), {});
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