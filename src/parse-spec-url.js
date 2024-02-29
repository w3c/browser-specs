/**
 * Helper method that parses a spec URL and returns some information on the
 * type of URL (github, /TR, WHATWG, etc.), the owning organization on GitHub
 * and the likely GitHub repository name.
 * 
 * Note that the repository name may be incorrect for /TR specs (as spec
 * shortnames do not always match the name of the actual repo).
 */

module.exports = function (url) {
  if (!url) {
    throw "No URL passed as parameter";
  }

  const githubcom = url.match(/^https:\/\/github\.com\/([^\/]*)\/([^\/]*)\/?/);
  if (githubcom) {
    return { type: "github", owner: githubcom[1], name: githubcom[2] };
  }

  const githubio = url.match(/^https:\/\/([^\.]*)\.github\.io\/([^\/]*)\/?/);
  if (githubio) {
    return { type: "github", owner: githubio[1], name: githubio[2] };
  }

  const whatwg = url.match(/^https:\/\/([^\.]*).spec.whatwg.org\//);
  if (whatwg) {
    return { type: "custom", owner: "whatwg", name: whatwg[1] };
  }

  const tc39 = url.match(/^https:\/\/tc39.es\/([^\/]*)\//);
  if (tc39) {
    return { type: "custom", owner: "tc39", name: tc39[1] };
  }

  const csswg = url.match(/^https?:\/\/drafts.csswg.org\/([^\/]*)\/?/);
  if (csswg) {
    return { type: "custom", owner: "w3c", name: "csswg-drafts" };
  }

  const ghfxtf = url.match(/^https:\/\/drafts.fxtf.org\/([^\/]*)\/?/);
  if (ghfxtf) {
    return { type: "custom", owner: "w3c", name: "fxtf-drafts" };
  }

  const houdini = url.match(/^https:\/\/drafts.css-houdini.org\/([^\/]*)\/?/);
  if (houdini) {
    return { type: "custom", owner: "w3c", name: "css-houdini-drafts" };
  }

  const svgwg = url.match(/^https:\/\/svgwg.org\/specs\/([^\/]*)\/?/);
  if (svgwg) {
    return { type: "custom", owner: "w3c", name: "svgwg" };
  }
  if (url === "https://svgwg.org/svg2-draft/") {
    return { type: "custom", owner: "w3c", name: "svgwg" };
  }

  const webgl = url.match(/^https:\/\/registry\.khronos\.org\/webgl\//);
  if (webgl) {
    return { type: "custom", owner: "khronosgroup", name: "WebGL" };
  }

  const khronos = url.match(/^https:\/\/registry\.khronos\.org\/([^\/]+)\//);
  if (khronos) {
    return { type: "custom", owner: "khronosgroup", name: khronos[1] };
  }

  const httpwg = url.match(/^https:\/\/httpwg\.org\/specs\/rfc[0-9]+\.html$/);
  if (httpwg) {
    return { type: "custom", owner: "httpwg", name: "httpwg.github.io" };
  }

  const w3cTr = url.match(/^https?:\/\/(?:www\.)?w3\.org\/TR\/([^\/]+)\/$/);
  if (w3cTr) {
    return { type: "tr", owner: "w3c", name: w3cTr[1] };
  }

  const tag = url.match(/^https?:\/\/(?:www\.)?w3\.org\/2001\/tag\/doc\/([^\/]+)\/?$/);
  if (tag) {
    return { type: "custom", owner: "w3ctag", name: tag[1] };
  }

  return null;
}
