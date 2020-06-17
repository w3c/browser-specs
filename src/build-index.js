/**
 * Script that compiles and returns the final list of specs from the
 * "specs.json" input file.
 *
 * The script will extract the W3C API key it needs from a "config.json" file
 * in the root folder, which must exist and contain a "w3cApiKey" key.
 */

const computeShortname = require("./compute-shortname.js");
const computePrevNext = require("./compute-prevnext.js");
const computeCurrentLevel = require("./compute-currentlevel.js");
const fetchInfo = require("./fetch-info.js");
const { w3cApiKey } = require("../config.json");

const specs = require("../specs.json")
  // Turn all specs into objects
  // (and handle syntactic sugar notation for delta/current flags)
  .map(spec => {
    if (typeof spec === "string") {
      const parts = spec.split(" ");
      const res = { url: parts[0] };
      if (parts[1] === "delta") {
        res.seriesComposition = "delta";
      }
      else if (parts[1] === "current") {
        res.forceCurrent = true;
      }
      return res;
    }
    else {
      return spec;
    }
  })

  // Complete information and output result starting with the URL, names,
  // level, and additional info
  .map(spec => Object.assign(
    { url: spec.url, seriesComposition: spec.seriesComposition || "full" },
    computeShortname(spec.shortname || spec.url),
    spec))

  // Complete information with currentSpecification property and drop
  // forceCurrent flags that no longer need to be exposed
  .map((spec, _, list) => {
    Object.assign(spec.series, computeCurrentLevel(spec, list));
    return spec;
  })
  .map(spec => { delete spec.forceCurrent; return spec; })

  // Complete information with previous/next level links
  .map((spec, _, list) => Object.assign(spec, computePrevNext(spec, list)));


// Fetch additional spec info from external sources and complete the list
// Note on the "assign" call:
// - `{}` is needed to avoid overriding spec
// - `spec` appears first to impose the order of properties computed above in
// the resulting object
// - `specInfo[spec.shortname]` is the info we retrieved from the source
// - final `spec` ensures that properties defined in specs.json override info
// from the source.
fetchInfo(specs, { w3cApiKey })
  .then(specInfo => {
    const index = specs
      .map(spec => Object.assign({}, spec, specInfo[spec.shortname], spec));

    // Return the resulting list
    console.log(JSON.stringify(index, null, 2));
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });