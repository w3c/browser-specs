const assert = require("assert");
const computeRepo = require("../src/compute-repository.js");

describe("compute-repository module", async () => {
  async function computeSingleRepo(url) {
    const spec = { nightly: { url } };
    const result = await computeRepo([spec]);
    return result[0].nightly.repository;
  };

  it("handles github.com URLs", async () => {
    assert.equal(
      await computeSingleRepo("https://github.com/orgname/specname"),
      "https://github.com/orgname/specname");
  });

  it("handles xxx.github.io URLs", async () => {
    assert.equal(
      await computeSingleRepo("https://orgname.github.io/specname"),
      "https://github.com/orgname/specname");
  });

  it("handles xxx.github.io URLs with trailing slash", async () => {
    assert.equal(
      await computeSingleRepo("https://orgname.github.io/specname/"),
      "https://github.com/orgname/specname");
  });

  it("handles WHATWG URLs", async () => {
    assert.equal(
      await computeSingleRepo("https://specname.spec.whatwg.org/"),
      "https://github.com/whatwg/specname");
  });

  it("handles TC39 URLs", async () => {
    assert.equal(
      await computeSingleRepo("https://tc39.es/js-ftw/"),
      "https://github.com/tc39/js-ftw");
  });

  it("handles CSS WG URLs", async () => {
    assert.equal(
      await computeSingleRepo("https://drafts.csswg.org/css-everything-42/"),
      "https://github.com/w3c/csswg-drafts");
  });

  it("handles FX TF URLs", async () => {
    assert.equal(
      await computeSingleRepo("https://drafts.fxtf.org/wow/"),
      "https://github.com/w3c/fxtf-drafts");
  });

  it("handles CSS Houdini URLs", async () => {
    assert.equal(
      await computeSingleRepo("https://drafts.css-houdini.org/magic-11/"),
      "https://github.com/w3c/css-houdini-drafts");
  });

  it("handles SVG WG URLs", async () => {
    assert.equal(
      await computeSingleRepo("https://svgwg.org/specs/svg-ftw"),
      "https://github.com/w3c/svgwg");
  });

  it("handles the SVG2 URL", async () => {
    assert.equal(
      await computeSingleRepo("https://svgwg.org/svg2-draft/"),
      "https://github.com/w3c/svgwg");
  });

  it("handles WebGL URLs", async () => {
    assert.equal(
      await computeSingleRepo("https://registry.khronos.org/webgl/specs/latest/1.0/"),
      "https://github.com/khronosgroup/WebGL");
  });

  it("returns null when repository cannot be derived from URL", async () => {
    assert.equal(
      await computeSingleRepo("https://example.net/repoless"),
      null);
  });
});
