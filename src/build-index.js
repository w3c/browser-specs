/**
 * Script that compiles and returns the final list of specs from the
 * "specs.json" input file.
 *
 * The script will extract the W3C API key it needs from a "config.json" file
 * in the root folder, which must exist and contain a "w3cApiKey" key.
 */

const fs = require("fs").promises;
const path = require("path");
const computeShortname = require("./compute-shortname.js");
const computePrevNext = require("./compute-prevnext.js");
const computeCurrentLevel = require("./compute-currentlevel.js");
const computeRepository = require("./compute-repository.js");
const computeShortTitle = require("./compute-shorttitle.js");
const determineFilename = require("./determine-filename.js");
const extractPages = require("./extract-pages.js");
const fetchInfo = require("./fetch-info.js");
const { w3cApiKey } = require("../config.json");

// If the index already exists, reuse the info it contains when info cannot
// be refreshed due to some external (network) issue.
const previousIndex = (function () {
  try {
    return require("../index.json");
  }
  catch (err) {
    return [];
  }
})();

// Use previous filename info when it cannot be determined (this usually means
// that there was a transient network error)
async function determineSpecFilename(spec, type) {
  const filename = await determineFilename(spec[type].url);
  if (filename) {
    return filename;
  }

  const previous = previousIndex.find(s => s[type] && s.url === spec.url);
  return previous ? previous[type].filename : null;
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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
      else if (parts[1] === "multipage") {
        res.multipage = true;
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
  .then(specInfo => specs.map(spec =>
    Object.assign({}, spec, specInfo[spec.shortname], spec)))

  // Complete with short title
  .then(index => index.map(spec => {
    spec.shortTitle = spec.shortTitle || computeShortTitle(spec.title);
    return spec;
  }))

  // Complete with repository
  .then(index => computeRepository(index))

  // Complete with list of pages for multipage specs
  .then(index => Promise.all(
    index.map(async spec => {
      if (spec.multipage) {
        if (spec.release) {
          spec.release.pages = await extractPages(spec.release.url);
        }
        if (spec.nightly) {
          spec.nightly.pages = await extractPages(spec.nightly.url);
        }
        delete spec.multipage;
      }
      return spec;
    })
  ))

  // Complete with filename
  .then(index => Promise.all(
    index.map(async spec => {
      spec.nightly.filename = await determineSpecFilename(spec, "nightly");
      if (spec.release) {
        spec.release.filename = await determineSpecFilename(spec, "release");
      }

      // Sleep a bit as draft CSS WG server does not seem to like receiving too
      // many requests in a row.
      await sleep(50);

      return spec;
    })
  ))

  // Output the result to index.json
  .then(index => fs.writeFile(
    path.resolve(__dirname, "..", "index.json"),
    JSON.stringify(index, null, 2)
  ))

  // Report any error along the way
  .catch(err => {
    console.error(err);
    process.exit(1);
  });