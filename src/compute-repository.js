/**
 * Module that exports a function that takes a list of specifications as input
 * and computes, for each of them, the URL of the repository that contains the
 * source code for this, as well as the source file of the specification at the
 * HEAD of default branch in the repository.
 *
 * The function needs an authentication token for the GitHub API.
 */

const Octokit = require("./octokit");
const parseSpecUrl = require("./parse-spec-url.js");


/**
 * Returns the first item in the list found in the Git tree, or null if none of
 * the items exists in the array.
 */
function getFirstFoundInTree(paths, ...items) {
  for (const item of items) {
    const path = paths.find(p => p.path === item);
    if (path) {
      return path;
    }
  }
  return null;
}


/**
 * Exports main function that takes a list of specs (with a nighly.url property)
 * as input, completes entries with a nightly.repository property when possible
 * and returns the list.
 *
 * The options parameter is used to specify the GitHub API authentication token.
 * In the absence of it, the function does not go through the GitHub API and
 * thus cannot set most of the information. This is useful to run tests without
 * an authentication token (but obviously means that the owner name returned
 * by the function will remain the lowercased version, and that the returned
 * info won't include the source file).
 */
module.exports = async function (specs, options) {
  if (!specs || specs.find(spec => !spec.nightly || !spec.nightly.url)) {
    throw "Invalid list of specifications passed as parameter";
  }
  options = options || {};

  const octokit = new Octokit({ auth: options.githubToken });
  const repoCache = new Map();
  const repoPathCache = new Map();
  const userCache = new Map();

  /**
   * Take a GitHub repo owner name (lowercase version) and retrieve the real
   * owner name (with possible uppercase characters) from the GitHub API.
   */
  async function fetchRealGitHubOwnerName(username) {
    if (!userCache.has(username)) {
      const { data } = await octokit.users.getByUsername({ username });
      if (data.message) {
        // Alert when user does not exist
        throw res.message;
      }
      userCache.set(username, data.login);
    }
    return userCache.get(username);
  }

  /**
   * Determine the name of the file that contains the source of the spec in the
   * default branch of the GitHub repository associated with the specification.
   */
  async function determineSourcePath(spec, repo) {
    // Retrieve all paths of the GitHub repository
    const cacheKey = `${repo.owner}/${repo.name}`;
    if (!repoPathCache.has(cacheKey)) {
      const { data } = await octokit.git.getTree({
        owner: repo.owner,
        repo: repo.name,
        tree_sha: "HEAD",
        recursive: true
      });
      const paths = data.tree;
      repoPathCache.set(cacheKey, paths);
    }
    const paths = repoPathCache.get(cacheKey);

    // Extract filename from nightly URL when there is one
    const match = spec.nightly.url.match(/\/([\w\-]+)\.html$/);
    const nightlyFilename = match ? match[1] : "";

    const sourcePath = getFirstFoundInTree(paths,
      // Common paths for CSS specs
      `${spec.shortname}.bs`,
      `${spec.shortname}/Overview.bs`,
      `${spec.shortname}/Overview.src.html`,
      `${spec.series.shortname}/Overview.bs`,
      `${spec.series.shortname}/Overview.src.html`,

      // Named after the nightly filename
      `${nightlyFilename}.bs`,
      `${nightlyFilename}.html`,
      `${nightlyFilename}.src.html`,
      `${nightlyFilename}.md`,

      // WebGL extensions
      `extensions/${spec.shortname}/extension.xml`,

      // WebAssembly specs
      `document/${spec.series.shortname.replace(/^wasm-/, '')}/index.bs`,

      // SVG specs
      `specs/${spec.shortname.replace(/^svg-/, '')}/master/Overview.html`,
      `master/Overview.html`,

      // HTTPWG specs
      `specs/${spec.shortname}.xml`,

      // Following patterns are used in a small number of cases, but could
      // perhaps appear again in the future, so worth handling here.
      "spec/index.bs",
      "spec/index.html",    // Only one TC39 spec
      "spec/Overview.html", // Only WebCrypto
      "docs/index.bs",      // Only ServiceWorker
      "spec.html",          // Most TC39 specs
      "spec.emu",           // Some TC39 specs
      `${spec.shortname}/Overview.html`,  // css-color-3, mediaqueries-3

      // Most common patterns, checking on "index.html" last as some repos
      // include such a file to store the generated spec from the source.
      "index.src.html",
      "index.bs",
      "spec.bs",
      "index.md",
      "index.html"
    );

    if (!sourcePath) {
      return null;
    }

    // Fetch target file for symlinks
    if (sourcePath.mode === "120000") {
      const { data } = await octokit.git.getBlob({
        owner: repo.owner,
        repo: repo.name,
        file_sha: sourcePath.sha
      });
      return Buffer.from(data.content, "base64").toString("utf8");
    }
    return sourcePath.path;
  }

  async function isRealRepo(repo) {
    if (!options.githubToken) {
      // Assume the repo exists if we can't check
      return true;
    }
    const cacheKey = `${repo.owner}/${repo.name}`;
    if (!repoCache.has(cacheKey)) {
      try {
        await octokit.repos.get({
          owner: repo.owner,
          repo: repo.name
        });
        repoCache.set(cacheKey, true);
      }
      catch (err) {
        if (err.status === 404) {
          repoCache.set(cacheKey, false);
        }
        else {
          throw err;
        }
      }
    }
    return repoCache.get(cacheKey);
  }

  // Compute GitHub repositories with lowercase owner names
  const repos = specs.map(spec => parseSpecUrl(spec.nightly.repository ?? spec.nightly.url));

  if (options.githubToken) {
    // Fetch the real name of repository owners (preserving case)
    for (const repo of repos) {
      if (repo) {
        repo.owner = await fetchRealGitHubOwnerName(repo.owner);
      }
    }
  }

  // Compute final repo URL and add source file if possible
  for (const spec of specs) {
    const repo = repos.shift();
    if (repo && await isRealRepo(repo)) {
      spec.nightly.repository = `https://github.com/${repo.owner}/${repo.name}`;

      if (options.githubToken && !spec.nightly.sourcePath) {
        const sourcePath = await determineSourcePath(spec, repo);
        if (sourcePath) {
          spec.nightly.sourcePath = sourcePath;
        }
      }
    }
    else if (spec.nightly.url.match(/\/httpwg\.org\//)) {
      const draftName = spec.nightly.url.match(/\/(draft-ietf-(.+))\.html$/);
      spec.nightly.repository = 'https://github.com/httpwg/http-extensions';
      spec.nightly.sourcePath = `${draftName[1]}.md`;
    }
  }

  return specs;
};
