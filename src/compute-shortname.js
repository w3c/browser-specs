/**
 * Module that exports a function that takes a URL as input and computes a
 * meaninful shortname, family name and level for it, when appropriate.
 *
 * The function returns an object with a "shortname" property. The shortname
 * matches the /TR/ shortname for specs published there. It includes the spec
 * level. For instance: "css-color-4" for "https://www.w3.org/TR/css-color-4/".
 *
 * For non-TR specs, the shortname returned is the "most logical" name that can
 * be extracted from the URL. The function typically handles a few typical cases
 * (such as "https://xxx.github.io/" URLs). It throws an exception when no
 * meaningful shortname can be extracted.
 *
 * Returned object will also alway have a "familyname" property that contains
 * an unleveled shortname for the specification. That name is shared across
 * levels of the specification. In most cases, it is the shortname without the
 * level. For instance: "css-page" for "https://www.w3.org/TR/css-page-4/".
 * In rare cases, note the familyname may be different. For instance:
 * "css-conditional" for "https://www.w3.org/TR/css3-conditional/".
 *
 * If the URL contains a level indication, the returned object will have a
 * "level" property with that level. Level can either be an integer (1, 2, 3)
 * or a float (1.2, 2.1). In some cases, the integer actually represents a year
 * (2013, 2018). If the spec has no level, the "level" property is not set.
 *
 * Note that the function is NOT intended for use as a generic function that
 * returns a shortname, familyname and level for ANY URL. It is only intended
 * for use within the "browser-specs" project to automatically create shortnames
 * for common-looking URLs. In particular, individual exceptions to the rule
 * should NOT be hardcoded here but should rather be directly specified in the
 * "specs.json" file. For instance, it does not make sense to extend the
 * function to hardcode the fact that the "css3-mediaqueries" shortname should
 * create a "mediaqueries" family name.
 */


/**
 * Internal function that takes a URL as input and returns a shortname for it
 * if the URL matches well-known patterns, or if the given parameter is actually
 * already a shortname (meaning that it does not contains any "/").
 *
 * The function throws if it cannot compute a meaningful shortname from the URL.
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
    const ext = url.match(/\/.*\.github\.io\/([^\/]+)\/(extensions?)\.html$/);
    if (ext) {
      return ext[1] + '-' + ext[2];
    }

    // Handle draft specs on GitHub
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
      return "svg-" + svgSpec[1];
    }

    // Return shortname when one was given
    if (!url.match(/\//)) {
      return url;
    }

    throw `Cannot extract meaningful shortname from ${url}`;
  }

  // Parse the URL to extract the shortname
  const shortname = parseUrl(url);

  // Make sure shortname looks legit
  if (!shortname.match(/^[\w\-]+((?<=\-\d+)\.\d+)?$/)) {
    throw `Shortname contains unexpected characters: ${shortname} (extracted from ${url})`;
  }

  return shortname;
}


/**
 * Compute the family name and level from the shortname, if possible.
 */
function completeWithFamilynameAndLevel(shortname) {
  // Use latest convention for CSS specs
  function modernizeFamilyname(familyname) {
    if (familyname.startsWith("css3-")) {
      return "css-" + familyname.substring("css3-".length);
    }
    else if (familyname.startsWith("css4-")) {
      return "css-" + familyname.substring("css4-".length);
    }
    else {
      return familyname;
    }
  }

  // Extract X and X.Y levels, with form "name-X" or "name-X.Y".
  // (e.g. 5 for "mediaqueries-5", 1.2 for "wai-aria-1.2")
  let match = shortname.match(/^(.*?)-(\d+)(.\d+)?$/);
  if (match) {
    return {
      shortname,
      familyname: modernizeFamilyname(match[1]),
      level: match[3] ? parseFloat(match[2] + match[3]) : parseInt(match[2], 10)
    };
  }

  // Extract X and X.Y levels with form "nameX" or "nameXY" (but not "nameXXY")
  // (e.g. 2.1 for "CSS21", 1.1 for "SVG11", 4 for "selectors4")
  match = shortname.match(/^(.*?)(?<!\d)(\d)(\d?)$/);
  if (match) {
    return {
      shortname,
      familyname: modernizeFamilyname(match[1]),
      level: match[3] ? parseFloat(match[2] + "." + match[3]) : parseInt(match[2], 10)
    };
  }

  // No level found
  return {
    shortname,
    familyname: modernizeFamilyname(shortname)
  };
}


/**
 * Exports main function that takes a URL (or a shortname) and returns an
 * object with a shortname, a family name and a level, as needed.
 */
module.exports = function (url) {
  if (!url) {
    throw "No URL passed as parameter";
  }
  return completeWithFamilynameAndLevel(computeShortname(url));
}