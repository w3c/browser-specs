/**
 * Bump the minor version of packages when the list of specs has changed.
 *
 * node src/bump-packages-minor.js
 *
 * This script is intended to be run at the end of a build before committing
 * the result back to the main branch to automatically bump the minor version
 * in the `package.json` files under the `packages` folders when the new index
 * files contains new/deleted specs to commit.
 *
 * The script does not bump a version that matches x.y.0 because such a version
 * means a minor bump is already pending release.
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

function specsMatch(s1, s2) {
  return s1.url === s2.url && s1.shortname === s2.shortname;
}

function isMinorBumpNeeded(type) {
  // Retrieve contents of last committed index file
  const res = execSync(
    `git show ${type}@latest:index.json`,
    { encoding: 'utf8' }).trim();
  let lastIndexFile = JSON.parse(res);

  // Load new file
  let newIndexFile = require('../index.json');

  // Filter specs if needed
  if (type === "browser-specs") {
    lastIndexFile = lastIndexFile.filter(s => !s.categories || s.categories.includes('browser'));
    newIndexFile = newIndexFile.filter(s => s.categories.includes('browser'));
  }

  return !!(
    lastIndexFile.find(spec => !newIndexFile.find(s => specsMatch(spec, s))) ||
    newIndexFile.find(spec => !lastIndexFile.find(s => specsMatch(spec, s)))
  );
}


async function checkPackage(type) {
  console.log(`Check ${type} package`);
  const packageFile = path.join('..', 'packages', type, 'package.json');
  const package = require(packageFile);
  const version = package.version;
  console.log(`- Current version: ${version}`);

  // Loosely adapted from semver:
  // https://github.com/npm/node-semver/blob/cb1ca1d5480a6c07c12ac31ba5f2071ed530c4ed/internal/re.js#L37
  // (not using semver directly to avoid having to install dependencies in job)
  const reVersion = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
  const versionTokens = version.match(reVersion);
  const major = parseInt(versionTokens[1], 10);
  const minor = parseInt(versionTokens[2], 10);
  const patch = parseInt(versionTokens[3], 10);

  if (patch === 0) {
    console.log('- No bump needed, minor bump already pending');
    return;
  }

  if (isMinorBumpNeeded(type)) {
    console.log('- new/deleted spec(s) found');
    const newVersion = `${major}.${minor+1}.0`;
    package.version = newVersion;
    fs.writeFile(path.resolve(__dirname, packageFile), JSON.stringify(package, null, 2), 'utf8');
    console.log(`- Version bumped to ${newVersion}`);
  }
  else {
    console.log('- No bump needed');
  }
}


async function checkPackages() {
  const packagesFolder = path.resolve(__dirname, '..', 'packages');
  const types = await fs.readdir(packagesFolder);
  for (const type of types) {
    const stat = await fs.lstat(path.join(packagesFolder, type));
    if (stat.isDirectory()) {
      await checkPackage(type);
    }
  }
}


/*******************************************************************************
Main loop
*******************************************************************************/
checkPackages()
  .then(() => {
    console.log();
    console.log("== The end ==");
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });