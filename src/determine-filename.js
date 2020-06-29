/**
 * Module that takes the URL of the index page of a spec as input, possibly
 * without a filename, and that tries to determine the underlying filename.
 *
 * For instance:
 * - given "https://w3c.github.io/webrtc-identity/identity.html", the function
 * would return "identity.html"
 * - given "https://compat.spec.whatwg.org/", the function would determine that
 * the filename is "index.html".
 */

const fetch = require("node-fetch");

module.exports = async function (url) {
  // Extract filename directly from the URL when possible
  const match = url.match(/\/([^/]+\.html)$/);
  if (match) {
    return match[1];
  }

  // Make sure that url ends with a "/"
  const urlWithSlash = url.endsWith("/") ? url : url + "/";

  // Check common candidates
  const candidates = [
    "Overview.html",
    "index.html",
    "cover.html"
  ];

  for (const candidate of candidates) {
    const res = await fetch(urlWithSlash + candidate, { method: "HEAD" });
    if (res.status === 200) {
      return candidate;
    }
  }

  // Not found? Look at Content-Location header
  const res = await fetch(url, { method: "HEAD" });
  const filename = res.headers.get("Content-Location");
  return filename;
}