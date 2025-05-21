/**
 * Make sure that the src/data/*.json files respect the right JSON schema
 */

import { describe, it } from "node:test";
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
const multiReposFile = path.resolve(scriptPath, "..", "src", "data", "multispecs-repos.json");

describe("Data files", () => {
  describe("The JSON schema", () => {
    it("is valid", () => {
      const isSchemaValid = ajv.validateSchema(schema);
      assert.ok(isSchemaValid);
    });
  });

  describe("The multispecs-repos.json list", () => {
    it("respects the JSON schema", async () => {
      const list = await loadJSON(multiReposFile);
      const validate = ajv.compile(schema);
      const isValid = validate(list, { format: "full" });
      assert.strictEqual(validate.errors, null);
    });
  });
});
