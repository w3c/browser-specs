/**
 * Tests for the fetch-info module that require a W3C API key
 *
 * These tests are separated from the tests that do not require a W3C API key
 * because the key cannot be exposed on pull requests from forked repositories
 * on GitHub.
 */ 

const assert = require("assert");
const fetchInfo = require("../src/fetch-info.js");

const w3cApiKey = (function () {
  try {
    return require("../config.json").w3cApiKey;
  }
  catch (err) {
    return null;
  }
})();


describe("fetch-info module (with W3C API key)", function () {
  // Tests need to send network requests
  this.slow(5000);
  this.timeout(30000);

  function getW3CSpec(shortname) {
    return { shortname, url: `https://www.w3.org/TR/${shortname}/` };
  }

  describe("W3C API key", () => {
    it("is defined otherwise tests cannot pass", () => {
      assert.ok(w3cApiKey);
    });
  });


  describe("fetch from W3C API", () => {
    it("works on a TR spec", async () => {
      const spec = getW3CSpec("hr-time-2");
      const info = await fetchInfo([spec], { w3cApiKey });
      assert.ok(info[spec.shortname]);
      assert.equal(info[spec.shortname].source, "w3c");
      assert.equal(info[spec.shortname].release.url, spec.url);
      assert.equal(info[spec.shortname].nightly.url, "https://w3c.github.io/hr-time/");
      assert.equal(info[spec.shortname].title, "High Resolution Time Level 2");
    });

    it("can operate on multiple specs at once", async () => {
      const spec = getW3CSpec("hr-time-2");
      const other = getW3CSpec("presentation-api");
      const info = await fetchInfo([spec, other], { w3cApiKey });
      assert.ok(info[spec.shortname]);
      assert.equal(info[spec.shortname].source, "w3c");
      assert.equal(info[spec.shortname].release.url, spec.url);
      assert.equal(info[spec.shortname].nightly.url, "https://w3c.github.io/hr-time/");
      assert.equal(info[spec.shortname].title, "High Resolution Time Level 2");

      assert.ok(info[other.shortname]);
      assert.equal(info[other.shortname].source, "w3c");
      assert.equal(info[other.shortname].release.url, other.url);
      assert.equal(info[other.shortname].nightly.url, "https://w3c.github.io/presentation-api/");
      assert.equal(info[other.shortname].title, "Presentation API");
    });

    it("throws when W3C API key is invalid", async () => {
      assert.rejects(
        fetchInfo([getW3CSpec("selectors-3")], { w3cApiKey: "invalid" }),
        /^W3C API returned an error, status code is 403$/);
    });
  });


  describe("fetch from Specref", () => {
    it("works on a WHATWG spec", async () => {
      const spec = {
        url: "https://dom.spec.whatwg.org/",
        shortname: "dom"
      };
      const info = await fetchInfo([spec], { w3cApiKey });
      assert.ok(info[spec.shortname]);
      assert.equal(info[spec.shortname].source, "specref");
      assert.equal(info[spec.shortname].nightly.url, "https://dom.spec.whatwg.org/");
      assert.equal(info[spec.shortname].title, "DOM Standard");
    });
  });


  describe("fetch from all sources", () => {
    it("merges info from sources", async () => {
      const w3c = getW3CSpec("presentation-api");
      const whatwg = {
        url: "https://html.spec.whatwg.org/multipage/",
        shortname: "html"
      };
      const other = {
        url: "https://tabatkins.github.io/bikeshed/",
        shortname: "bikeshed"
      };
      const info = await fetchInfo([w3c, whatwg, other], { w3cApiKey });
      assert.ok(info[w3c.shortname]);
      assert.equal(info[w3c.shortname].source, "w3c");
      assert.equal(info[w3c.shortname].release.url, w3c.url);
      assert.equal(info[w3c.shortname].nightly.url, "https://w3c.github.io/presentation-api/");
      assert.equal(info[w3c.shortname].title, "Presentation API");

      assert.ok(info[whatwg.shortname]);
      assert.equal(info[whatwg.shortname].source, "specref");
      assert.equal(info[whatwg.shortname].nightly.url, whatwg.url);
      assert.equal(info[whatwg.shortname].title, "HTML Standard");

      assert.ok(info[other.shortname]);
      assert.equal(info[other.shortname].source, "spec");
      assert.equal(info[other.shortname].nightly.url, other.url);
      assert.equal(info[other.shortname].title, "Bikeshed Documentation");      
    });
  });
});