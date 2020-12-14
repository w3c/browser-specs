/**
 * Module that exports a function that takes a list of specifications as input
 * and computes, for each of them, the URL of the repository that contains the
 * source code for this, as well as the source file of the specification at the
 * HEAD of default branch in the repository.
 *
 * The function needs an authentication token for the GitHub API.
 */

const { Octokit } = require("@octokit/rest");


/**
 * Function that takes a URL (or a spec name) and returns the underlying repo
 * owner organization (lowercase) and repo name on GitHub.
 */
function urlToGitHubRepository(url) {
  if (!url) {
    throw "No URL passed as parameter";
  }

  const githubio = url.match(/^https:\/\/([^\.]*)\.github\.io\/([^\/]*)\/?/);
  if (githubio) {
    return { owner: githubio[1], name: githubio[2] };
  }

  const whatwg = url.match(/^https:\/\/([^\.]*).spec.whatwg.org\//);
  if (whatwg) {
    return { owner: "whatwg", name: whatwg[1] };
  }

  const tc39 = url.match(/^https:\/\/tc39.es\/([^\/]*)\//);
  if (tc39) {
    return { owner: "tc39", name: tc39[1] };
  }

  const csswg = url.match(/^https?:\/\/drafts.csswg.org\/([^\/]*)\/?/);
  if (csswg) {
    return { owner: "w3c", name: "csswg-drafts" };
  }

  const ghfxtf = url.match(/^https:\/\/drafts.fxtf.org\/([^\/]*)\/?/);
  if (ghfxtf) {
    return { owner: "w3c", name: "fxtf-drafts" };
  }

  const houdini = url.match(/^https:\/\/drafts.css-houdini.org\/([^\/]*)\/?/);
  if (houdini) {
    return { owner: "w3c", name: "css-houdini-drafts" };
  }

  const svgwg = url.match(/^https:\/\/svgwg.org\/specs\/([^\/]*)\/?/);
  if (svgwg) {
    return { owner: "w3c", name: "svgwg" };
  }
  if (url === "https://svgwg.org/svg2-draft/") {
    return { owner: "w3c", name: "svgwg" };
  }

  const webgl = url.match(/^https:\/\/www\.khronos\.org\/registry\/webgl\//);
  if (webgl) {
    return { owner: "khronosgroup", name: "WebGL" };
  }

  return null;
}


/**
 * Returns the first item in the list found in the array, or null if none of
 * the items exists in the array.
 */
function getFirstFoundInArray(array, ...items) {
  for (const item of items) {
    if (array.includes(item)) {
      return item;
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
      const paths = data.tree.map(entry => entry.path);
      repoPathCache.set(cacheKey, paths);
    }
    const paths = repoPathCache.get(cacheKey);

    // Extract filename from nightly URL when there is one
    const match = spec.nightly.url.match(/\/(\w+)\.html$/);
    const nightlyFilename = match ? match[1] : "";

    return getFirstFoundInArray(paths,
      // Common paths for CSS specs
      `${spec.shortname}.bs`,
      `${spec.shortname}/Overview.bs`,
      `${spec.shortname}/Overview.src.html`,
      `${spec.series.shortname}/Overview.bs`,
      `${spec.series.shortname}/Overview.src.html`,

      // Named after the nightly filename
      `${nightlyFilename}.bs`,
      `${nightlyFilename}.html`,

      // WebGL extensions
      `extensions/${spec.shortname}/extension.xml`,

      // WebAssembly specs
      `document/${spec.series.shortname.replace(/^wasm-/, '')}/index.bs`,

      // SVG specs
      `specs/${spec.shortname.replace(/^svg-/, '')}/master/Overview.html`,
      `master/Overview.html`,

      // Following patterns are used in a small number of cases, but could
      // perhaps appear again in the future, so worth handling here.
      "spec/index.bs",
      "spec/index.html",    // Only one TC39 spec
      "spec/Overview.html", // Only WebCrypto
      "docs/index.bs",      // Only ServiceWorker
      "spec.html",          // Most TC39 specs

      // Most common patterns, checking on "index.html" last as some repos
      // include such a file to store the generated spec from the source.
      "index.src.html",
      "index.bs",
      "spec.bs",
      "index.html"
    );
  }

  // Compute GitHub repositories with lowercase owner names
  const repos = specs.map(spec => urlToGitHubRepository(spec.nightly.url));

  if (options.githubToken) {
    // Fetch the real name of repository owners (preserving case)
    for (const repo of repos) {
      repo.owner = await fetchRealGitHubOwnerName(repo.owner);
    }
  }

  // Compute final repo URL and add source file if possible
  for (const spec of specs) {
    const repo = repos.shift();
    if (repo) {
      spec.nightly.repository = `https://github.com/${repo.owner}/${repo.name}`;

      if (options.githubToken && !spec.nightly.sourcePath) {
        const sourcePath = await determineSourcePath(spec, repo);
        if (sourcePath) {
          spec.nightly.sourcePath = sourcePath;
        }
      }
    }
  }

  return specs;
};
