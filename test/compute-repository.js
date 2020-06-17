const assert = require("assert");
const computeRepo = require("../src/compute-repository.js");

describe("compute-repository module", () => {
  it("handles xxx.github.io URLs", () => {
    assert.equal(
      computeRepo("https://orgname.github.io/specname"),
      "https://github.com/orgname/specname");
  });

  it("handles xxx.github.io URLs with trailing slash", () => {
    assert.equal(
      computeRepo("https://orgname.github.io/specname/"),
      "https://github.com/orgname/specname");
  });

  it("handles WHATWG URLs", () => {
    assert.equal(
      computeRepo("https://specname.spec.whatwg.org/"),
      "https://github.com/whatwg/specname");
  });

  it("handles CSS WG URLs", () => {
    assert.equal(
      computeRepo("https://drafts.csswg.org/css-everything-42/"),
      "https://github.com/w3c/csswg-drafts");
  });

  it("handles FX TF URLs", () => {
    assert.equal(
      computeRepo("https://drafts.fxtf.org/wow/"),
      "https://github.com/w3c/fxtf-drafts");
  });

  it("handles CSS Houdini URLs", () => {
    assert.equal(
      computeRepo("https://drafts.css-houdini.org/magic-11/"),
      "https://github.com/w3c/css-houdini-drafts");
  });

  it("handles SVG WG URLs", () => {
    assert.equal(
      computeRepo("https://svgwg.org/specs/svg-ftw"),
      "https://github.com/w3c/svgwg");
  });

  it("handles the SVG2 URL", () => {
    assert.equal(
      computeRepo("https://svgwg.org/svg2-draft/"),
      "https://github.com/w3c/svgwg");
  });

  it("handles WebGL URLs", () => {
    assert.equal(
      computeRepo("https://www.khronos.org/registry/webgl/specs/latest/1.0/"),
      "https://github.com/KhronosGroup/WebGL");
  });

  it("returns null when repository cannot be derived from URL", () => {
    assert.equal(
      computeRepo("https://example.net/repoless"),
      null);
  });
});