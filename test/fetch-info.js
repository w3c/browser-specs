/**
 * Tests for the fetch-info module that do not require a W3C API key
 *
 * These tests are separated from the tests that require a W3C API key because
 * the key cannot be exposed on pull requests from forked repositories on
 * GitHub.
 */

const assert = require("assert");
const fetchInfo = require("../src/fetch-info.js");

describe("fetch-info module (without W3C API key)", function () {
  // Tests need to send network requests
  this.slow(5000);
  this.timeout(30000);

  function getW3CSpec(name) {
    return { name, url: `https://www.w3.org/TR/${name}/` };
  }


  describe("fetch from Specref", () => {
    it("works on a TR spec in the absence of W3C API key", async () => {
      const spec = getW3CSpec("presentation-api");
      const info = await fetchInfo([spec]);
      assert.ok(info[spec.name]);
      assert.equal(info[spec.name].source, "specref");
      assert.equal(info[spec.name].edUrl, "https://w3c.github.io/presentation-api/");
      assert.equal(info[spec.name].title, "Presentation API");
    });

    it("works on a WHATWG spec", async () => {
      const spec = {
        url: "https://dom.spec.whatwg.org/",
        name: "dom"
      };
      const info = await fetchInfo([spec]);
      assert.ok(info[spec.name]);
      assert.equal(info[spec.name].source, "specref");
      assert.equal(info[spec.name].edUrl, "https://dom.spec.whatwg.org/");
      assert.equal(info[spec.name].title, "DOM Standard");
    });

    it("can operate on multiple specs at once", async () => {
      const spec = getW3CSpec("presentation-api");
      const other = getW3CSpec("hr-time-2");
      const info = await fetchInfo([spec, other]);
      assert.ok(info[spec.name]);
      assert.equal(info[spec.name].source, "specref");
      assert.equal(info[spec.name].edUrl, "https://w3c.github.io/presentation-api/");
      assert.equal(info[spec.name].title, "Presentation API");

      assert.ok(info[other.name]);
      assert.equal(info[other.name].source, "specref");
      assert.equal(info[other.name].edUrl, "https://w3c.github.io/hr-time/");
      assert.equal(info[other.name].title, "High Resolution Time Level 2");
    });
  });


  describe("fetch from spec", () => {
    it("extracts spec info from a Bikeshed spec when needed", async () => {
      const spec = {
        url: "https://tabatkins.github.io/bikeshed/",
        name: "bikeshed"
      };
      const info = await fetchInfo([spec]);
      assert.ok(info[spec.name]);
      assert.equal(info[spec.name].source, "spec");
      assert.equal(info[spec.name].edUrl, spec.url);
      assert.equal(info[spec.name].title, "Bikeshed Documentation");
    });

    it("extracts spec info from a Respec spec when needed", async () => {
      const spec = {
        url: "https://w3c.github.io/respec/examples/tpac_2019.html",
        name: "respec"
      };
      const info = await fetchInfo([spec]);
      assert.ok(info[spec.name]);
      assert.equal(info[spec.name].source, "spec");
      assert.equal(info[spec.name].edUrl, spec.url);
      assert.equal(info[spec.name].title, "TPAC 2019 - New Features");
    });
  });
});