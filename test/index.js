/**
 * Make sure that the list of specs exposed in index.json looks consistent and
 * includes the right info.
 */

const assert = require("assert");
const specs = require("../index.json");
const schema = require("../schema/index.json");
const dfnsSchema = require("../schema/definitions.json");
const computeShortname = require("../src/compute-shortname");
const Ajv = require("ajv");
const addFormats = require("ajv-formats")
const ajv = new Ajv();
addFormats(ajv);

// Some old specs that don't have a spec
const noRepo = [
  'SVG11',
  'test-methodology',
  'rdf11-concepts',
  'rdf11-mt',
  'n-quads'
];


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

  it("does not have previous links for fork specs", () => {
    const wrong = specs.filter(s =>
      s.seriesComposition === "fork" && s.seriesPrevious);
    assert.deepStrictEqual(wrong, []);
  });

  it("does not have next links for fork specs", () => {
    const wrong = specs.filter(s =>
      s.seriesComposition === "fork" && s.seriesNext);
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
    // Note the WebRTC and JSON-LD specs follow a slightly different pattern
    // TEMP (2022-01-05): temp exception to the rule: published version of CSS
    // Images Level 4 has an obscure title à la "CSS Image Values..."
    // (should get fixed next time the spec gets published to /TR)
    const wrong = specs.filter(s => !s.title.includes(s.series.title))
      .filter(s => !["webrtc", "json-ld11-api", "json-ld11-framing", "css-images-4"].includes(s.shortname));
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
    // Some more exceptions to the rule
    const wrong = specs.filter(s => !s.nightly.repository &&
      !s.nightly.url.match(/rfc-editor\.org/) &&
      !s.nightly.url.match(/\/Consortium\/Patent-Policy\/$/) &&
      !s.nightly.url.match(/\/sourcemaps\.info\//) &&
      !s.nightly.url.match(/fidoalliance\.org\//) &&
      !noRepo.includes(s.shortname));
    assert.deepStrictEqual(wrong, []);
  });

  it("contains relative paths to source of nightly spec for all non IETF specs", () => {
    // Some more exceptions to the rule
    const wrong = specs.filter(s => !s.nightly.sourcePath &&
      !s.nightly.url.match(/rfc-editor\.org/) &&
      !s.nightly.url.match(/\/Consortium\/Patent-Policy\/$/) &&
      !s.nightly.url.match(/tc39\.es\/proposal\-decorators\/$/) &&
      !s.nightly.url.match(/\/sourcemaps\.info\//) &&
      !s.nightly.url.match(/fidoalliance\.org\//) &&
      !noRepo.includes(s.shortname));
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

  it("has a forkOf property for all fork specs", () => {
    const wrong = specs.filter(s => s.seriesComposition === "fork" && !s.forkOf);
    assert.deepStrictEqual(wrong, []);
  });

  it("has a fork composition level for all fork specs", () => {
    const wrong = specs.filter(s => s.forkOf && s.seriesComposition !== "fork");
    assert.deepStrictEqual(wrong, []);
  });

  it("only has forks of existing specs", () => {
    const wrong = specs.filter(s => s.forkOf && !specs.find(spec => spec.shortname === s.forkOf));
    assert.deepStrictEqual(wrong, []);
  });

  it("has consistent forks properties", () => {
    const wrong = specs.filter(s => !!s.forks &&
      s.forks.find(shortname => !specs.find(spec =>
        spec.shortname === shortname &&
        spec.seriesComposition === "fork" &&
        spec.forkOf === s.shortname)));
    assert.deepStrictEqual(wrong, []);
  });

  it("has a w3c.github.io alternate URL for CSS drafts", () => {
    const wrong = specs
      .filter(s => s.nightly.url.match(/\/drafts\.csswg\.org/))
      .filter(s => {
        const draft = computeShortname(s.nightly.url);
        return !s.nightly.alternateUrls.includes(
          `https://w3c.github.io/csswg-drafts/${draft.shortname}/`);
      });
    assert.deepStrictEqual(wrong, []);
  });

  it("has distinct source paths for all specs", () => {
    // ... provided entries don't share the same nightly draft
    // (typically the case for CSS 2.1 and CSS 2.2)
    const wrong = specs.filter(s =>
      s.nightly.repository && s.nightly.sourcePath &&
      specs.find(spec => spec !== s &&
        spec.nightly.url !== s.nightly.url &&
        spec.nightly.repository === s.nightly.repository &&
        spec.nightly.sourcePath === s.nightly.sourcePath));
    assert.deepStrictEqual(wrong, [], JSON.stringify(wrong, null, 2));
  });
});
