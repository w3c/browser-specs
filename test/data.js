/**
 * Make sure that the src/data/*.json files respect the right JSON schema
 */

const assert = require("assert");
const schema = require("../schema/data.json");
const dfnsSchema = require("../schema/definitions.json");
const Ajv = require("ajv");
const addFormats = require("ajv-formats")
const ajv = (new Ajv()).addSchema(dfnsSchema);
addFormats(ajv);

describe("Ignore/Monitor lists", () => {
  describe("The JSON schema", () => {
    it("is valid", () => {
      const isSchemaValid = ajv.validateSchema(schema);
      assert.ok(isSchemaValid);
    });
  });

  describe("The ignore list", () => {
    it("respects the JSON schema", () => {
      const list = require("../src/data/ignore.json");
      const validate = ajv.compile(schema);
      const isValid = validate(list, { format: "full" });
      assert.strictEqual(validate.errors, null);
    });

    it("does not contain repos that are in the main list", () => {
      const list = require("../src/data/ignore.json");
      const main = require("../index.json");
      const wrongRepos = Object.keys(list.repos).filter(repo => {
        const githubRepo = `https://github.com/${repo}`.toLowerCase();
        return main.find(spec =>
          spec.nightly?.repository?.toLowerCase() === githubRepo);
      });
      assert.deepStrictEqual(wrongRepos, []);
    });

    it("does not contain specs that are in the main list", () => {
      const list = require("../src/data/ignore.json");
      const main = require("../index.json");
      const wrongSpecs = Object.keys(list.specs).filter(url => {
        const lurl = url.toLowerCase();
        return main.find(spec =>
          spec.url.toLowerCase() === lurl ||
          spec.nightly?.url?.toLowerCase() === lurl ||
          spec.release?.url?.toLowerCase() === lurl);
      });
      assert.deepStrictEqual(wrongSpecs, []);
    });
  });

  describe("The monitor list", () => {
    it("respects the JSON schema", () => {
      const list = require("../src/data/monitor.json");
      const validate = ajv.compile(schema);
      const isValid = validate(list, { format: "full" });
      assert.strictEqual(validate.errors, null);
    });

    it("has lastreviewed dates for all entries", () => {
      const list = require("../src/data/monitor.json");
      const wrongRepos = Object.entries(list.repos)
        .filter(([key, value]) => !value.lastreviewed)
        .map(([key, value]) => key);
      assert.deepStrictEqual(wrongRepos, []);

      const wrongSpecs = Object.entries(list.specs)
        .filter(([key, value]) => !value.lastreviewed)
        .map(([key, value]) => key);
      assert.deepStrictEqual(wrongSpecs, []);
    });

    it("does not contain repos that are in the main list", () => {
      const list = require("../src/data/monitor.json");
      const main = require("../index.json");
      const wrongRepos = Object.keys(list.repos).filter(repo => {
        const githubRepo = `https://github.com/${repo}`.toLowerCase();
        return main.find(spec =>
          spec.nightly?.repository?.toLowerCase() === githubRepo);
      });
      assert.deepStrictEqual(wrongRepos, []);
    });

    it("does not contain specs that are in the main list", () => {
      const list = require("../src/data/monitor.json");
      const main = require("../index.json");
      const wrongSpecs = Object.keys(list.specs).filter(url => {
        const lurl = url.toLowerCase();
        return main.find(spec =>
          spec.url.toLowerCase() === lurl ||
          spec.nightly?.url?.toLowerCase() === lurl ||
          spec.release?.url?.toLowerCase() === lurl);
      });
      assert.deepStrictEqual(wrongSpecs, []);
    });
  });

  describe("An entry in one of the lists", () => {
    it("appears only once in the repos list", () => {
      const ignore = Object.keys(require("../src/data/ignore.json").repos);
      const monitor = Object.keys(require("../src/data/monitor.json").repos);
      const dupl = ignore.filter(key => monitor.find(k => k === key))
      assert.deepStrictEqual(dupl, []);
    });

    it("appears only once in the specs list", () => {
      const ignore = Object.keys(require("../src/data/ignore.json").specs);
      const monitor = Object.keys(require("../src/data/monitor.json").specs);
      const dupl = ignore.filter(key => monitor.find(k => k === key))
      assert.deepStrictEqual(dupl, []);
    });
  });
});
