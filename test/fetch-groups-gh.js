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

describe("fetch-groups module", function () {
  // Tests need to send network requests
  this.slow(5000);
  this.timeout(30000);

  async function fetchGroupsFor(url, options) {
    const spec = { url };
    const result = await fetchGroups([spec], options);
    return result[0];
  };

  describe("fetch from w3c.github.io with W3C API", () => {
    it("handles w3c.github.io URLs", async () => {
      const res = await fetchGroupsFor("https://w3c.github.io/web-nfc/", { githubToken });
      assert.equal(res.organization, "W3C");
      assert.deepStrictEqual(res.groups, [{
        name: "Web NFC Community Group",
        url: "https://www.w3.org/community/web-nfc/"
      }]);
    });

  });
});
