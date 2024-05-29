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

module.exports = async function (url) {
  // Extract filename directly from the URL when possible
  const match = url.match(/\/([^/]+\.(html|pdf|txt))$/);
  if (match) {
    return match[1];
  }

  // RFC-editor HTML rendering
  const rfcMatch = url.match(/\/rfc\/(rfc[0-9]+)$/);
  if (rfcMatch) {
    return rfcMatch[1] + '.html';
  }

  // W3C /TR specs should all have an "Overview.html" filename, let's not make
  // additional network requests to avoid running into rate limiting issues
  // (W3C servers can easily be made to return 429 Too Many Requests responses)
  // Note: exceptions to the rule need to be handled in "specs.json".
  const w3cTr = url.match(/^https?:\/\/(?:www\.)?w3\.org\/TR\/([^\/]+)\/$/);
  if (w3cTr) {
    return "Overview.html";
  }

  // Make sure that url ends with a "/"
  const urlWithSlash = url.endsWith("/") ? url : url + "/";

  // Check common candidates
  const candidates = [
    "index.html",
    "Overview.html"
  ];

  for (const candidate of candidates) {
    const res = await fetch(urlWithSlash + candidate, { method: "HEAD" });
    if (res.status >= 200 && res.status < 300) {
      return candidate;
    }
    else if (res.status !== 404) {
      console.warn(`[warning] fetching "${urlWithSlash + candidate}" returned unexpected HTTP status ${res.status}`);
    }
  }

  // Not found? Look at Content-Location header
  const res = await fetch(url, { method: "HEAD" });
  const filename = res.headers.get("Content-Location");
  return filename;
}
