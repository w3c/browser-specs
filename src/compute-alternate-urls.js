/**
 * Module that exports a function that takes a spec object as input that already
 * has most of its info filled out and returns an object with "alternativeUrls"
 * based on well-known patterns for certain publishers.
 */
import computeShortname from "./compute-shortname.js";

export default function (spec) {
  if (!spec?.url || !spec?.nightly) {
    throw "Invalid spec object passed as parameter";
  }
  const alternate = new Set(spec.nightly.alternateUrls);

  // Document well-known patterns also used in other specs
  // datatracker and (now deprecated) tools.ietf.org
  if (spec.organization === "IETF" && spec.url.startsWith("https://www.rfc-editor.org/rfc/")) {
    alternate.add(spec.url.replace("https://www.rfc-editor.org/rfc/", "https://datatracker.ietf.org/doc/html/"));
    alternate.add(spec.url.replace("https://www.rfc-editor.org/rfc/", "https://tools.ietf.org/html/"));
  }

  // Add alternate w3c.github.io URLs for CSS specs
  // (Note drafts of CSS Houdini and Visual effects task forces don't have a
  // w3c.github.io version)
  // (Also note the CSS WG uses the "css" series shortname for CSS snapshots
  // and not for the CSS 2.x series)
  if (spec?.nightly?.url.match(/\/drafts\.csswg\.org/)) {
    const draft = computeShortname(spec.nightly.url);
    alternate.add(`https://w3c.github.io/csswg-drafts/${draft.shortname}/`);
    if ((spec.series.currentSpecification === spec.shortname) &&
        (draft.shortname !== draft.series.shortname) &&
        (draft.series.shortname !== 'css')) {
      alternate.add(`https://w3c.github.io/csswg-drafts/${draft.series.shortname}/`);
    }
  }
  spec.nightly.alternateUrls = Array.from(alternate);
};
