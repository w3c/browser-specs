"use strict";

const fs = require("fs").promises;
const schema = require("./schema.json");
const computeShortname = require("./src/compute-shortname.js");
const Ajv = require("ajv");
const ajv = new Ajv();

// When an entry is invalid, the schema validator returns one error for each
// "oneOf" option and one error on overall "oneOf" problem. This is confusing
// for humans. The following function improves the error being returned.
const clarifyErrors = errors => {
  if (!errors || errors.length < 2) {
    return errors;
  }

  // If first two errors are type errors for oneOf choices, item is neither
  // a string nor an object
  if ((errors[0].schemaPath === "#/items/oneOf/0/type") &&
      (errors[1].schemaPath === "#/items/oneOf/1/type")) {
    return [
      Object.assign(errors[0], { "message": "should be a string or an object" })
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
      error.message = "should not have additional property '" +
        error.params.additionalProperty + "'";
    }
  });

  // If there are no more errors left to return, roll back to the initial set
  // to make sure an error gets reported. That should never happen, but better
  // be ready for it.
  return (clearerErrors.length > 0) ? clearerErrors : errors;
};


function compareSpecs(a, b) {
  const aurl = (typeof a === "string") ? a : a.url;
  const burl = (typeof b === "string") ? b : b.url;
  return aurl.localeCompare(burl);
}


// Lint specs list defined as a JSON string
function lintStr(specsStr) {
  const specs = JSON.parse(specsStr);

  // Normalize end of lines, different across platforms, for comparison
  specsStr = specsStr.replace(/\r\n/g, "\n");

  const isSchemaValid = ajv.validateSchema(schema);
  if (!isSchemaValid) {
    throw "The schema.json file must be a valid JSON Schema file";
  }

  var isValid = ajv.validate(schema, specs, { format: "full" });
  if (!isValid) {
    throw ajv.errorsText(clarifyErrors(ajv.errors), {
      dataVar: "specs", separator: "\n"
    });
  }

  const sorted = specs.map(spec => (typeof spec === "string") ?
      new URL(spec).toString() :
      Object.assign({}, spec, { url: new URL(spec.url).toString() }));
  sorted.sort(compareSpecs);

  // Drop duplicates and prefer URL-only format when we only have a URL
  const fixed = sorted
    .filter((spec, idx) => !sorted.find((s, i) => i < idx && compareSpecs(s, spec) === 0))
    .map(spec => (Object.keys(spec).length > 1) ? spec : spec.url);

  // Make sure that we can generate names for all specifications or that
  // the specification already defines one. An exception will be thrown if not.
  fixed.forEach(spec => computeShortname(
    (typeof spec === "string") ? spec : spec.name || spec.url));

  const linted = JSON.stringify(fixed, null, 2) + "\n";
  return (linted !== specsStr) ? linted : null;
}


// Lint by normalizing specs.json and comparing it to the original,
// fixing it in place if |fix| is true.
async function lint(fix = false) {
  const specs = await fs.readFile("./specs.json", "utf8");
  const linted = lintStr(specs);
  if (linted) {
    if (fix) {
      console.log("specs.json has lint issues, updating in place");
      await fs.writeFile("./specs.json", linted, "utf8");
    }
    else {
      console.log("specs.json has lint issues, run with --fix");
    }
    return false;
  }

  console.log("specs.json passed lint");
  return true;
}


if (require.main === module) {
  // Code used as command-line interface (CLI), run linting process
  lint(process.argv.includes("--fix")).then(
    ok => {
      process.exit(ok ? 0 : 1);
    },
    reason => {
      console.error(reason);
      process.exit(1);
    }
  );
}
else {
  // Code imported to another JS module, export lint functions
  module.exports.lintStr = lintStr;
  module.exports.lint = lint;
}
