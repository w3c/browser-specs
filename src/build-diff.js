/**
 * Script that builds the diff that the provided change(s) to `specs.json`
 * would entail to `index.json`.
 *
 * The script takes the canonical URL of a spec as input, or a "git diff"-like
 * reference to named commit(s), in which case it compiles the list of changes
 * from the differences in `specs.json` between both commits. It computes the
 * updates that the update(s) would trigger to `index.json` and reports the
 * diff in a JSON structure with `add`, `update`, `delete`, and `seriesUpdate`
 * properties.
 *
 * For named commits, "working" is the equivalent of Git's "--cached" option
 * and means "use the working copy of specs.json".
 *
 * Examples:
 * node src/build-diff https://www.w3.org/TR/webrtc/
 * node src/build-diff working
 * node src/build-diff HEAD
 * node src/build-diff HEAD..HEAD~3
 */

const assert = require("assert");
const path = require("path");
const { execSync } = require("child_process");
const { generateIndex } = require("./build-index");
const computeShortname = require("./compute-shortname.js");

/**
 * Spec sort function.
 *
 * Lists are sorted by ascending URL.
 */
function compareSpecs(a, b) {
  return a.url.localeCompare(b.url);
}

/**
 * Return the URL of the provided `specs.json` entry.
 *
 * The argument may be a string or a spec object.
 */
function getUrl(spec) {
  return (typeof spec === "string") ? spec.split(' ')[0] : spec.url;
}

/**
 * Return true if provided `specs.json` entries have the same URL
 *
 * The arguments may be strings or spec objects.
 */
function haveSameUrl(s1, s2) {
  const url1 = getUrl(s1);
  const url2 = getUrl(s2);
  return url1 === url2;
}

/**
 * Return true if provided `specs.json` entries are distinct specs in the same
 * series.
 *
 * The arguments may be strings or spec objects.
 */
function areDistinctSpecsInSameSeries(s1, s2) {
  const spec1 = (typeof s1 === "string") ? { url: getUrl(s1) } : s1;
  const spec2 = (typeof s2 === "string") ? { url: getUrl(s2) } : s2;
  if (spec1.url === spec2.url) {
    return false;
  }
  try {
    const computed1 = computeShortname(spec1.shortname ?? spec1.url, spec1.forkOf);
    const computed2 = computeShortname(spec2.shortname ?? spec2.url, spec2.forkOf);
    const series1 = spec1?.series?.shortname ?? computed1.series.shortname;
    const series2 = spec2?.series?.shortname ?? computed2.series.shortname;
    return series1 === series2;
  }
  catch {
    return false;
  }
}

/**
 * Return true if provided spec entries are identical.
 *
 * The arguments must be spec objects.
 */
function areIdentical(s1, s2) {
  try {
    assert.deepStrictEqual(s1, s2);
    return true;
  }
  catch {
    return false;
  }
}


/**
 * Build the diff for the given spec or list of changes. The first parameter
 * may be the canonical URL of a spec, a named Git commit, or two named Git
 * commits separated by two dots. Named Git commit are used to compile the
 * changes in specs.json that need to be built.
 *
 * For instance:
 * - https://w3c.github.io/example-spec/
 * - HEAD
 * - HEAD..HEAD~3
 *
 * Internally, the function branches to `buildCommits` or `buildSpec`
 * depending on what needs to be built.
 *
 * If what to build is the canonical URL of a spec and the options contain a
 * `custom` property, that property is used to complete the initial info for
 * the spec.
 *
 * The function throws in case of errors.
 */
async function build(what, options) {
  if (!what) {
    throw new Error('Nothing to build');
  }
  const reCommit = /^([\w~\^]+)(?:\.\.([\w~\^]+))?$/;
  const commitMatch = what.match(reCommit);
  if (commitMatch) {
    // We seem to have received a named <commit>
    let from = commitMatch[2];
    const to = commitMatch[1];
    if (!from) {
      from = (to.toLowerCase() === 'working') ? 'HEAD' : 'HEAD~1';
    }
    return buildCommits(to, from, options);
  }
  else {
    // We seem to have received a URL
    let url;
    try {
      url = new URL(what);
    }
    catch (err) {
      throw new Error('Invalid what argument received. Should be a URL, a named commit, or a couple of named commit separated by two dots (..)');
    }
    const custom = options?.custom ?? {};
    const spec = Object.assign({}, custom, { url: url.toString() });
    return buildSpec(spec, options);
  }
}


/**
 * Build the diff for changes made to `specs.json` between the provided named
 * Git commits.
 *
 * Internally, the function compiles the diff and then hands it over to
 * `buildDiff`.
 *
 * The function throws in case of errors.
 */
async function buildCommits(newRef, baseRef, { diffType = "diff", log = console.log }) {
  log(`Retrieve specs.json at "${newRef}"...`);
  let newSpecs;
  if (newRef.toLowerCase() === "working") {
    newSpecs = require(path.resolve(__dirname, "..", "specs.json"));
  }
  else {
    const newSpecsStr = execSync(`git show ${newRef}:specs.json`, { encoding: "utf8" });
    newSpecs = JSON.parse(newSpecsStr);
  }
  log(`Retrieve specs.json at "${newRef}"... done`);

  log(`Retrieve specs.json at "${baseRef}"...`);
  const baseSpecsStr = execSync(`git show ${baseRef}:specs.json`, { encoding: "utf8" });
  const baseSpecs = JSON.parse(baseSpecsStr);
  log(`Retrieve specs.json at "${baseRef}"... done`);  

  log(`Retrieve index.json at "${baseRef}"...`);
  const baseIndexStr = execSync(`git show ${baseRef}:index.json`, { encoding: "utf8" });
  const baseIndex = JSON.parse(baseIndexStr);
  log(`Retrieve index.json at "${baseRef}"... done`);

  log(`Compute specs.json diff...`);
  const diff = {
    add: newSpecs.filter(spec => !baseSpecs.find(s => haveSameUrl(s, spec))),
    update: newSpecs.filter(spec =>
      !!baseSpecs.find(s => haveSameUrl(s, spec)) &&
      !baseSpecs.find(s => JSON.stringify(s) === JSON.stringify(spec))),
    delete: baseSpecs.filter(spec => !newSpecs.find(s => haveSameUrl(s, spec)))
  };
  if (diff.add.length || diff.update.length || diff.delete.length) {
    for (const type of ['add', 'update', 'delete']) {
      for (const spec of diff[type]) {
        log(`- ${type} ${getUrl(spec)}`);
      }
    }
  }
  else {
    log(`- no diff found`);
  }
  log(`Compute specs.json diff... done`);

  return buildDiff(diff, baseSpecs, baseIndex, { diffType, log });
}


/**
 * Build the diff for the given spec.
 *
 * The spec object must have a `url` property. It may have other properties.
 *
 * Internally, the function turns the parameter into a diff and hands it over
 * to `buildSpec`.
 *
 * The function throws in case of errors.
 */
async function buildSpec(spec, { diffType = "diff", log = console.log }) {
  log(`Retrieve specs.json...`);
  const baseSpecs = require(path.resolve(__dirname, "..", "specs.json"));
  log(`Retrieve specs.json... done`);

  log(`Retrieve index.json...`);
  const baseIndex = require(path.resolve(__dirname, "..", "index.json"));
  log(`Retrieve index.json... done`);

  log(`Prepare diff...`);
  const isNew = !baseSpecs.find(s => haveSameUrl(s, spec));
  log(isNew ? `- spec is new` : `- spec is already in specs.json`);
  const diff = {
    add: isNew ? [spec] : [],
    update: isNew ? [] : [spec],
    delete: []
  };
  log(`Prepare diff... done`);

  return buildDiff(diff, baseSpecs, baseIndex, { diffType, log });
}


async function buildDiff(diff, baseSpecs, baseIndex, { diffType = "diff", log = console.log }) {
  diff = Object.assign({}, diff);
  log(`Delete specs that were dropped...`);
  diff.delete = baseIndex.filter(spec => diff.delete.find(s => haveSameUrl(s, spec)));
  let newIndex = baseIndex.filter(spec => !diff.delete.find(s => haveSameUrl(s, spec)));
  log(`Delete specs that were dropped... done`);

  log(`Build new/updated entries...`);
  const needBuild = []
    .concat(diff.add)
    .concat(diff.update)
    .map(spec => [spec].concat(baseSpecs.filter(s => areDistinctSpecsInSameSeries(s, spec))))
    .concat(diff.delete.map(spec => baseSpecs.filter(s => areDistinctSpecsInSameSeries(s, spec))))
    .flat();
  const built = (needBuild.length === 0) ? [] :
    await generateIndex(needBuild, {
      previousIndex: newIndex,
      log: function(...msg) { log(' ', ...msg); } });
  diff.add = diff.add.map(spec => built.find(s => haveSameUrl(s, spec)));
  diff.update = diff.update
    .map(spec => built.find(s => haveSameUrl(s, spec)))
    .filter(spec => !areIdentical(spec, baseIndex.find(s => s.url === spec.url)));
  diff.seriesUpdate = built
    .filter(spec =>
      !diff.add.find(s => haveSameUrl(s, spec)) &&
      !diff.update.find(s => haveSameUrl(s, spec)))
    .filter(spec => !areIdentical(spec, baseIndex.find(s => s.url === spec.url)));
  log(`Build new/updated entries... done`);

  if (diffType === "full") {
    log(`Create full new index...`);
    newIndex = newIndex
      .filter(spec => !built.find(s => haveSameUrl(s, spec)))
      .concat(built);
    newIndex.sort(compareSpecs);
    log(`Create full new index... done`);
    return newIndex;
  }
  else {
    return diff;
  }
}


/*******************************************************************************
Export main function for use as module
*******************************************************************************/
module.exports = {
  build,
  buildCommits,
  buildSpec
};


/*******************************************************************************
Main loop
*******************************************************************************/
if (require.main === module) {
  const what = process.argv[2] ?? "working";
  const diffType = process.argv[3] ?? "diff";

  build(what, { diffType, log: console.warn })
    .then(diff => {
      // Note: using process.stdout.write to avoid creating a final newline in
      // "full" diff mode. This makes it easier to compare the result with the
      // index.json file in the repo (which does not have a final newline).
      process.stdout.write(JSON.stringify(diff, null, 2));
    })
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}