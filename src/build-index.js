/**
 * Script that compiles and returns the final list of specs from the
 * "specs.json" input file.
 *
 * The script will extract the W3C API key and the github token it needs
 * from a "config.json" file in the root folder
 * which must exist and contain "w3cApiKey" and "githubToken" keys.
 */

const fs = require("fs").promises;
const path = require("path");
const computeShortname = require("./compute-shortname.js");
const computePrevNext = require("./compute-prevnext.js");
const computeCurrentLevel = require("./compute-currentlevel.js");
const computeRepository = require("./compute-repository.js");
const computeSeriesUrls = require("./compute-series-urls.js");
const computeShortTitle = require("./compute-shorttitle.js");
const determineFilename = require("./determine-filename.js");
const determineTestPath = require("./determine-testpath.js");
const extractPages = require("./extract-pages.js");
const fetchInfo = require("./fetch-info.js");
const fetchGroups = require("./fetch-groups.js");
const { w3cApiKey } = require("../config.json");
const githubToken = (_ => {
  try {
    return require("../config.json").githubToken;
  }
  catch {
    return "";
  }
})() || process.env.GITHUB_TOKEN;;

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

// Log function that can be inserted in a "then" chain
function dolog(msg) {
  return arg => {
    console.log(msg);
    return arg;
  };
}

console.log("Prepare initial list of specs...");
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
console.log(`Prepare initial list of specs... done with ${specs.length} specs`);


// Fetch additional spec info from external sources and complete the list
console.log(`Fetch organization/groups info...`);
fetchGroups(specs, { githubToken, w3cApiKey })
  .then(dolog(`Fetch organization/groups info... done`))

  .then(dolog(`Fetch other spec info from external sources...`))
  .then(_ => fetchInfo(specs, { w3cApiKey }))
  .then(specInfo => specs.map(spec => {
    // Make a copy of the spec object and extend it with the info we retrieved
    // from the source
    const res = Object.assign({}, spec, specInfo[spec.shortname]);

    // Specific info in specs.json overrides info from the source
    // (but note we go one level deeper not to override the entire "nightly"
    // property, as specs.json may only override one of its sub-properties).
    Object.keys(spec).forEach(key => {
      if (res[key] && (typeof spec[key] === 'object')) {
        Object.assign(res[key], spec[key]);
      }
      else {
        res[key] = spec[key];
      }
    });

    // Update the current specification based on the info returned by the
    // W3C API, unless specs.json imposed a specific level.
    // Note: the current specification returned by the W3C API may not be in the
    // list, since we tend not to include previous levels for IDL specs (even
    // if they are still "current"), in which case we'll just ignore the info
    // returned from the W3C API.
    const currentSpecification = specInfo.__current ?
      specInfo.__current[spec.series.shortname] : null;
    if (currentSpecification &&
        !spec.series.forceCurrent &&
        (currentSpecification !== spec.series.currentSpecification) &&
        specs.find(s => s.shortname === currentSpecification)) {
      res.series.currentSpecification = currentSpecification;
    }
    delete res.series.forceCurrent;
    return res;
  }))
  .then(dolog(`Fetch other spec info from external sources... done`))

  .then(dolog(`Compute short titles...`))
  .then(index => index.map(spec => {
    spec.shortTitle = spec.shortTitle || computeShortTitle(spec.title);
    return spec;
  }))
  .then(dolog(`Compute short titles... done`))

  .then(dolog(`Compute repositories...`))
  .then(index => computeRepository(index, { githubToken }))
  .then(dolog(`Compute repositories... done`))

  .then(dolog(`Find info about test suites...`))
  .then(index => determineTestPath(index, { githubToken }))
  .then(dolog(`Find info about test suites... done`))

  .then(dolog(`Compute unversioned URLs...`))
  .then(index => index.map(spec => {
    Object.assign(spec.series, computeSeriesUrls(spec, index));
    return spec;
  }))
  .then(dolog(`Compute unversioned URLs... done`))

  .then(dolog(`Compute pages for multi-pages specs...`))
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
  .then(dolog(`Compute pages for multi-pages specs... done`))

  .then(dolog(`Determine spec filenames...`))
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
  .then(dolog(`Determine spec filenames... done`))

  .then(dolog(`Write index.json...`))
  .then(index => fs.writeFile(
    path.resolve(__dirname, "..", "index.json"),
    JSON.stringify(index, null, 2)
  ))
  .then(dolog(`Write index.json... done`))

  // Report any error along the way
  .catch(err => {
    console.error(err);
    process.exit(1);
  });