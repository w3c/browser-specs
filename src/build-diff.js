const path = require("path");
const { execSync } = require("child_process");
const { generateIndex } = require("./build-index");

function compareSpecs(a, b) {
  return a.url.localeCompare(b.url);
}

/**
 * Generate the new index file from the given initial list file.
 *
 * The function throws in case of errors.
 */
async function compareIndex(newRef, baseRef, { diffType = "diff", log = console.log }) {
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
  function hasSameUrl(s1, s2) {
    const url1 = (typeof s1 === "string") ? s1 : s1.url;
    const url2 = (typeof s2 === "string") ? s2 : s2.url;
    return url1 === url2;
  }
  const diff = {
    added: newSpecs.filter(spec => !baseSpecs.find(s => hasSameUrl(s, spec))),
    updated: newSpecs.filter(spec =>
      !!baseSpecs.find(s => hasSameUrl(s, spec)) &&
      !baseSpecs.find(s => JSON.stringify(s) === JSON.stringify(spec))),
    deleted: baseSpecs.filter(spec => !newSpecs.find(s => hasSameUrl(s, spec)))
  };
  log(`Compute specs.json diff... done`);

  log(`Build specs that were added...`);
  diff.added = (diff.added.length === 0) ? [] :
    await generateIndex(diff.added, {
      previousIndex: baseIndex,
      log: function(...msg) { log(' ', ...msg); } });
  log(`Build specs that were added... done`);

  log(`Build specs that were updated...`);
  diff.updated = (diff.updated.length === 0) ? [] :
    await generateIndex(diff.updated, {
      previousIndex: baseIndex,
      log: function(...msg) { log(' ', ...msg); } });
  log(`Build specs that were updated... done`);

  log(`Retrieve specs that were dropped...`);
  diff.deleted = diff.deleted.map(spec => baseIndex.find(s => hasSameUrl(s, spec)));
  log(`Retrieve specs that were dropped... done`);

  if (diffType === "full") {
    log(`Create full new index...`);
    const newIndex = baseIndex
      .map(spec => {
        const updated = diff.updated.find(s => hasSameUrl(s, spec));
        return updated ?? spec;
      })
      .filter(spec => !diff.deleted.find(s => hasSameUrl(s, spec)));
    diff.added.forEach(spec => newIndex.push(spec));
    newIndex.sort(compareSpecs);
    log(`Create full new index... done`);
    return newIndex;
  }
  else {
    return diff;
  }
}


/*******************************************************************************
Main loop
*******************************************************************************/
const newRef = process.argv[2] ?? "working";
const baseRef = process.argv[3] ?? "HEAD";
const diffType = process.argv[4] ?? "diff";

compareIndex(newRef, baseRef, { diffType, log: console.warn })
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
