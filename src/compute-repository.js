/**
 * Module that exports a function that takes the URL of a specification as input
 * and computes the URL of the repository that contains the source code for this
 * specification.
 *
 * The function returns null when it cannot compute the URL of a repository from
 * the given URL.
 */

/**
 * Exports main function that takes a URL (or a spec name) and returns the URL
 * of the repository that contains it.
 */
module.exports = function (url) {
  if (!url) {
    throw "No URL passed as parameter";
  }

  const githubio = url.match(/^https:\/\/([^\.]*)\.github\.io\/([^\/]*)\/?/);
  if (githubio) {
    return `https://github.com/${githubio[1]}/${githubio[2]}`;
  }

  const whatwg = url.match(/^https:\/\/([^\.]*).spec.whatwg.org\//);
  if (whatwg) {
    return `https://github.com/whatwg/${whatwg[1]}`;
  }

  const csswg = url.match(/^https?:\/\/drafts.csswg.org\/([^\/]*)\/?/);
  if (csswg) {
    return "https://github.com/w3c/csswg-drafts";
  }

  const ghfxtf = url.match(/^https:\/\/drafts.fxtf.org\/([^\/]*)\/?/);
  if (ghfxtf) {
    return "https://github.com/w3c/fxtf-drafts";
  }

  const houdini = url.match(/^https:\/\/drafts.css-houdini.org\/([^\/]*)\/?/);
  if (houdini) {
    return "https://github.com/w3c/css-houdini-drafts";
  }

  const svgwg = url.match(/^https:\/\/svgwg.org\/specs\/([^\/]*)\/?/);
  if (svgwg) {
    return "https://github.com/w3c/svgwg";
  }
  if (url === "https://svgwg.org/svg2-draft/") {
    return "https://github.com/w3c/svgwg";
  }

  const webgl = url.match(/^https:\/\/www\.khronos\.org\/registry\/webgl\//);
  if (webgl) {
    return "https://github.com/KhronosGroup/WebGL";
  }

  return null;
}