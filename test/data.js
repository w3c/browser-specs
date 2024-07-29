/**
 * Make sure that the src/data/*.json files respect the right JSON schema
 */

import assert from "node:assert";
import path from "node:path";
import { fileURLToPath } from "node:url";
import schema from "../schema/data.json" with { type: "json" };
import dfnsSchema from "../schema/definitions.json" with { type: "json" };
import loadJSON from "../src/load-json.js";
import Ajv from "ajv";
import addFormats from "ajv-formats";
const ajv = (new Ajv()).addSchema(dfnsSchema);
addFormats(ajv);

const scriptPath = path.dirname(fileURLToPath(import.meta.url));
const ignoreFile = path.resolve(scriptPath, "..", "src", "data", "ignore.json");
const monitorFile = path.resolve(scriptPath, "..", "src", "data", "monitor.json");
const indexFile = path.resolve(scriptPath, "..", "index.json");

describe("Ignore/Monitor lists", () => {
  describe("The JSON schema", () => {
    it("is valid", () => {
      const isSchemaValid = ajv.validateSchema(schema);
      assert.ok(isSchemaValid);
    });
  });

  describe("The ignore list", () => {
    it("respects the JSON schema", async () => {
      const list = await loadJSON(ignoreFile);
      const validate = ajv.compile(schema);
      const isValid = validate(list, { format: "full" });
      assert.strictEqual(validate.errors, null);
    });

    it("does not contain repos that are in the main list", async () => {
      const list = await loadJSON(ignoreFile);
      const main = await loadJSON(indexFile);
      const wrongRepos = Object.keys(list.repos).filter(repo => {
        const githubRepo = `https://github.com/${repo}`.toLowerCase();
        return main.find(spec =>
          spec.nightly?.repository?.toLowerCase() === githubRepo);
      });
      assert.deepStrictEqual(wrongRepos, []);
    });

    it("does not contain specs that are in the main list", async () => {
      const list = await loadJSON(ignoreFile);
      const main = await loadJSON(indexFile);
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
    it("respects the JSON schema", async () => {
      const list = await loadJSON(monitorFile);
      const validate = ajv.compile(schema);
      const isValid = validate(list, { format: "full" });
      assert.strictEqual(validate.errors, null);
    });

    it("has lastreviewed dates for all entries", async () => {
      const list = await loadJSON(monitorFile);
      const wrongRepos = Object.entries(list.repos)
        .filter(([key, value]) => !value.lastreviewed)
        .map(([key, value]) => key);
      assert.deepStrictEqual(wrongRepos, []);

      const wrongSpecs = Object.entries(list.specs)
        .filter(([key, value]) => !value.lastreviewed)
        .map(([key, value]) => key);
      assert.deepStrictEqual(wrongSpecs, []);
    });

    it("does not contain repos that are in the main list", async () => {
      const list = await loadJSON(monitorFile);
      const main = await loadJSON(indexFile);
      const wrongRepos = Object.keys(list.repos).filter(repo => {
        const githubRepo = `https://github.com/${repo}`.toLowerCase();
        return main.find(spec =>
          spec.nightly?.repository?.toLowerCase() === githubRepo);
      });
      assert.deepStrictEqual(wrongRepos, []);
    });

    it("does not contain specs that are in the main list", async () => {
      const list = await loadJSON(monitorFile);
      const main = await loadJSON(indexFile);
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
    it("appears only once in the repos list", async () => {
      const ignore = Object.keys((await loadJSON(ignoreFile)).repos);
      const monitor = Object.keys((await loadJSON(monitorFile)).repos);
      const dupl = ignore.filter(key => monitor.find(k => k === key))
      assert.deepStrictEqual(dupl, []);
    });

    it("appears only once in the specs list", async () => {
      const ignore = Object.keys((await loadJSON(ignoreFile)).specs);
      const monitor = Object.keys((await loadJSON(monitorFile)).specs);
      const dupl = ignore.filter(key => monitor.find(k => k === key))
      assert.deepStrictEqual(dupl, []);
    });
  });
});
