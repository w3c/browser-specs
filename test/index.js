/**
 * Make sure that the list of specs exposed in index.json looks consistent and
 * includes the right info.
 */

const assert = require("assert");
const specs = require("../index.json");
const schema = require("../schema/index.json");
const dfnsSchema = require("../schema/definitions.json");
const Ajv = require("ajv");
const addFormats = require("ajv-formats")
const ajv = new Ajv();
addFormats(ajv);


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

  it("has unique shortnames", () => {
    const wrong = specs.filter((spec, idx) =>
      specs.findIndex(s => s.shortname === spec.shortname) !== idx);
    assert.deepStrictEqual(wrong, []);
  });

  it("only contains HTTPS URLs", () => {
    const wrong = specs.filter(s =>
      !s.url.startsWith('https:') ||
      (s.release && !s.release.url.startsWith('https:')) ||
      (s.nightly && !s.nightly.url.startsWith('https:')));
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

  it("has consistent series info", () => {
    const wrong = specs.filter(s => {
      if (!s.seriesPrevious) {
        return false;
      }
      const previous = specs.find(p => p.shortname === s.seriesPrevious);
      assert.deepStrictEqual(s.series, previous.series);
    });
  });

  it("has series titles for all specs", () => {
    const wrong = specs.filter(s => !s.series?.title);
    assert.deepStrictEqual(wrong, []);
  });

  it("has series titles that look consistent with spec titles", () => {
    // Note the WebRTC spec follows a slightly different pattern
    // TEMP (2022-01-05): temp exception to the rule: published version of CSS
    // Images Level 4 has an obscure title à la "CSS Image Values..."
    // (should get fixed next time the spec gets published to /TR)
    const wrong = specs.filter(s => !s.title.includes(s.series.title))
      .filter(s => !["webrtc", "css-images-4"].includes(s.shortname));
    assert.deepStrictEqual(wrong, []);
  });

  it("has series short titles for all specs", () => {
    const wrong = specs.filter(s => !s.series?.shortTitle);
    assert.deepStrictEqual(wrong, []);
  });

  it("contains nightly URLs for all specs", () => {
    const wrong = specs.filter(s => !s.nightly.url);
    assert.deepStrictEqual(wrong, []);
  });

  it("contains repository URLs for all non IETF specs", () => {
    // No repo for the Patent Policy document either
    const wrong = specs.filter(s => !s.nightly.repository &&
      !s.nightly.url.match(/rfc-editor\.org/) &&
      !s.nightly.url.match(/\/Consortium\/Patent-Policy\/$/));
    assert.deepStrictEqual(wrong, []);
  });

  it("contains relative paths to source of nightly spec for all non IETF specs", () => {
    // No repo for the Patent Policy document either
    const wrong = specs.filter(s => !s.nightly.sourcePath &&
      !s.nightly.url.match(/rfc-editor\.org/) &&
      !s.nightly.url.match(/\/Consortium\/Patent-Policy\/$/));
    assert.deepStrictEqual(wrong, []);
  });

  it("contains filenames for all nightly URLs", () => {
    const wrong = specs.filter(s => !s.nightly.filename);
    assert.deepStrictEqual(wrong, []);
  });

  it("contains filenames for all release URLs", () => {
    const wrong = specs.filter(s => s.release && !s.release.filename);
    assert.deepStrictEqual(wrong, []);
  });
});
