"use strict";

const fs = require("fs").promises;
const computeShortname = require("./src/compute-shortname.js");
const computePrevNext = require("./src/compute-prevnext.js");

const schema = require("./schema/specs.json");
const dfnsSchema = require("./schema/definitions.json");
const Ajv = require("ajv");
const ajv = new Ajv();
const validate = ajv.addSchema(dfnsSchema).compile(schema);

// When an entry is invalid, the schema validator returns one error for each
// "oneOf" option and one error on overall "oneOf" problem. This is confusing
// for humans. The following function improves the error being returned.
const clarifyErrors = errors => {
  if (!errors) {
    return errors;
  }

  // Update dataPath to drop misleading "[object Object]"
  errors.forEach(err =>
    err.dataPath = err.dataPath.replace(/^\[object Object\]/, ''));

  if (errors.length < 2) {
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
  return a.url.localeCompare(b.url);
}


// Shorten definition of spec to more human-readable version
function shortenDefinition(spec) {
  const short = {};
  for (const property of Object.keys(spec)) {
    if (!((property === "levelComposition" && spec[property] === "full") ||
        (property === "forceCurrent" && !spec[property]))) {
      short[property] = spec[property];
    }
  }
  if (Object.keys(short).length === 1) {
    return short.url;
  }
  else if (Object.keys(short).length === 2 &&
      spec.levelComposition === "delta") {
    return `${spec.url} delta`;
  }
  else if (Object.keys(short).length === 2 &&
      spec.forceCurrent) {
    return `${spec.url} current`;
  }
  else {
    return short;
  }
}


// Lint specs list defined as a JSON string
function lintStr(specsStr) {
  const specs = JSON.parse(specsStr);

  // Normalize end of lines, different across platforms, for comparison
  specsStr = specsStr.replace(/\r\n/g, "\n");

  const isSchemaValid = ajv.validateSchema(schema);
  if (!isSchemaValid) {
    throw "The schema/specs.json file must be a valid JSON Schema file";
  }

  const isValid = validate(specs, { format: "full" });
  if (!isValid) {
    throw ajv.errorsText(clarifyErrors(validate.errors), {
      dataVar: "specs", separator: "\n"
    });
  }

  // Convert entries to spec objects, drop duplicates, and sort per URL
  const sorted = specs
    .map(spec => (typeof spec === "string") ?
      {
        url: new URL(spec.split(" ")[0]).toString(),
        levelComposition: (spec.split(' ')[1] === "delta") ? "delta" : "full",
        forceCurrent: (spec.split(' ')[1] === "current")
      } :
      Object.assign({}, spec, { url: new URL(spec.url).toString() }))
    .filter((spec, idx, list) =>
      !list.find((s, i) => i < idx && compareSpecs(s, spec) === 0))
    .sort(compareSpecs);

  // Make sure that we can generate names for all specifications or that
  // the specification already defines one. An exception will be thrown if not.
  // Generate links between levels to test list consistency
  const linkedList = sorted
    .map(s => Object.assign({}, s, computeShortname(s.name || s.url)))
    .map((s, _, list) => Object.assign({}, s, computePrevNext(s, list)));

  // Make sure that we do not end up with a delta spec for which we do not have
  // a previous "full" spec.
  // (Note the code considers that a delta spec of a delta spec is an error too.
  // That case could perhaps happen in practice and the "previousLevel" chain
  // can easily be followed to find the previous level that contains the "full"
  // spec. Still, it seems good to choke on it as long as that's not needed)
  const deltaWithoutFull = linkedList.filter((s, _, list) =>
    s.levelComposition === "delta" &&
    !list.find(p => p.levelComposition !== "delta" && p.name === s.previousLevel));
  if (deltaWithoutFull.length > 0) {
    throw "Delta spec(s) found without full previous level: " +
      deltaWithoutFull.map(s => s.url).join(" ");
  }

  // Make sure that there are no delta specs flagged as "current"
  const deltaCurrent = linkedList.filter(s =>
    s.forceCurrent && s.levelComposition === "delta");
  if (deltaCurrent.length > 0) {
    throw "Delta spec(s) found that are also flagged as current: " +
      deltaCurrent.map(s => s.url).join(" ");
  }

  // Make sure that there is only one spec flagged as "current" per shortname
  const problematicCurrent = linkedList
    .filter(s => s.forceCurrent)
    .filter(s => s !== linkedList.find(p =>
      p.shortname === s.shortname && p.forceCurrent));
  if (problematicCurrent.length > 0) {
    throw "Too many current specs for shortname(s): " +
      problematicCurrent.map(s => s.shortname).join(" ");
  }

  // Drop useless forceCurrent flag and shorten definition when possible
  const fixed = sorted
    .map(spec => {
      const linked = linkedList.find(p => p.url === spec.url);
      const next = linked.nextLevel ?
        linkedList.find(p => p.name === linked.nextLevel) :
        null;
      const isLastLevel = !next || next.levelComposition === "delta";
      if (spec.forceCurrent && isLastLevel) {
        spec.forceCurrent = false;
      }
      return spec;
    })
    .map(shortenDefinition);

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
