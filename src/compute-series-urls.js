/**
 * Module that exports a function that takes a spec object as input that already
 * has most of its info filled out ("series", but also "release" and "nightly"
 * properties filled out) and that returns an object with a "releaseUrl" and
 * "nightlyUrl" property when possible that target the unversioned versions, of
 * the spec, in other words the series itself.
 *
 * The function also takes the list of spec objects as second parameter. When
 * computing the release URL, it will iterate through the specs in the same
 * series to find one that has a release URL.
 */

function computeSeriesUrls(spec) {
  if (!spec?.shortname || !spec.series?.shortname) {
    throw "Invalid spec object passed as parameter";
  }

  const res = {};

  // If spec shortname and series shortname match, then series URLs match the
  // spec URLs.
  if (spec.shortname === spec.series.shortname) {
    if (spec.release?.url) {
      res.releaseUrl = spec.release.url;
    }
    if (spec.nightly?.url) {
      res.nightlyUrl = spec.nightly.url;
    }
  }

  // When shortnames do not match, replace the spec shortname by the series
  // shortname in the URL
  else {
    if (spec.release?.url) {
      res.releaseUrl = spec.release.url.replace(
        new RegExp(`/${spec.shortname}/`),
        `/${spec.series.shortname}/`);
    }
    if (spec.nightly?.url) {
      res.nightlyUrl = spec.nightly.url.replace(
        new RegExp(`/${spec.shortname}/`),
        `/${spec.series.shortname}/`);
    }
  }

  return res;
}

/**
 * Exports main function that takes a spec object and returns an object with
 * properties "releaseUrl" and "nightlyUrl". Function only sets the properties
 * when needed, so returned object may be empty.
 *
 * Function also takes the list of spec objects as input. It iterates through
 * the list to look for previous versions of a spec to find a suitable release
 * URL when the latest version does not have one.
 */
module.exports = function (spec, list) {
  list = list || [];

  // Compute series info for current version of the spec if it is in the list
  const currentSpec = list.find(s => s.shortname === spec.series?.currentSpecification);
  const res = computeSeriesUrls(currentSpec ?? spec);

  // Look for a release URL in given spec and previous versions
  if (!res.releaseUrl) {
    while (spec) {
      const prev = computeSeriesUrls(spec);
      if (prev.releaseUrl) {
        res.releaseUrl = prev.releaseUrl;
        break;
      }
      spec = list.find(s => s.shortname === spec.seriesPrevious);
      if (!spec) {
        break;
      }
    }
  }
  return res;
}