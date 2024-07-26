/**
 * Make sure that the specs.json respects the JSON schema and all constraints
 * that cannot be automatically linted.
 *
 * Note: The specs.json file may still need to be linted, and that's all fine!
 */

// Tests may run against a test version of the specs file
import assert from "node:assert";
import path from "node:path";
import { fileURLToPath } from "node:url";
import schema from "../schema/specs.json" with { type: "json" };
import dfnsSchema from "../schema/definitions.json" with { type: "json" };
import computeInfo from "../src/compute-shortname.js";
import computePrevNext from "../src/compute-prevnext.js";
import loadJSON from "../src/load-json.js";
import Ajv from "ajv";
import addFormats from "ajv-formats";
const ajv = (new Ajv()).addSchema(dfnsSchema);
addFormats(ajv);

const scriptPath = path.dirname(fileURLToPath(import.meta.url));
const specsFile = process.env.testIndex ?? path.resolve(scriptPath, "..", "specs.json");
const specs = await loadJSON(specsFile);

// When an entry is invalid, the schema validator returns one error for each
// "oneOf" option and one error on overall "oneOf" problem. This is confusing
// for humans. The following function improves the error being returned.
function clarifyErrors(errors) {
  if (!errors) {
    return errors;
  }

  // Update instancePath to drop misleading "[object Object]"
  errors.forEach(err =>
    err.instancePath = err.instancePath.replace(/^\[object Object\]/, ''));

  if (errors.length < 2) {
    return errors;
  }

  // If first two errors are type errors for oneOf choices, item is neither
  // a string nor an object
  if ((errors[0].schemaPath === "#/items/oneOf/0/type") &&
      (errors[1].schemaPath === "#/items/oneOf/1/type")) {
    return [
      Object.assign(errors[0], { "message": "must be a string or an object" })
    ];
  }

  // Otherwise, if second error is a type error for second oneOf choice,
  // it means the item is actually a string that represents an invalid URL,
  // which the first error should capture.
  if (errors[1].schemaPath === "#/items/oneOf/1/type") {
    return [errors[0]];
  }

  // Otherwise, item is an object that does not follow the schema, drop the
  // error that says that item is not a string and the error that says that it
  // does not meet one of the "oneOf" options. What remains should be the error
  // that explains why the item does not meet the schema for the object.
  const clearerErrors = errors.filter(error =>
      (error.schemaPath !== "#/items/oneOf/0/type") &&
      (error.schemaPath !== "#/items/oneOf"));

  // Improve an additional property message to point out the property that
  // should not be there (default message does not say it)
  clearerErrors.forEach(error => {
    if ((error.keyword === "additionalProperties") &&
        error.params && error.params.additionalProperty) {
      error.message = "must not have additional property '" +
        error.params.additionalProperty + "'";
    }
  });

  // If there are no more errors left to return, roll back to the initial set
  // to make sure an error gets reported. That should never happen, but better
  // be ready for it.
  return (clearerErrors.length > 0) ? clearerErrors : errors;
}

function compareSpecs(a, b) {
  return a.url.localeCompare(b.url);
}

function specs2objects(specs) {
  return specs
    .map(spec => (typeof spec === "string") ?
      {
        url: new URL(spec.split(" ")[0]).toString(),
        seriesComposition: (spec.split(' ')[1] === "delta") ? "delta" : "full",
        forceCurrent: (spec.split(' ')[1] === "current"),
        multipage: (spec.split(' ')[1] === "multipage"),
      } :
      Object.assign({}, spec, { url: new URL(spec.url).toString() }))
    .filter((spec, idx, list) =>
      !list.find((s, i) => i < idx && compareSpecs(s, spec) === 0));
}

function specs2LinkedList(specs) {
  return specs2objects(specs)
    .map(s => Object.assign({}, s, computeInfo(s.shortname || s.url, s.forkOf)))
    .map((s, _, list) => Object.assign({}, s, computePrevNext(s, list)));
}

function check(specs) {
  const validate = ajv.compile(schema);
  const isValid = validate(specs, { format: "full" });
  const msg = ajv.errorsText(clarifyErrors(validate.errors), {
    dataVar: "specs", separator: "\n"
  });
  return msg;
}


describe("The `specs.json` list", () => {
  describe("has a JSON schema which", () => {
    it("is valid", () => {
      const isSchemaValid = ajv.validateSchema(schema);
      assert.ok(isSchemaValid);
    });

    it("rejects list if it is not an array", () => {
      const specs = 0;
      assert.strictEqual(check(specs), "specs must be array");
    });

    it("rejects an empty list", () => {
      const specs = [];
      assert.strictEqual(check(specs), "specs must NOT have fewer than 1 items");
    });

    it("rejects items that have a wrong type", () => {
      const specs = [0];
      assert.strictEqual(check(specs), "specs/0 must be a string or an object");
    });

    it("rejects spec objects without URL", () => {
      const specs = [{}];
      assert.strictEqual(check(specs), "specs/0 must have required property 'url'");
    });

    it("rejects spec objects with an invalid URL", () => {
      const specs = [{ url: "invalid" }];
      assert.strictEqual(check(specs), "specs/0/url must match format \"uri\"");
    });

    it("rejects spec objects with additional properties", () => {
      const specs = [{ url: "https://example.org/", invalid: "test" }];
      assert.strictEqual(check(specs), "specs/0 must not have additional property 'invalid'");
    });
  });

  it("respects the JSON schema", () => {
    assert.strictEqual(check(specs), 'No errors');
  });

  it("only points at valid URLs", () => {
    specs.forEach(spec => (typeof spec === "string") ?
        new URL(spec.split(" ")[0]).toString() : null);
    assert.ok(true);
  })

  it("only contains specs for which a shortname can be generated", () => {
    // Convert entries to spec objects and compute shortname
    const specsWithoutShortname = specs2objects(specs)
      .map(spec => Object.assign({}, spec, computeInfo(spec.shortname || spec.url, spec.forkOf)))
      .filter(spec => !spec.shortname);

    // No exception thrown? That means we're good!
    // We'll just check that there aren't any spec with an empty name and report
    // the first one (That should never happen since computeInfo would throw but
    // better be safe)
    assert.strictEqual(specsWithoutShortname[0], undefined);
  });

  it("does not have a delta spec without a previous full spec", () => {
    const fullPrevious = (spec, list) => {
      const previous = list.find(s => s.shortname === spec.seriesPrevious);
      if (previous && previous.seriesComposition && previous.seriesComposition !== "full") {
        return fullPrevious(previous, list);
      }
      return previous;
    };
    const deltaWithoutFull = specs2LinkedList(specs)
      .filter((s, _, list) => s.seriesComposition === "delta" && !fullPrevious(s, list));
    assert.strictEqual(deltaWithoutFull[0], undefined);
  });

  it("does not have a delta spec flagged as 'current'", () => {
    const deltaCurrent = specs2LinkedList(specs)
      .filter(s => s.forceCurrent && s.seriesComposition === "delta");
    assert.strictEqual(deltaCurrent[0], undefined);
  });

  it("does not have a fork spec flagged as 'current'", () => {
    const forkCurrent = specs2LinkedList(specs)
      .filter(s => s.forceCurrent && s.forkOf);
    assert.strictEqual(forkCurrent[0], undefined);
  });

  it("has only one spec flagged as 'current' per series shortname", () => {
    const linkedList = specs2LinkedList(specs);
    const problematicCurrent = linkedList
      .filter(s => s.forceCurrent)
      .filter(s => s !== linkedList.find(p =>
        p.series.shortname === s.series.shortname && p.forceCurrent));
    assert.strictEqual(problematicCurrent[0], undefined);
  });

  it("does not have a spec with a 'fork' seriesComposition property", () => {
    const wrong = specs.find(s => s.seriesComposition === "fork");
    assert.strictEqual(wrong, undefined);
  });

  it("does not have a 'delta fork' spec", () => {
    const wrong = specs.find(s => s.forkOf && s.seriesComposition === "delta");
    assert.strictEqual(wrong, undefined);
  });

  it("only has fork specs that reference existing specs", () => {
    const linkedList = specs2LinkedList(specs);
    const forkWithoutFull = linkedList.filter((s, _, list) => s.forkOf &&
      !linkedList.find(spec => spec.shortname === s.forkOf));
    assert.strictEqual(forkWithoutFull[0], undefined);
  });
});
