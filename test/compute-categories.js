const assert = require("assert");
const computeCategories = require("../src/compute-categories.js");

describe("compute-categories module", () => {
  it("sets `browser` category when group targets browsers", function () {
    const spec = {
      groups: [ { name: "Web Applications Working Group" } ]
    };
    assert.deepStrictEqual(computeCategories(spec), ["browser"]);
  });

  it("sets `browser` category when one of the groups targets browsers", function () {
    const spec = {
      groups: [
        { name: "Accessible Platform Architectures Working Group" },
        { name: "Web Applications Working Group" }
      ]
    };
    assert.deepStrictEqual(computeCategories(spec), ["browser"]);
  });

  it("does not set a `browser` category when group does not target browsers", function () {
    const spec = {
      groups: [ { name: "Accessible Platform Architectures Working Group" } ]
    };
    assert.deepStrictEqual(computeCategories(spec), []);
  });

  it("does not set a `browser` category when all groups does not target browsers", function () {
    const spec = {
      groups: [ { name: "Accessible Platform Architectures Working Group" } ]
    };
    assert.deepStrictEqual(computeCategories(spec), []);
  });

  it("resets categories when asked to", function () {
    const spec = {
      groups: [ { name: "Web Applications Working Group" } ],
      categories: "reset"
    };
    assert.deepStrictEqual(computeCategories(spec), []);
  });

  it("drops browser when asked to", function () {
    const spec = {
      groups: [ { name: "Web Applications Working Group" } ],
      categories: "-browser"
    };
    assert.deepStrictEqual(computeCategories(spec), []);
  });

  it("adds browser when asked to", function () {
    const spec = {
      groups: [ { name: "Accessible Platform Architectures Working Group" } ],
      categories: "+browser"
    };
    assert.deepStrictEqual(computeCategories(spec), ["browser"]);
  });

  it("accepts an array of categories", function () {
    const spec = {
      groups: [ { name: "Accessible Platform Architectures Working Group" } ],
      categories: ["reset", "+browser"]
    };
    assert.deepStrictEqual(computeCategories(spec), ["browser"]);
  });

  it("throws if spec object is empty", () => {
    assert.throws(
      () => computeCategories({}),
      /^Invalid spec object passed as parameter$/);
  });

  it("throws if spec object does not have a groups property", () => {
    assert.throws(
      () => computeCategories({ url: "https://example.org/" }),
      /^Invalid spec object passed as parameter$/);
  });
});