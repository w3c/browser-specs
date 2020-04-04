/**
 * Module that exports a function that takes a URL as input and computes a
 * meaningful shortname (i.e. the name with version), series' shortname and
 * version for it (when appropriate).
 *
 * The function returns an object with a "shortname" property. The name matches
 * the /TR/ name for specs published there. It includes the spec level. For
 * instance: "css-color-4" for "https://www.w3.org/TR/css-color-4/".
 *
 * For non-TR specs, the name returned is the "most logical" name that can be
 * extracted from the URL. The function typically handles a few typical cases
 * (such as "https://xxx.github.io/" URLs). It throws an exception when no
 * meaningful name can be extracted.
 *
 * Returned object will also alway have a "series" object that contains
 * an unleveled name for the specification. That shortname is shared across
 * levels of the specification. In most cases, it is the name without its level
 * suffix. For instance: "css-page" for "https://www.w3.org/TR/css-page-4/".
 * In rare cases, note the shortname may be different. For instance:
 * "css-conditional" for "https://www.w3.org/TR/css3-conditional/".
 *
 * If the URL contains a level indication, the returned object will have a
 * "seriesVersion" property with that level/version, represented as a string
 * which is either "x", "x.y" or "x.y.z", with x, y, z integers. If the spec
 * has no level, the "level" property is not set.
 *
 * Note that the function is NOT intended for use as a generic function that
 * returns a shortname, series' shortname and level for ANY URL. It is only
 * intended for use within the "browser-specs" project to automatically create
 * shortnames for common-looking URLs. In particular, individual exceptions to
 * the rule should NOT be hardcoded here but should rather be directly specified
 * in the "specs.json" file. For instance, it does not make sense to extend the
 * function to hardcode the fact that the "css3-mediaqueries" name should
 * create a "mediaqueries" series' shortname.
 */


/**
 * Internal function that takes a URL as input and returns a name for it
 * if the URL matches well-known patterns, or if the given parameter is actually
 * already a name (meaning that it does not contains any "/").
 *
 * The function throws if it cannot compute a meaningful name from the URL.
 */
function computeShortname(url) {
  function parseUrl(url) {
    // Handle /TR/ URLs
    const w3cTr = url.match(/^https?:\/\/(?:www\.)?w3\.org\/TR\/([^\/]+)\/$/);
    if (w3cTr) {
      return w3cTr[1];
    }

    // Handle WHATWG specs
    const whatwg = url.match(/\/\/(.+)\.spec\.whatwg\.org\//);
    if (whatwg) {
        return whatwg[1];
    }

    // Handle extension specs defined in the same repo as the main spec
    // (e.g. generate a "gamepad-extensions" name for
    // https://w3c.github.io/gamepad/extensions.html")
    const ext = url.match(/\/.*\.github\.io\/([^\/]+)\/(extensions?)\.html$/);
    if (ext) {
      return ext[1] + '-' + ext[2];
    }

    // Handle draft specs on GitHub, excluding the "webappsec-" prefix for
    // specifications developed by the Web Application Security Working Group
    const github = url.match(/\/.*\.github\.io\/(?:webappsec-)?([^\/]+)\//);
    if (github) {
        return github[1];
    }

    // Handle CSS WG specs
    const css = url.match(/\/drafts\.(?:csswg|fxtf|css-houdini)\.org\/([^\/]+)\//);
    if (css) {
      return css[1];
    }

    // Handle SVG drafts
    const svg = url.match(/\/svgwg\.org\/specs\/(?:svg-)?([^\/]+)\//);
    if (svg) {
      return "svg-" + svg[1];
    }

    // Return name when one was given
    if (!url.match(/\//)) {
      return url;
    }

    throw `Cannot extract meaningful name from ${url}`;
  }

  // Parse the URL to extract the name
  const name = parseUrl(url);

  // Make sure name looks legit, in other words that it is composed of basic
  // Latin characters (a-z letters, digits, underscore and "-"), and that it
  // only contains a dot for fractional levels at the end of the name
  // (e.g. "blah-1.2" is good but "blah.blah" and "blah-3.1-blah" are not)
  if (!name.match(/^[\w\-]+((?<=\-\d+)\.\d+)?$/)) {
    throw `Specification name contains unexpected characters: ${name} (extracted from ${url})`;
  }

  return name;
}


/**
 * Compute the shortname and level from the spec name, if possible.
 */
function completeWithSeriesAndLevel(shortname) {
  // Use latest convention for CSS specs
  function modernizeShortname(name) {
    if (name.startsWith("css3-")) {
      return "css-" + name.substring("css3-".length);
    }
    else if (name.startsWith("css4-")) {
      return "css-" + name.substring("css4-".length);
    }
    else {
      return name;
    }
  }

  // Extract X and X.Y levels, with form "name-X" or "name-X.Y".
  // (e.g. 5 for "mediaqueries-5", 1.2 for "wai-aria-1.2")
  let match = shortname.match(/^(.*?)-(\d+)(.\d+)?$/);
  if (match) {
    return {
      shortname,
      series: { shortname: modernizeShortname(match[1]) },
      seriesVersion: match[3] ? match[2] + match[3] : match[2]
    };
  }

  // Extract X and X.Y levels with form "nameX" or "nameXY" (but not "nameXXY")
  // (e.g. 2.1 for "CSS21", 1.1 for "SVG11", 4 for "selectors4")
  match = shortname.match(/^(.*?)(?<!\d)(\d)(\d?)$/);
  if (match) {
    return {
      shortname,
      series: { shortname: modernizeShortname(match[1]) },
      seriesVersion: match[3] ? match[2] + "." + match[3] : match[2]
    };
  }

  // No level found
  return {
    shortname,
    series: { shortname: modernizeShortname(shortname) }
  };
}


/**
 * Exports main function that takes a URL (or a spec name) and returns an
 * object with a name, a shortname and a level (if needed).
 */
module.exports = function (url) {
  if (!url) {
    throw "No URL passed as parameter";
  }
  return completeWithSeriesAndLevel(computeShortname(url));
}