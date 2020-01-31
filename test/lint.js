const assert = require("assert");
const { lintStr } = require("../lint.js");

describe("Linter", () => {
  describe("lintStr()", () => {
    function toStr(specs) {
      return JSON.stringify(specs, null, 2) + "\n";
    }

    it("passes if specs contains a valid URL", () => {
      const specs = ["https://example.org/"];
      assert.equal(lintStr(toStr(specs)), null);
    });

    it("passes if specs contains multiple sorted URLs", () => {
      const specs = ["https://example.com/", "https://example.org/"];
      assert.equal(lintStr(toStr(specs)), null);
    });

    it("sorts URLs", () => {
      const specs = ["https://example.org/", "https://example.com/"];
      assert.equal(
        lintStr(toStr(specs)),
        toStr(["https://example.com/", "https://example.org/"]));
    });

    it("lints a URL", () => {
      const specs = ["https://example.org"];
      assert.equal(lintStr(toStr(specs)), toStr(["https://example.org/"]));
    });

    it("lints an object with only a URL to a URL", () => {
      const specs = [{ "url": "https://example.org/" }];
      assert.equal(lintStr(toStr(specs)), toStr(["https://example.org/"]));
    });

    it("throws if specs is not an array", () => {
      const specs = 0;
      assert.throws(
        () => lintStr(toStr(specs)),
        /^specs should be array$/);
    });

    it("throws if specs is an empty array", () => {
      const specs = [];
      assert.throws(
        () => lintStr(toStr(specs)),
        /^specs should NOT have fewer than 1 items$/);
    });

    it("throws if specs contains an item with a wrong type", () => {
      const specs = [0];
      assert.throws(
        () => lintStr(toStr(specs)),
        /^specs\[0\] should be a string or an object$/);
    });

    it("throws if specs contains an invalid URL", () => {
      const specs = ["invalid"];
      assert.throws(
        () => lintStr(toStr(specs)),
        /^specs\[0\] should match format "uri"$/);
    });

    it("throws if specs contains an object without URL", () => {
      const specs = [{}];
      assert.throws(
        () => lintStr(toStr(specs)),
        /^specs\[0\] should have required property 'url'$/);
    });

    it("throws if specs contains an object with an invalid URL", () => {
      const specs = [{ url: "invalid" }];
      assert.throws(
        () => lintStr(toStr(specs)),
        /^specs\[0\]\.url should match format "uri"$/);
    });

    it("throws if specs contains an object with additional properties", () => {
      const specs = [{ url: "https://example.org/", invalid: "test" }];
      assert.throws(
        () => lintStr(toStr(specs)),
        /^specs\[0\] should not have additional property 'invalid'$/);
    });
  });
});
