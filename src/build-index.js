/**
 * Script that compiles and returns the final list of specs from the
 * "specs.json" input file.
 *
 * The script will extract the W3C API key and the github token it needs
 * from a "config.json" file in the root folder
 * which must exist and contain "w3cApiKey" and "GH_TOKEN" keys.
 */

const fs = require("fs").promises;
const path = require("path");
const computeShortname = require("./compute-shortname.js");
const computePrevNext = require("./compute-prevnext.js");
const computeCurrentLevel = require("./compute-currentlevel.js");
const computeRepository = require("./compute-repository.js");
const computeSeriesUrls = require("./compute-series-urls.js");
const computeShortTitle = require("./compute-shorttitle.js");
const computeCategories = require("./compute-categories.js");
const determineFilename = require("./determine-filename.js");
const determineTestPath = require("./determine-testpath.js");
const extractPages = require("./extract-pages.js");
const fetchInfo = require("./fetch-info.js");
const fetchGroups = require("./fetch-groups.js");
const { w3cApiKey } = require("../config.json");
const githubToken = (_ => {
  try {
    return require("../config.json").GH_TOKEN;
  }
  catch {
    return "";
  }
})() || process.env.GH_TOKEN;;


async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


/**
 * Generate the new index of specs from the given initial list.
 *
 * The function takes the previous index as optional parameter if it exists and
 * uses that list as fallback for filenames.
 *
 * The function also takes a log function to report progress (progress is
 * reported on the console by default).
 *
 * The function throws in case of errors.
 */
async function generateIndex(specs, { previousIndex = null, log = console.log } = {}) {
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

  log("Prepare initial list of specs...");
  specs = specs
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
    .map(spec => {
      // Backup series info explicitly set in initial spec object
      const series = spec.series;
      delete spec.series;

      // Complete information
      const res = Object.assign(
        { url: spec.url, seriesComposition: spec.seriesComposition || "full" },
        computeShortname(spec.shortname || spec.url),
        spec);

      // Restore series info explicitly set in initial spec object
      if (series) {
        res.series = Object.assign(res.series, series);
      }
      return res;
    })

    // Complete information with currentSpecification property and drop
    // forceCurrent flags that no longer need to be exposed
    .map((spec, _, list) => {
      Object.assign(spec.series, computeCurrentLevel(spec, list));
      return spec;
    })
    .map(spec => { delete spec.forceCurrent; return spec; })

    // Complete information with previous/next level links
    .map((spec, _, list) => Object.assign(spec, computePrevNext(spec, list)));
  log(`Prepare initial list of specs... found ${specs.length} specs`);

  // Fetch additional spec info from external sources and complete the list
  log(`Fetch organization/groups info...`);
  await fetchGroups(specs, { githubToken, w3cApiKey });
  log(`Fetch organization/groups info... done`);

  log(`Fetch other spec info from external sources...`);
  const specInfo = await fetchInfo(specs, { w3cApiKey });
  const index = specs.map(spec => {
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

    // Set the series title based on the info returned by the W3C API if
    // we have it, or compute the series title ourselves
    const seriesInfo = specInfo.__series[spec.series.shortname];
    if (seriesInfo?.title && !res.series.title) {
      res.series.title = seriesInfo.title;
    }
    else {
      res.series.title = res.title
        .replace(/ \d+(\.\d+)?$/, '')         // Drop level number
        .replace(/( -)? Level$/, '')          // Drop "Level"
        .replace(/ Module$/, '');             // Drop "Module"
    }

    // Update the current specification based on the info returned by the
    // W3C API, unless specs.json imposed a specific level.
    // Note: the current specification returned by the W3C API may not be in the
    // list, since we tend not to include previous levels for IDL specs (even
    // if they are still "current"), in which case we'll just ignore the info
    // returned from the W3C API.
    if (seriesInfo?.currentSpecification &&
        !res.series.forceCurrent &&
        (seriesInfo.currentSpecification !== res.series.currentSpecification) &&
        specs.find(s => s.shortname === seriesInfo.currentSpecification)) {
      res.series.currentSpecification = seriesInfo.currentSpecification;
    }
    delete res.series.forceCurrent;
    return res;
  });
  log(`Fetch other spec info from external sources... done`);

  log(`Compute short titles...`);
  index.forEach(spec => {
    if (spec.shortTitle) {
      // Use short title explicitly set in specs.json
      // and compute the series short title from it
      spec.series.shortTitle = spec.series.shortTitle ?? computeShortTitle(spec.shortTitle);
    }
    else {
      // Compute short title from title otherwise
      spec.shortTitle = computeShortTitle(spec.title);
      spec.series.shortTitle = spec.series.shortTitle ?? computeShortTitle(spec.series.title);
    }

    // Drop level number from series short title
    spec.series.shortTitle = spec.series.shortTitle.replace(/ \d+(\.\d+)?$/, '');
  });
  log(`Compute short titles... done`);

  log(`Compute repositories...`);
  await computeRepository(index, { githubToken });
  log(`Compute repositories... done`);

  log(`Compute categories...`);
  index.forEach(spec => {
    spec.categories = computeCategories(spec);
  });
  log(`Compute categories... done`);

  log(`Find info about test suites...`);
  await determineTestPath(index, { githubToken });
  log(`Find info about test suites... done`);

  log(`Compute unversioned URLs...`);
  index.forEach(spec => {
    Object.assign(spec.series, computeSeriesUrls(spec, index));
  });
  log(`Compute unversioned URLs... done`);

  log(`Compute pages for multi-pages specs...`);
  await Promise.all(
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
  );
  log(`Compute pages for multi-pages specs... done`);

  log(`Determine spec filenames...`);
  await Promise.all(
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
  );
  log(`Determine spec filenames... done`);

  return index;
}


/**
 * Generate the new index file from the given initial list file.
 *
 * The function throws in case of errors.
 */
async function generateIndexFile(specsFile, targetFile) {
  // If the index already exists, reuse the info it contains when info cannot
  // be refreshed due to some external (network) issue.
  const previousIndex = (function () {
    try {
      return require(path.resolve(targetFile));
    }
    catch (err) {
      return [];
    }
  })();

  const specs = require(path.resolve(specsFile));
  const index = await generateIndex(specs, { previousIndex });
  console.log(`Write ${targetFile}...`);
  await fs.writeFile(targetFile, JSON.stringify(index, null, 2));
  console.log(`Write ${targetFile}... done`);
}


/*******************************************************************************
Export functions for use as module
*******************************************************************************/
module.exports = {
  generateIndex,
  generateIndexFile
};


/*******************************************************************************
Main loop
*******************************************************************************/
if (require.main === module) {
  const specsFile = process.argv[2] ?? path.join(__dirname, "..", "specs.json");
  const indexFile = process.argv[3] ?? path.join(__dirname, "..", "index.json");

  generateIndexFile(specsFile, indexFile)
    .then(() => {
      console.log();
      console.log("== The end ==");
    })
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}