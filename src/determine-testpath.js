/**
 * Module that takes a list of spec objects as input and returns, for each spec,
 * the URL of the repository that contains the test suite of the spec along with
 * the path under which the tests are to be found in that repository.
 *
 * The function will run git commands on the command-line and populate the local
 * ".cache" folder.
 */

const fs = require("fs");
const path = require("path");
const execSync = require("child_process").execSync;

// Cache folder under which the WPT repository will be cloned
const cacheFolder = path.resolve(__dirname, "..", ".cache");
const wptFolder = path.resolve(cacheFolder, "wpt");

/**
 * Helper function to setup the cache folder
 */
function setupCacheFolder() {
  try {
    fs.mkdirSync(cacheFolder);
  }
  catch (err) {
    if (err.code !== 'EEXIST') {
      throw err;
    }
  }
}

/**
 * Helper function that returns true when the WPT folder already exists
 * (which is taken to mean that the repository has already been cloned)
 */
function wptFolderExists() {
  try {
    fs.accessSync(wptFolder);
    return true;
  }
  catch (err) {
    if (err.code !== "ENOENT") {
      throw err;
    }
    return false;
  }
}

/**
 * Helper function that fetches the latest version of the WPT repository,
 * restricting the checkout to META.yml files
 */
function fetchWPT() {
  setupCacheFolder();
  if (wptFolderExists()) {
    // Pull latest commit from master branch
    execSync("git pull origin master", { cwd: wptFolder });
  }
  else {
    // Clone repo using sparse mode: the repo is huge and we're only interested
    // in META.yml files
    execSync("git clone https://github.com/web-platform-tests/wpt.git --depth 1 --sparse", { cwd: cacheFolder });
    execSync("git sparse-checkout set --no-cone", { cwd: wptFolder });
    execSync("git sparse-checkout add **/META.yml", { cwd: wptFolder });
  }
}

/**
 * Helper function that reads "spec" entries in all META.yml files of the WPT
 * repository.
 *
 * Note the function parses META.yml files as regular text files. That works
 * well but a proper YAML parser would be needed if we need to handle things
 * such as comments.
 */
async function readWptMetaFiles() {
  async function readFolder(folder) {
    let res = [];
    const contents = await fs.promises.readdir(folder);
    for (const name of contents) {
      const filename = path.resolve(folder, name);
      const stat = await fs.promises.stat(filename);
      if (stat.isDirectory()) {
        const nestedFiles = await readFolder(filename);
        res = res.concat(nestedFiles);
      }
      else if (name === "META.yml") {
        const file = await fs.promises.readFile(filename, "utf8");
        const match = file.match(/(?:^|\n)spec: (.*)$/m);
        if (match) {
          res.push({
            folder: folder.substring(wptFolder.length + 1).replace(/\\/g, "/"),
            spec: match[1]
          });
        }
      }
    }
    return res;
  }

  fetchWPT();
  return await readFolder(wptFolder);
}


/**
 * Returns the first item in the list found in the array, or null if none of
 * the items exists in the array.
 */
function getFirstFoundInArray(paths, ...items) {
  for (const item of items) {
    const path = paths.find(p => p === item);
    if (path) {
      return path;
    }
  }
  return null;
}


/**
 * Exports main function that takes a list of specs as input, completes entries
 * with a tests property when possible and returns the list.
 *
 * The options parameter is used to specify the GitHub API authentication token.
 */
module.exports = async function (specs, options) {
  if (!specs || specs.find(spec => !spec.shortname || !spec.series || !spec.series.shortname)) {
    throw "Invalid list of specifications passed as parameter";
  }
  options = options || {};

  const wptFolders = await readWptMetaFiles();

  function determineTestInfo(spec) {
    const info = {
      repository: "https://github.com/web-platform-tests/wpt"
    };

    if (spec.tests) {
      return Object.assign(info, spec.tests);
    }

    if (spec.url.startsWith("https://registry.khronos.org/")) {
      info.repository = "https://github.com/KhronosGroup/WebGL";
      info.testPaths = ["conformance-suites"];
      // TODO: Be more specific, tests for extensions should one of the files in:
      // https://github.com/KhronosGroup/WebGL/tree/master/conformance-suites/2.0.0/conformance2/extensions
      // https://github.com/KhronosGroup/WebGL/tree/master/conformance-suites/2.0.0/conformance/extensions
      // https://github.com/KhronosGroup/WebGL/tree/master/conformance-suites/1.0.3/conformance/extensions
      return info;
    }

    if (spec.url.startsWith("https://tc39.es/proposal-")) {
      // TODO: proposals may or may not have tests under tc39/test262, it would
      // be good to have that info here. However, that seems hard to assess
      // automatically and tedious to handle as exceptions in specs.json.
      return null;
    }

    // Note the use of startsWith below, needed to cover cases where a META.yml
    // file targets a specific page in a multipage spec (for HTML, typically),
    // or a fragment within a spec.
    const folders = wptFolders
      .filter(item =>
        item.spec.startsWith(spec.nightly.url) ||
        item.spec.startsWith(spec.nightly.url.replace(/-\d+\/$/, "/")))
      .map(item => item.folder);
    if (folders.length > 0) {
      // Don't list subfolders when parent folder is already in the list
      info.testPaths = folders.filter(p1 => !folders.find(p2 => (p1 !== p2) && p1.startsWith(p2)));

      // Exclude subfolders of listed folders when they map to another spec
      const excludePaths = folders
        .map(path => wptFolders.filter(item =>
          (item.folder !== path) &&
          item.folder.startsWith(path + "/") &&
          !item.spec.startsWith(spec.nightly.url) &&
          !item.spec.startsWith(spec.nightly.url.replace(/-\d+\/$/, "/"))))
        .flat()
        .map(item => item.folder);
      if (excludePaths.length > 0) {
        info.excludePaths = excludePaths;
      }

      return info;
    }
    return null;
  }

  const testInfos = specs.map(determineTestInfo);
  for (const spec of specs) {
    const testInfo = testInfos.shift();
    if (testInfo) {
      spec.tests = testInfo;
    }
  }

  return specs;
};
