/**
 * Module that exports a function that takes the URL of a specification as input
 * and computes the URL of the repository that contains the source code for this
 * specification.
 *
 * The function returns null when it cannot compute the URL of a repository from
 * the given URL.
 */

const fetch = require("node-fetch");


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
 * Function that takes a GitHub repo owner name (lowercase version) and that
 * retrieves the real owner name (with possible uppercase characters) from the
 * GitHub API.
 */
async function fetchRealGitHubOwnerName(owner) {
  return await fetch(`https://api.github.com/users/${owner}`)
    .then(resp => resp.json())
    .then(resp => {
      // Alert when user does not exist
      if (resp.message) {
        throw resp.message;
      }
      return resp.login;
    });
}


/**
 * Exports main function that takes a list of specs (with a nighly.url property)
 * as input, completes entries with a nightly.repository property when possible
 * and returns the list.
 *
 * The options parameter can be used to set a `localOnly` flag that tells the
 * function to bypass the "fake to real" repo owner name mapping, which requires
 * going through the GitHub API. This is useful to prevent tests from exceeding
 * GitHub API's rate limit (but obviously means that the owner name returned
 * by the function will remain the lowercased version).
 */
module.exports = async function (specs, options) {
  if (!specs || specs.find(spec => !spec.nightly || !spec.nightly.url)) {
    throw "Invalid list of specifications passed as parameter";
  }
  options = options || {};

  // Compute GitHub repositories with lowercase owner names
  const repos = specs.map(spec => urlToGitHubRepository(spec.nightly.url));

  // Extract the list of owners and fetch their real name (preserving case)
  if (!options.localOnly) {
    const owners = [...new Set(repos.map(repo => repo.owner))];
    const realOwners = await Promise.all(
      owners.map(owner => fetchRealGitHubOwnerName(owner)));
    const ownerMapping = {};
    owners.forEach((owner, idx) => ownerMapping[owner] = realOwners[idx]);

    // Use real owner names
    repos.forEach(repo => repo.owner = ownerMapping[repo.owner]);
  }

  // Compute final repo URL
  specs.forEach((spec, idx) => {
    const repo = repos[idx];
    if (repo) {
      spec.nightly.repository = `https://github.com/${repo.owner}/${repo.name}`;
    }
  });

  return specs;
};
