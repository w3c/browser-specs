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


describe("fetch-info module", function () {
  // Tests need to send network requests
  this.slow(5000);
  this.timeout(30000);

  function getW3CSpec(name) {
    return { name, url: `https://www.w3.org/TR/${name}/` };
  }

  describe("W3C API key", () => {
    it("is defined otherwise some tests cannot pass", () => {
      assert.ok(w3cApiKey);
    });
  });


  describe("fetch from W3C API", () => {
    it("works on a TR spec", async () => {
      const spec = getW3CSpec("hr-time-2");
      const info = await fetchInfo([spec], { w3cApiKey });
      assert.ok(info[spec.name]);
      assert.equal(info[spec.name].source, "w3c");
      assert.equal(info[spec.name].trUrl, spec.url);
      assert.equal(info[spec.name].edUrl, "https://w3c.github.io/hr-time/");
      assert.equal(info[spec.name].title, "High Resolution Time Level 2");
    });

    it("can operate on multiple specs at once", async () => {
      const spec = getW3CSpec("hr-time-2");
      const other = getW3CSpec("presentation-api");
      const info = await fetchInfo([spec, other], { w3cApiKey });
      assert.ok(info[spec.name]);
      assert.equal(info[spec.name].source, "w3c");
      assert.equal(info[spec.name].trUrl, spec.url);
      assert.equal(info[spec.name].edUrl, "https://w3c.github.io/hr-time/");
      assert.equal(info[spec.name].title, "High Resolution Time Level 2");

      assert.ok(info[other.name]);
      assert.equal(info[other.name].source, "w3c");
      assert.equal(info[other.name].trUrl, other.url);
      assert.equal(info[other.name].edUrl, "https://w3c.github.io/presentation-api/");
      assert.equal(info[other.name].title, "Presentation API");
    });

    it("throws when W3C API key is invalid", async () => {
      assert.rejects(
        fetchInfo([getW3CSpec("selectors-3")], { w3cApiKey: "invalid" }),
        /^W3C API returned an error, status code is 403$/);
    });
  });


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
      const info = await fetchInfo([spec], { w3cApiKey });
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


  describe("fetch from all sources", () => {
    it("merges info from sources", async () => {
      const w3c = getW3CSpec("presentation-api");
      const whatwg = {
        url: "https://html.spec.whatwg.org/multipage/",
        name: "html"
      };
      const other = {
        url: "https://tabatkins.github.io/bikeshed/",
        name: "bikeshed"
      };
      const info = await fetchInfo([w3c, whatwg, other], { w3cApiKey });
      assert.ok(info[w3c.name]);
      assert.equal(info[w3c.name].source, "w3c");
      assert.equal(info[w3c.name].trUrl, w3c.url);
      assert.equal(info[w3c.name].edUrl, "https://w3c.github.io/presentation-api/");
      assert.equal(info[w3c.name].title, "Presentation API");

      assert.ok(info[whatwg.name]);
      assert.equal(info[whatwg.name].source, "specref");
      assert.equal(info[whatwg.name].edUrl, whatwg.url);
      assert.equal(info[whatwg.name].title, "HTML Standard");

      assert.ok(info[other.name]);
      assert.equal(info[other.name].source, "spec");
      assert.equal(info[other.name].edUrl, other.url);
      assert.equal(info[other.name].title, "Bikeshed Documentation");      
    });
  });


  describe("specs-info.json file", () => {
    const schema = require("../schema/specs-info.json");
    const dfnsSchema = require("../schema/dfns.json");
    const info = require("../specs-info.json");
    const Ajv = require("ajv");
    const ajv = new Ajv();

    it("has a valid JSON schema", () => {
      const isSchemaValid = ajv.validateSchema(schema);
      assert.ok(isSchemaValid);
    });
    
    it("respects the JSON schema", () => {
      const validate = ajv.addSchema(dfnsSchema).compile(schema);
      const isValid = ajv.validate(info, { format: "full" });
      assert.ok(isValid);
    });
  });
});