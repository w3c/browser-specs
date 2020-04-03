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
    assert.ok(isValid);
  });

  it("is an array of objects with url, name, and shortname properties", () => {
    const wrong = specs.filter(s => !(s.url && s.name && s.shortname));
    assert.deepStrictEqual(wrong, []);
  });

  it("has level info for specs that have a previous link", () => {
    const wrong = specs.filter(s => s.previousLevel && !s.level);
    assert.deepStrictEqual(wrong, []);
  });

  it("has previous links for all delta specs", () => {
    const wrong = specs.filter(s =>
      s.levelComposition === "delta" && !s.previousLevel);
    assert.deepStrictEqual(wrong, []);
  });

  it("has previous links that can be resolved to a spec", () => {
    const wrong = specs.filter(s =>
      s.previousLevel && !specs.find(p => p.name === s.previousLevel));
    assert.deepStrictEqual(wrong, []);
  });

  it("has next links that can be resolved to a spec", () => {
    const wrong = specs.filter(s =>
      s.nextLevel && !specs.find(n => n.name === s.nextLevel));
    assert.deepStrictEqual(wrong, []);
  });

  it("has correct next links for specs targeted by a previous link", () => {
    const wrong = specs.filter(s => {
      if (!s.previousLevel) {
        return false;
      }
      const previous = specs.find(p => p.name === s.previousLevel);
      return !previous || previous.nextLevel !== s.name;
    });
    assert.deepStrictEqual(wrong, []);
  });

  it("has correct previous links for specs targeted by a next link", () => {
    const wrong = specs.filter(s => {
      if (!s.nextLevel) {
        return false;
      }
      const next = specs.find(n => n.name === s.nextLevel);
      return !next || next.previousLevel !== s.name;
    });
    assert.deepStrictEqual(wrong, []);
  });
});