/**
 * Tests for the fetch-groups module that require a W3C API key
 *
 * These tests are separated from the tests that do not require a W3C API key
 * because the key cannot be exposed on pull requests from forked repositories
 * on GitHub.
 */ 

const assert = require("assert");
const fetchGroups = require("../src/fetch-groups.js");

const githubToken = (function () {
  try {
    return require("../config.json").GH_TOKEN;
  }
  catch (err) {
    return null;
  }
})() ?? process.env.GH_TOKEN;

const w3cApiKey = (function () {
  try {
    return require("../config.json").w3cApiKey;
  }
  catch (err) {
    return null;
  }
})() ?? process.env.W3C_API_KEY;


describe("fetch-groups module (with API keys)", function () {
  // Tests need to send network requests
  this.slow(5000);
  this.timeout(30000);

  async function fetchGroupsFor(url, options) {
    const spec = { url };
    const result = await fetchGroups([spec], options);
    return result[0];
  };

  describe("W3C API key", () => {
    it("is defined otherwise tests cannot pass", () => {
      assert.ok(w3cApiKey);
    });
  });


  describe("fetch from W3C API", () => {
    it("handles /TR URLs", async () => {
      const res = await fetchGroupsFor("https://www.w3.org/TR/gamepad/", { w3cApiKey });
      assert.equal(res.organization, "W3C");
      assert.deepStrictEqual(res.groups, [{
        name: "Web Applications Working Group",
        url: "https://www.w3.org/groups/wg/webapps"
      }]);
    });

    it("handles multiple /TR URLs", async () => {
      const specs = [
        { url: "https://www.w3.org/TR/gamepad/" },
        { url: "https://www.w3.org/TR/accname-1.2/" }
      ];
      const res = await fetchGroups(specs, { w3cApiKey });
      assert.equal(res[0].organization, "W3C");
      assert.deepStrictEqual(res[0].groups, [{
        name: "Web Applications Working Group",
        url: "https://www.w3.org/groups/wg/webapps"
      }]);
      assert.equal(res[1].organization, "W3C");
      assert.deepStrictEqual(res[1].groups, [{
        name: "Accessible Rich Internet Applications Working Group",
        url: "https://www.w3.org/WAI/ARIA/"
      }]);
    });

    it("handles w3c.github.io URLs", async () => {
      const res = await fetchGroupsFor("https://w3c.github.io/web-nfc/", { githubToken, w3cApiKey });
      assert.equal(res.organization, "W3C");
      assert.deepStrictEqual(res.groups, [{
        name: "Web NFC Community Group",
        url: "https://www.w3.org/community/web-nfc/"
      }]);
    });

    it("handles SVG URLs", async () => {
      const res = await fetchGroupsFor("https://svgwg.org/specs/animations/", { w3cApiKey });
      assert.equal(res.organization, "W3C");
      assert.deepStrictEqual(res.groups, [{
        name: "SVG Working Group",
        url: "https://www.w3.org/Graphics/SVG/WG/"
      }]);
    });

    it("handles CSS WG URLs", async () => {
      const res = await fetchGroupsFor("https://drafts.csswg.org/css-animations-2/", { w3cApiKey });
      assert.equal(res.organization, "W3C");
      assert.deepStrictEqual(res.groups, [{
        name: "Cascading Style Sheets (CSS) Working Group",
        url: "https://www.w3.org/Style/CSS/"
      }]);
    });

    it("handles CSS Houdini TF URLs", async () => {
      const res = await fetchGroupsFor("https://drafts.css-houdini.org/css-typed-om-2/", { w3cApiKey });
      assert.equal(res.organization, "W3C");
      assert.deepStrictEqual(res.groups, [{
        name: "Cascading Style Sheets (CSS) Working Group",
        url: "https://www.w3.org/Style/CSS/"
      }]);
    });

    it("handles CSS FXTF URLs", async () => {
      const res = await fetchGroupsFor("https://drafts.fxtf.org/filter-effects-2/", { w3cApiKey });
      assert.equal(res.organization, "W3C");
      assert.deepStrictEqual(res.groups, [{
        name: "Cascading Style Sheets (CSS) Working Group",
        url: "https://www.w3.org/Style/CSS/"
      }]);
    });
  });
});