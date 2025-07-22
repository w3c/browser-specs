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

import multiRepos from "./data/multispecs-repos.json" with { type: "json" };


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

    // Handle TC39 Proposals
    const tc39 = url.match(/\/\/tc39\.es\/proposal-([^\/]+)\/$/);
    if (tc39) {
        return "tc39-" + tc39[1];
    }


    // Handle Khronos extensions
    const khronos = url.match(/https:\/\/registry\.khronos\.org\/webgl\/extensions\/([^\/]+)\/$/);
    if (khronos) {
        return khronos[1];
    }

    // Handle extension specs defined in the same repo as the main spec
    // (e.g. generate a "gamepad-extensions" name for
    // https://w3c.github.io/gamepad/extensions.html")
    const ext = url.match(/\/.*\.github\.io\/([^\/]+)\/(extensions?)\.html$/);
    if (ext) {
      return ext[1] + '-' + ext[2];
    }

    // Handle specs in multi-specs repositories
    for (const repo of Object.values(multiRepos)) {
      const multiMatch = url.match(repo.shortname.pattern);
      if (multiMatch) {
        if (repo.shortname.prefix &&
            !multiMatch[1].startsWith(repo.shortname.prefix)) {
          return repo.shortname.prefix + multiMatch[1];
        }
        return multiMatch[1];
      }
    }

    // Handle draft specs on GitHub, excluding the "webappsec-" prefix for
    // specifications developed by the Web Application Security Working Group
    const github = url.match(/\/.*\.github\.io\/(?:webappsec-)?([^\/]+)\//);
    if (github) {
        return github[1];
    }

    // Handle IETF RFCs
    const rfcs = url.match(/\/www.rfc-editor\.org\/rfc\/(rfc[0-9]+)/);
    if (rfcs) {
      return rfcs[1];
    }

    // Handle IETF group drafts
    const ietfDraft = url.match(/\/datatracker\.ietf\.org\/doc\/html\/draft-ietf-[^\-]+-([^\/]+)/);
    if (ietfDraft) {
      return ietfDraft[1];
    }

    // Handle IETF individual drafts, stripping group name
    // TODO: retrieve the list of IETF groups to make sure that the group name
    // is an actual group name and not the beginning of the shortname:
    // https://datatracker.ietf.org/api/v1/group/group/
    // (multiple requests needed due to pagination, "?limit=1000" is the max)
    const ietfIndDraft = url.match(/\/datatracker\.ietf\.org\/doc\/html\/draft-[^\-]+-([^\/]+)/);
    if (ietfIndDraft) {
      if (ietfIndDraft[1].indexOf('-') !== -1) {
        return ietfIndDraft[1].slice(ietfIndDraft[1].indexOf('-') + 1);
      }
      else {
        return ietfIndDraft[1];
      }
    }

    // Handle TAG findings
    const tag = url.match(/^https?:\/\/(?:www\.)?w3\.org\/2001\/tag\/doc\/([^\/]+)\/?$/);
    if (tag) {
      return tag[1];
    }

    // Handle ISO specs
    // (Note: the computed shortname uses the internal ID. This will be updated
    // by fetch-iso-info to return a better shortname based on the spec's
    // official ISO codification)
    const iso = url.match(/\/www\.iso\.org\/standard\/(\d+)\.html$/);
    if (iso) {
      return `iso-id-${iso[1]}`;
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
  if (!name.match(/^[\w\-]+((?<=v?\d+)\.\d+)?$/)) {
    throw `Specification name contains unexpected characters: ${name} (extracted from ${url})`;
  }

  return name;
}


/**
 * Compute the shortname and level from the spec name, if possible.
 */
function completeWithSeriesAndLevel(shortname, url, forkOf) {
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

  const seriesBasename = forkOf ?? shortname;
  const specShortname = forkOf ? `${forkOf}-fork-${shortname}` : shortname;

  // Shortnames of WebGL extensions sometimes end up with digits which are *not*
  // to be interpreted as level numbers. Similarly, shortnames of ECMA specs
  // typically have the form "ecma-ddd", and "ddd" is *not* a level number.
  // And that's the same for ISO standards which end with plenty of non-level
  // digits, as in "iso18181-2".
  if (seriesBasename.startsWith("ecma-") ||
      seriesBasename.startsWith("tc39-") ||
      seriesBasename.startsWith("iso") ||
      url.match(/^https:\/\/registry\.khronos\.org\/webgl\/extensions\//)) {
    return {
      shortname: specShortname,
      series: { shortname: seriesBasename }
    };
  }

  // Extract X and X.Y levels, with form "name-X" or "name-X.Y".
  // (e.g. 5 for "mediaqueries-5", 1.2 for "wai-aria-1.2")
  let match = seriesBasename.match(/^(.*?)-v?(\d+)(\.\d+)?$/);
  if (match) {
    return {
      shortname: specShortname,
      series: { shortname: modernizeShortname(match[1]) },
      seriesVersion: match[3] ? match[2] + match[3] : match[2]
    };
  }

  // Extract X and X.Y levels with form "nameX", "nameXY" or "nameX.Y"
  // (but not "nameXXY")
  // (e.g. 2.1 for "CSS21", 1.1 for "SVG11", 4 for "selectors4")
  match = seriesBasename.match(/^(.*?)(?<!\d)(\d)\.?(\d?)$/);
  if (match) {
    return {
      shortname: specShortname,
      series: { shortname: modernizeShortname(match[1]) },
      seriesVersion: match[3] ? match[2] + "." + match[3] : match[2]
    };
  }

  // Extract X and X.Y levels with form "rdfXY-something" or "sparqlXY-something"
  // or "shaclXY-something" (e.g. 1.2 for "rdf12-concepts").
  // Note matching would catch `tc39-*` in theory but that case has already
  // been handled.
  match = seriesBasename.match(/^([^\d]+)(\d)(\d)-(.+)$/);
  if (match) {
    return {
      shortname: specShortname,
      series: { shortname: modernizeShortname(match[1] + "-" + match[4]) },
      seriesVersion: match[2] + "." + match[3]
    };
  }

  // No level found
  return {
    shortname: specShortname,
    series: { shortname: modernizeShortname(seriesBasename) }
  };
}


/**
 * Exports main function that takes a URL (or a spec name) and returns an
 * object with a name, a shortname and a level (if needed).
 */
export default function (url, forkOf) {
  if (!url) {
    throw "No URL passed as parameter";
  }
  return completeWithSeriesAndLevel(computeShortname(url), url, forkOf);
}
