/**
 * Make sure that the list of specs exposed in index.json looks consistent and
 * includes the right info.
 */

const assert = require("assert");
const source = require("../specs.json");
const specs = require("../index.json");
const schema = require("../schema/index.json");
const dfnsSchema = require("../schema/definitions.json");
const Ajv = require("ajv");
const ajv = new Ajv();

describe("List of specs", () => {
  it("has a valid JSON schema", () => {
    const isSchemaValid = ajv.validateSchema(schema);
    assert.ok(isSchemaValid);
  });
  
  it("respects the JSON schema", () => {
    const validate = ajv.addSchema(dfnsSchema).compile(schema);
    const isValid = validate(specs, { format: "full" });
    assert.strictEqual(validate.errors, null);
    assert.ok(isValid);
  });

  it("is an array of objects with url, shortname, and series properties", () => {
    const wrong = specs.filter(s => !(s.url && s.shortname && s.series));
    assert.deepStrictEqual(wrong, []);
  });

  it("has level info for specs that have a previous link", () => {
    const wrong = specs.filter(s => s.seriesPrevious && !s.seriesVersion);
    assert.deepStrictEqual(wrong, []);
  });

  it("has previous links for all delta specs", () => {
    const wrong = specs.filter(s =>
      s.seriesComposition === "delta" && !s.seriesPrevious);
    assert.deepStrictEqual(wrong, []);
  });

  it("has previous links that can be resolved to a spec", () => {
    const wrong = specs.filter(s =>
      s.seriesPrevious && !specs.find(p => p.shortname === s.seriesPrevious));
    assert.deepStrictEqual(wrong, []);
  });

  it("has next links that can be resolved to a spec", () => {
    const wrong = specs.filter(s =>
      s.seriesNext && !specs.find(n => n.shortname === s.seriesNext));
    assert.deepStrictEqual(wrong, []);
  });

  it("has correct next links for specs targeted by a previous link", () => {
    const wrong = specs.filter(s => {
      if (!s.seriesPrevious) {
        return false;
      }
      const previous = specs.find(p => p.shortname === s.seriesPrevious);
      return !previous || previous.seriesNext !== s.shortname;
    });
    assert.deepStrictEqual(wrong, []);
  });

  it("has correct previous links for specs targeted by a next link", () => {
    const wrong = specs.filter(s => {
      if (!s.seriesNext) {
        return false;
      }
      const next = specs.find(n => n.shortname === s.seriesNext);
      return !next || next.seriesPrevious !== s.shortname;
    });
    assert.deepStrictEqual(wrong, []);
  });
});