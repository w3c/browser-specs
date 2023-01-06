const assert = require("assert");
const computeCategories = require("../src/compute-categories.js");

describe("compute-categories module", () => {
  it("sets `browser` category when group targets browsers", function () {
    const spec = {
      groups: [ { name: "Web Applications Working Group" } ],
      nightly: { status: "Working Draft" }
    };
    assert.deepStrictEqual(computeCategories(spec), ["browser"]);
  });

  it("sets `browser` category when one of the groups targets browsers", function () {
    const spec = {
      groups: [
        { name: "Accessible Platform Architectures Working Group" },
        { name: "Web Applications Working Group" }
      ],
      nightly: { status: "Working Draft" }
    };
    assert.deepStrictEqual(computeCategories(spec), ["browser"]);
  });

  it("does not set a `browser` category when group does not target browsers", function () {
    const spec = {
      groups: [ { name: "Accessible Platform Architectures Working Group" } ],
      nightly: { status: "Working Draft" }
    };
    assert.deepStrictEqual(computeCategories(spec), []);
  });

  it("does not set a `browser` category when all groups does not target browsers", function () {
    const spec = {
      groups: [ { name: "Accessible Platform Architectures Working Group" } ],
      nightly: { status: "Working Draft" }
    };
    assert.deepStrictEqual(computeCategories(spec), []);
  });

  it("resets categories when asked to", function () {
    const spec = {
      groups: [ { name: "Web Applications Working Group" } ],
      nightly: { status: "Unofficial Proposal Draft" },
      categories: "reset"
    };
    assert.deepStrictEqual(computeCategories(spec), []);
  });

  it("drops `browser` when asked to", function () {
    const spec = {
      groups: [ { name: "Web Applications Working Group" } ],
      nightly: { status: "Working Draft" },
      categories: "-browser"
    };
    assert.deepStrictEqual(computeCategories(spec), []);
  });

  it("adds `browser` when asked to", function () {
    const spec = {
      groups: [ { name: "Accessible Platform Architectures Working Group" } ],
      nightly: { status: "Working Draft" },
      categories: "+browser"
    };
    assert.deepStrictEqual(computeCategories(spec), ["browser"]);
  });

  it("accepts an array of categories", function () {
    const spec = {
      groups: [ { name: "Accessible Platform Architectures Working Group" } ],
      nightly: { status: "Working Draft" },
      categories: ["reset", "+browser"]
    };
    assert.deepStrictEqual(computeCategories(spec), ["browser"]);
  });

  it("sets `unofficial` category for a collection of interesting ideas", function () {
    const spec = {
      groups: [ { name: "Advisory Board" } ],
      nightly: { status: "A Collection of Interesting Ideas" }
    };
    assert.deepStrictEqual(computeCategories(spec), ["unofficial"]);
  });

  it("sets `unofficial` category for an unofficial proposal draft", function () {
    const spec = {
      groups: [ { name: "Advisory Board" } ],
      nightly: { status: "Unofficial Proposal Draft" }
    };
    assert.deepStrictEqual(computeCategories(spec), ["unofficial"]);
  });

  it("drops `unofficial` when asked to", function () {
    const spec = {
      groups: [ { name: "Advisory Board" } ],
      nightly: { status: "Unofficial Proposal Draft" },
      categories: "-unofficial"
    };
    assert.deepStrictEqual(computeCategories(spec), []);
  });

  it("adds `unofficial` when asked to", function () {
    const spec = {
      groups: [ { name: "Advisory Board" } ],
      nightly: { status: "Working Draft" },
      categories: "+unofficial"
    };
    assert.deepStrictEqual(computeCategories(spec), ["unofficial"]);
  });

  it("sets both `browser` and `unofficial` when needed", function () {
    const spec = {
      groups: [ { name: "CSS Working Group" } ],
      nightly: { status: "A Collection of Interesting Ideas" }
    };
    assert.deepStrictEqual(computeCategories(spec), ["browser", "unofficial"]);
  });

  it("throws if spec object is empty", () => {
    assert.throws(
      () => computeCategories({}),
      /^Invalid spec object passed as parameter$/);
  });

  it("throws if spec object does not have a groups property", () => {
    assert.throws(
      () => computeCategories({
        url: "https://example.org/",
        nightly: { status: "Working Draft" }
      }),
      /^Invalid spec object passed as parameter$/);
  });

  it("throws if spec object does not have a nightly.status property", () => {
    assert.throws(
      () => computeCategories({
        url: "https://example.org/",
        groups: [ { name: "Web Applications Working Group" } ],
      }),
      /^Invalid spec object passed as parameter$/);
  });
});