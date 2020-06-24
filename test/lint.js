const assert = require("assert");
const { lintStr } = require("../src/lint.js");

describe("Linter", () => {
  describe("lintStr()", () => {
    function toStr(specs) {
      return JSON.stringify(specs, null, 2) + "\n";
    }

    it("passes if specs contains a valid URL", () => {
      const specs = ["https://www.w3.org/TR/spec/"];
      assert.equal(lintStr(toStr(specs)), null);
    });

    it("passes if specs contains multiple sorted URLs", () => {
      const specs = [
        "https://www.w3.org/TR/spec1/",
        "https://www.w3.org/TR/spec2/"
      ];
      assert.equal(lintStr(toStr(specs)), null);
    });

    it("passes if specs contains a URL with a delta spec", () => {
      const specs = [
        "https://www.w3.org/TR/spec-1/",
        "https://www.w3.org/TR/spec-2/ delta"
      ];
      assert.equal(lintStr(toStr(specs)), null);
    });

    it("passes if specs contains a URL with a spec flagged as current", () => {
      const specs = [
        "https://www.w3.org/TR/spec-1/ current",
        "https://www.w3.org/TR/spec-2/"
      ];
      assert.equal(lintStr(toStr(specs)), null);
    });

    it("passes if specs contains a URL with a spec flagged as multipage", () => {
      const specs = [
        "https://www.w3.org/TR/spec-1/ multipage"
      ];
      assert.equal(lintStr(toStr(specs)), null);
    });

    it("sorts URLs", () => {
      const specs = [
        "https://www.w3.org/TR/spec2/",
        "https://www.w3.org/TR/spec1/"
      ];
      assert.equal(
        lintStr(toStr(specs)),
        toStr([
          "https://www.w3.org/TR/spec1/",
          "https://www.w3.org/TR/spec2/"
        ]));
    });

    it("lints a URL", () => {
      const specs = [
        { "url": "https://example.org", "shortname": "test" }
      ];
      assert.equal(lintStr(toStr(specs)), toStr([
        { "url": "https://example.org/", "shortname": "test" }
      ]));
    });

    it("lints an object with only a URL to a URL", () => {
      const specs = [
        { "url": "https://www.w3.org/TR/spec/" }
      ];
      assert.equal(lintStr(toStr(specs)), toStr([
        "https://www.w3.org/TR/spec/"
      ]));
    });

    it("lints an object with only a URL and a delta flag to a string", () => {
      const specs = [
        "https://www.w3.org/TR/spec-1/",
        { "url": "https://www.w3.org/TR/spec-2/", seriesComposition: "delta" }
      ];
      assert.equal(lintStr(toStr(specs)), toStr([
        "https://www.w3.org/TR/spec-1/",
        "https://www.w3.org/TR/spec-2/ delta"
      ]));
    });

    it("lints an object with only a URL and a current flag to a string", () => {
      const specs = [
        { "url": "https://www.w3.org/TR/spec-1/", "forceCurrent": true },
        "https://www.w3.org/TR/spec-2/"
      ];
      assert.equal(lintStr(toStr(specs)), toStr([
        "https://www.w3.org/TR/spec-1/ current",
        "https://www.w3.org/TR/spec-2/"
      ]));
    });

    it("lints an object with only a URL and a multipage flag to a string", () => {
      const specs = [
        { "url": "https://www.w3.org/TR/spec-1/", "multipage": true }
      ];
      assert.equal(lintStr(toStr(specs)), toStr([
        "https://www.w3.org/TR/spec-1/ multipage"
      ]));
    });

    it("lints an object with a useless current flag", () => {
      const specs = [
        "https://www.w3.org/TR/spec/ current"
      ];
      assert.equal(lintStr(toStr(specs)), toStr([
        "https://www.w3.org/TR/spec/"
      ]));
    });

    it("lints an object with a useless current flag (delta version)", () => {
      const specs = [
        "https://www.w3.org/TR/spec-1/ current",
        "https://www.w3.org/TR/spec-2/ delta"
      ];
      assert.equal(lintStr(toStr(specs)), toStr([
        "https://www.w3.org/TR/spec-1/",
        "https://www.w3.org/TR/spec-2/ delta",
      ]));
    });

    it("lints an object with a 'full' flag", () => {
      const specs = [
        { "url": "https://www.w3.org/TR/spec/", "seriesComposition": "full" }
      ];
      assert.equal(lintStr(toStr(specs)), toStr([
        "https://www.w3.org/TR/spec/"
      ]));
    });

    it("lints an object with a current flag set to false", () => {
      const specs = [
        { "url": "https://www.w3.org/TR/spec/", "forceCurrent": false }
      ];
      assert.equal(lintStr(toStr(specs)), toStr([
        "https://www.w3.org/TR/spec/"
      ]));
    });

    it("lints an object with a multipage flag set to false", () => {
      const specs = [
        { "url": "https://www.w3.org/TR/spec/", "multipage": false }
      ];
      assert.equal(lintStr(toStr(specs)), toStr([
        "https://www.w3.org/TR/spec/"
      ]));
    });

    it("drops duplicate URLs", () => {
      const specs = [
        "https://www.w3.org/TR/duplicate/",
        "https://www.w3.org/TR/duplicate/"
      ];
      assert.equal(
        lintStr(toStr(specs)),
        toStr(["https://www.w3.org/TR/duplicate/"]));
    });

    it("drops duplicate URLs defined as string and object", () => {
      const specs = [
        { "url": "https://www.w3.org/TR/duplicate/" },
        "https://www.w3.org/TR/duplicate/"
      ];
      assert.equal(
        lintStr(toStr(specs)),
        toStr(["https://www.w3.org/TR/duplicate/"]));
    });
  });
});
