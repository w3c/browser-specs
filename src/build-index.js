/**
 * Script that compiles and returns the final list of specs from the
 * "specs.json" input file.
 *
 * The script will extract the github token it needs from a "config.json" file
 * in the root folder or from a `GITHUB_TOKEN` environment variable.
 */

const fs = require("fs").promises;
const path = require("path");
const puppeteer = require("puppeteer");
const os = require("os");
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const computeShortname = require("./compute-shortname.js");
const computePrevNext = require("./compute-prevnext.js");
const computeCurrentLevel = require("./compute-currentlevel.js");
const computeRepository = require("./compute-repository.js");
const computeSeriesUrls = require("./compute-series-urls.js");
const computeAlternateUrls = require("./compute-alternate-urls.js");
const computeShortTitle = require("./compute-shorttitle.js");
const computeCategories = require("./compute-categories.js");
const computeStanding = require("./compute-standing.js");
const determineFilename = require("./determine-filename.js");
const determineTestPath = require("./determine-testpath.js");
const extractPages = require("./extract-pages.js");
const fetchInfo = require("./fetch-info.js");
const fetchGroups = require("./fetch-groups.js");
const githubToken = (_ => {
  try {
    return require("../config.json").GITHUB_TOKEN;
  }
  catch {
    return null;
  }
})() ?? process.env.GITHUB_TOKEN;


async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


/**
 * Build steps, in order of execution
 **/
const steps = [
  {
    shortname: "initial",
    title: "Prepare initial list of specs",
    run: runSkeleton
  },
  {
    shortname: "previous",
    title: "Retrieve last published info",
    run: runFetchLastPublished
  },
  {
    shortname: "groups",
    title: "Fetch organization/groups info",
    run: index => fetchGroups(index, { githubToken })
  },
  {
    shortname: "info",
    title: "Fetch other spec info from external sources",
    run: runInfo
  },
  {
    shortname: "shortTitle",
    title: "Compute short titles",
    run: runShortTitle
  },
  {
    shortname: "repository",
    title: "Determine repositories",
    run: index => computeRepository(index, { githubToken })
  },
  {
    shortname: "standing",
    title: "Compute categories and standing",
    run: async index => index.map(spec => {
      spec.categories = computeCategories(spec);
      spec.standing = computeStanding(spec);
      return spec;
    })
  },
  {
    shortname: "testpath",
    title: "Find info about test suites",
    run: index => determineTestPath(index, { githubToken })
  },
  {
    shortname: "seriesurl",
    title: "Compute unversioned URLs",
    run: async index => index.map(spec => {
      Object.assign(spec.series, computeSeriesUrls(spec, index));
      return spec;
    })
  },
  {
    shortname: "pages",
    title: "Compute pages for multi-pages specs",
    run: runPages
  },
  {
    shortname: "filename",
    title: "Determine spec filenames",
    run: runFilename
  },
  {
    // Last step is almost a fake one, only there to copy the result of the
    // last step to the final index file, leaving out temp data
    shortname: "index",
    title: "Copy result of last step",
    run: index => index.map(spec => {
      if (spec.__last) {
        delete spec.__last;
      }
      return spec;
    })
  }
];


async function runSkeleton(specs, { log }) {
  index = specs
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
          res.multipage = "all";
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
      const seriesComposition = spec.seriesComposition ??
        (spec.forkOf ? "fork" : "full");
      const res = Object.assign(
        { url: spec.url, seriesComposition },
        computeShortname(spec.shortname ?? spec.url, spec.forkOf),
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
    .map((spec, _, list) => Object.assign(spec, computePrevNext(spec, list)))

    // Complete information with forks
    .map((spec, _, list) => {
      const forks = list.filter(s =>
          s.series.shortname === spec.series.shortname &&
          s.seriesComposition === "fork" &&
          s.forkOf === spec.shortname)
        .map(s => s.shortname);
      if (forks.length > 0) {
        spec.forks = forks;
      }
      return spec;
    });
  log(`- found ${index.length} specs`);
  return index;
}

async function runFetchLastPublished(index) {
  const tmpdir = await fs.mkdtemp(path.join(os.tmpdir(), 'web-specs-'));
  await exec('npm install web-specs', { cwd: tmpdir });
  const lastIndexFile = path.join(tmpdir, 'node_modules', 'web-specs', 'index.json');
  const lastIndexStr = await fs.readFile(lastIndexFile, 'utf8');
  const lastIndex = JSON.parse(lastIndexStr);
  const decoratedIndex = index.map(spec => {
    const last = lastIndex.find(s => s.shortname === spec.shortname);
    if (last) {
      spec.__last = last;
    }
    return spec;
  });
  try {
    await fs.rmdir(tmpdir, { recursive: true });
  } catch {}
  return decoratedIndex;
}

async function runInfo(specs) {
  const specInfo = await fetchInfo(specs);
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

    // Latest ED link in TR versions of CSS specs sometimes target the spec series
    // entry point on the CSS drafts server. To make sure that the nightly URL
    // targets the same level as the TR level we're looking at, we'll add the
    // level to the nightly URL when it's not already there, unless the nightly
    // URL was set explicitly in specs.json (note the resulting URL should always
    // exist given the way the CSS drafts server is setup)
    if (!spec.nightly?.url &&
        res.seriesVersion &&
        res.nightly &&
        res.nightly.url.match(/\/drafts\.(?:csswg|fxtf|css-houdini)\.org/) &&
        !res.nightly.url.match(/\d+\/$/)) {
      res.nightly.url = res.nightly.url.replace(/\/$/, `-${res.seriesVersion}/`);
    }

    // Set the series title based on the info returned by the W3C API if
    // we have it, or compute the series title ourselves
    const seriesInfo = specInfo.__series[spec.series.shortname];
    if (seriesInfo?.title && !res.series.title) {
      res.series.title = seriesInfo.title;
    }
    else if (!res.series.title) {
      res.series.title = res.title
        .replace(/ \d+(\.\d+)?$/, '')           // Drop level number
        .replace(/( -)? Level$/, '')            // Drop "Level"
        .replace(/ Module$/, '')                // Drop "Module"
        .replace(/^(RDF|SPARQL) \d\.\d/, '$1'); // Handle RDF/SPARQL titles
    }

    // Update the current specification based on the info returned by the
    // W3C API, unless specs.json imposed a specific level.
    // Note: the current specification returned by the W3C API may not be in the
    // list, since we tend not to include previous levels for IDL specs (even
    // if they are still "current"), in which case we'll just ignore the info
    // returned from the W3C API. Also, for CSS specs, the current specification
    // returned by the W3C API is actually the latest CSS snapshot which is in a
    // different specification series for us.
    if (seriesInfo?.currentSpecification &&
        !res.series.forceCurrent &&
        (seriesInfo.currentSpecification !== res.series.currentSpecification) &&
        specs.find(s => s.shortname === seriesInfo.currentSpecification &&
                        s.series.shortname === res.series.shortname)) {
      res.series.currentSpecification = seriesInfo.currentSpecification;
    }
    delete res.series.forceCurrent;

    // If we're reusing last published discontinued info,
    // forget alternate URLs and rebuild them from scratch.
    if (res.nightly) {
      if (res.__last?.standing === 'discontinued' &&
          (!res.standing || res.standing === 'discontinued')) {
        res.nightly.alternateUrls = [];
      }
      else if (!res.nightly.alternateUrls) {
        res.nightly.alternateUrls = [];
      }
      res.nightly.alternateUrls = res.nightly.alternateUrls.concat(computeAlternateUrls(res));
    }

    return res;
  });
  return index;
}


async function runShortTitle(index) {
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
  return index;
}


async function runPages(index) {
  const browser = await puppeteer.launch();
  try {
    for (const spec of index) {
      if (spec.release && (spec.multipage === "all" || spec.multipage === "release")) {
        spec.release.pages = await extractPages(spec.release.url, browser);
      }
      if (spec.nightly && (spec.multipage === "all" || spec.multipage === "nightly")) {
        spec.nightly.pages = await extractPages(spec.nightly.url, browser);
      }
      if (spec.hasOwnProperty("multipage")) {
        delete spec.multipage;
      }
    }
  }
  finally {
    await browser.close();
  }
  return index;
}


async function runFilename(index, { previousIndex, log }) {
  for (const spec of index) {
    const previous = previousIndex.find(s => s.url === spec.url);
    for (const type of ['nightly', 'release']) {
      if (spec[type]) {
        if (spec[type].filename) {
          log(`- use explicit ${type} filename "${spec.nightly.filename}" for ${spec.shortname}`);
        }
        else if (previous && previous[type] && previous[type].filename) {
          // Just re-use previous operation
          spec[type].filename = previous[type].filename;
        }
        else {
          log(`- determine ${type} filename for ${spec.shortname}`);
          spec[type].filename = await determineFilename(spec[type].url);

          // Sleep a bit as draft CSS WG server does not seem to like receiving too
          // many requests in a row.
          await sleep(1000);
        }
      }
    }
  }
  return index;
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
async function generateIndex(specs, { step = "all", previousIndex = null, log = console.log } = {}) {
  let index = specs;

  const actualSteps = steps.filter(s => step === "all" || s.shortname === step);
  for (const step of actualSteps) {
    log(`${step.title}...`);
    index = await step.run(index, { previousIndex, log });
    log(`${step.title}... done`);
  }

  return index;
}


/**
 * Generate the new index file from the given initial list file.
 *
 * The function throws in case of errors.
 */
async function generateIndexFile(specsFile, targetFile, step) {
  // If the index already exists, reuse the info it contains when info cannot
  // be refreshed due to some external (network) issue.
  const previousIndex = await (async function () {
    try {
      const json = await fs.readFile(path.join(__dirname, "..", "index.json"), 'utf8');
      return JSON.parse(json);
    }
    catch (err) {
      return [];
    }
  })();

  const specsJson = await fs.readFile(path.resolve(specsFile));
  const specs = JSON.parse(specsJson);
  const index = await generateIndex(specs, { previousIndex, step });
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
  const fileOrStep = process.argv[2];
  const pad = idx => (idx < 10) ? ('0' + idx) : idx;

  async function mainLoop() {
    const buildstepsFolder = path.join(__dirname, "..", ".buildsteps");

    async function createBuildStepsFolderIfNeeded() {
      try {
        const stat = await fs.stat(buildstepsFolder);
        if (!stat.isDirectory()) {
          throw new Error('Looking for a cache folder but found a cache file instead');
        }
      }
      catch (err) {
        // Create the folder if it does not exist yet
        if (err.code !== 'ENOENT') {
          throw err;
        }
        try {
          await fs.mkdir(buildstepsFolder);
        }
        catch (mkerr) {
          // Someone may have created the folder in the meantime
          if (mkerr.code !== 'EEXIST') {
            throw mkerr;
          }
        }
      }
    }

    function getStepFiles(step) {
      const stepPos = steps.findIndex(s => s.shortname === step)  + 1;
      const prevPos = stepPos - 1;
      let specsFile;
      let indexFile;
      if (stepPos === 1) {
        specsFile = path.join(__dirname, "..", "specs.json");
      }
      else {
        const prevStep = steps[prevPos - 1].shortname;
        specsFile = path.join(buildstepsFolder, `${pad(prevPos)}-${prevStep}.json`);
      }
      if (step === "index") {
        indexFile = path.join(__dirname, "..", "index.json");
      }
      else {
        indexFile = path.join(buildstepsFolder, `${pad(stepPos)}-${step}.json`);
      }
      return { specsFile, indexFile };
    }

    if (!fileOrStep) {
      // Build index file, step by step
      for (const buildstep of steps) {
        const { specsFile, indexFile } = getStepFiles(buildstep.shortname);
        await createBuildStepsFolderIfNeeded();
        await generateIndexFile(specsFile, indexFile, buildstep.shortname);
      }
    }
    else if (fileOrStep.endsWith(".json")) {
      // Source/Target files and step as parameters
      const specsFile = fileOrStep;
      const indexFile = process.argv[3] ?? path.join(__dirname, "..", "index.json");
      const step = process.argv[4] ?? "all";
      await generateIndexFile(specsFile, indexFile, step);
    }
    else {
      // Step as unique parameter, either step index or step name
      let step;
      if (fileOrStep.match(/^\d+$/)) {
        stepIndex = parseInt(fileOrStep, 10);
        step = steps[stepIndex - 1].shortname;
      }
      else {
        step = fileOrStep;
      }
      if (step === "all") {
        // Not really a step, just run the entire build
        const specsFile = path.join(__dirname, "..", "specs.json");
        const indexFile = path.join(__dirname, "..", "index.json");
        await generateIndexFile(specsFile, indexFile, step);
      }
      else {
        // Create intermediary files (except for last step)
        const { specsFile, indexFile } = getStepFiles(step);
        await createBuildStepsFolderIfNeeded();
        await generateIndexFile(specsFile, indexFile, step);
      }
    }
  }

  mainLoop()
    .then(() => {
      console.log();
      console.log("== The end ==");
    })
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}
