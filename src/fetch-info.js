/**
 * Module that exports a function that takes an array of specifications objects
 * that each have at least a "url" and a "short" property. The function returns
 * an object indexed by specification "shortname" with additional information
 * about the specification fetched from the W3C API, Specref, or from the spec
 * itself. Object returned for each specification contains the following
 * properties:
 *
 * - "nightly": an object that describes the nightly version. The object will
 * feature the URL of the Editor's Draft for W3C specs, of the living document
 * for WHATWG specifications, or of the published Khronos Group specification.
 * The object may also feature the URL of the repository that hosts the nightly
 * version of the spec.
 * - "release": an object that describes the published version. The object will
 * feature the URL of the TR document for W3C specs when it exists, and is not
 * present for specs that don't have release versions (WHATWG specs, CG drafts).
 * - "title": the title of the specification. Always set.
 * - "source": one of "w3c", "specref", "spec", depending on how the information
 * was determined.
 *
 * The function throws when something goes wrong, e.g. if the given spec object
 * describes a /TR/ specification but the specification has actually not been
 * published to /TR/, if the specification cannot be fetched, or if no W3C API
 * key was specified for a /TR/ URL.
 *
 * The function will start by querying the W3C API, using the given "shortname"
 * properties. For specifications where this fails, the function will query
 * SpecRef, using the given "shortname" as well. If that too fails, the function
 * assumes that the given "url" is the URL of the Editor's Draft, and will fetch
 * it to determine the title.
 *
 * The function needs an API key to fetch the W3C API, which can be passed
 * within an "options" object with a "w3cApiKey" property.
 *
 * If the function needs to retrieve the spec itself, note that it will parse
 * the HTTP response body as a string, applying regular expressions to extract
 * the title. It will not parse it as HTML in particular. This means that the
 * function will fail if the title cannot easily be extracted for some reason.
 *
 * Note: the function operates on a list of specs and not only on one spec to
 * bundle requests to Specref.
 */

const throttle = require("./throttle");
const baseFetch = require("node-fetch");
const fetch = throttle(baseFetch, 2);
const computeShortname = require("./compute-shortname");
const {JSDOM} = require("jsdom");
const JSDOMFromURL = throttle(JSDOM.fromURL, 2);



async function fetchInfoFromW3CApi(specs, options) {
  // Cannot query the W3C API if API key was not given
  if (!options || !options.w3cApiKey) {
    return [];
  }
  options.headers = options.headers || {};
  options.headers.Authorization = `W3C-API apikey="${options.w3cApiKey}"`;

  const info = await Promise.all(specs.map(async spec => {
    // Skip specs when the known URL is not a /TR/ URL, because there may still
    // be a spec with the same name published to /TR/ but that is probably an
    // outdated version (e.g. WHATWG specs such as DOM or Fullscreen, or CSS
    // drafts published a long long time ago)    
    if (!spec.url.match(/^https?:\/\/(?:www\.)?w3\.org\/TR\/([^\/]+)\/$/)) {
      return;
    }

    const url = `https://api.w3.org/specifications/${spec.shortname}`;
    const res = await fetch(url, options);
    if (res.status === 404) {
      return;
    }
    if (res.status === 301) {
      const rawLocation = res.headers.get('location');
      const location = rawLocation.startsWith('/specifications/') ?
        rawLocation.substring('/specifications/'.length) :
        rawLocation.location;
      throw new Error(`W3C API redirected to "${location}" ` +
        `for "${spec.shortname}" (${spec.url}), update the shortname!`);
    }
    if (res.status !== 200) {
      throw new Error(`W3C API returned an error, status code is ${res.status}`);
    }
    try {
      const body = await res.json();
      return body;
    }
    catch (err) {
      throw new Error("W3C API returned invalid JSON");
    }
  }));

  const seriesShortnames = new Set();
  const results = {};
  specs.forEach((spec, idx) => {
    if (info[idx]) {
      if (info[idx].shortlink &&
          info[idx].shortlink.startsWith('http:')) {
        console.warn(`[warning] force HTTPS for release of ` +
          `"${spec.shortname}", W3C API returned "${info[idx].shortlink}"`);
      }
      if (info[idx]["editor-draft"] &&
          info[idx]["editor-draft"].startsWith('http:')) {
        console.warn(`[warning] force HTTPS for nightly of ` +
          `"${spec.shortname}", W3C API returned "${info[idx]["editor-draft"]}"`);
      }
      const release = info[idx].shortlink ?
        info[idx].shortlink.replace(/^http:/, 'https:') :
        null;
      const nightly = info[idx]["editor-draft"] ?
        info[idx]["editor-draft"].replace(/^http:/, 'https:') :
        null;

      results[spec.shortname] = {
        release: { url: release },
        nightly: { url: nightly },
        title: info[idx].title
      };

      if (spec.series?.shortname) {
        seriesShortnames.add(spec.series.shortname);
      }
    }
  });

  // Fetch info on the series
  const seriesInfo = await Promise.all([...seriesShortnames].map(async shortname => {
    const url = `https://api.w3.org/specification-series/${shortname}`;
    const res = await fetch(url, options);
    if (res.status === 404) {
      return;
    }
    if (res.status !== 200) {
      throw new Error(`W3C API returned an error, status code is ${res.status}`);
    }
    try {
      const body = await res.json();
      return body;
    }
    catch (err) {
      throw new Error("W3C API returned invalid JSON");
    }
  }));

  results.__series = {};
  seriesInfo.forEach(info => {
    const currSpecUrl = info._links["current-specification"].href;
    const currSpec = currSpecUrl.substring(currSpecUrl.lastIndexOf('/') + 1);
    results.__series[info.shortname] = {
      title: info.name,
      currentSpecification: currSpec
    };
  });

  return results;
}


async function fetchInfoFromSpecref(specs, options) {
  function chunkArray(arr, len) {
    let chunks = [];
    let i = 0;
    let n = arr.length;
    while (i < n) {
      chunks.push(arr.slice(i, i += len));
    }
    return chunks;
  }

  const chunks = chunkArray(specs, 50);
  const chunksRes = await Promise.all(chunks.map(async chunk => {
    let specrefUrl = "https://api.specref.org/bibrefs?refs=" +
      chunk.map(spec => spec.shortname).join(',');

    const res = await fetch(specrefUrl, options);
    if (res.status !== 200) {
      throw new Error(`Could not query Specref, status code is ${res.status}`);
    }
    try {
      const body = await res.json();
      return body;
    }
    catch (err) {
      throw new Error("Specref returned invalid JSON");
    }
  }));

  const results = {};
  chunksRes.forEach(chunkRes => {

    // Specref manages aliases, let's follow the chain to the final spec
    function resolveAlias(name, counter) {
      counter = counter || 0;
      if (counter > 100) {
        throw "Too many aliases returned by Respec";
      }
      if (chunkRes[name].aliasOf) {
        return resolveAlias(chunkRes[name].aliasOf, counter + 1);
      }
      else {
        return name;
      }
    }
    Object.keys(chunkRes).forEach(name => {
      if (specs.find(spec => spec.shortname === name)) {
        const info = chunkRes[resolveAlias(name)];
        if (info.edDraft && info.edDraft.startsWith('http:')) {
          console.warn(`[warning] force HTTPS for nightly of ` +
            `"${spec.shortname}", Specref returned "${info.edDraft}"`);
        }
        if (info.href && info.href.startsWith('http:')) {
          console.warn(`[warning] force HTTPS for nightly of ` +
            `"${spec.shortname}", Specref returned "${info.href}"`);
        }
        const nightly = info.edDraft ?
          info.edDraft.replace(/^http:/, 'https:') :
          info.href ? info.href.replace(/^http:/, 'https:') :
          null;
        results[name] = {
          nightly: { url: nightly },
          title: info.title
        };
      }
    });
  });

  return results;
}


async function fetchInfoFromSpecs(specs, options) {
  const info = await Promise.all(specs.map(async spec => {
    const url = spec.nightly?.url || spec.url;
    // Force use of more stable w3c.github.io address for CSS drafts
    let fetchUrl = url;
    if (url.match(/\/drafts\.csswg\.org/)) {
      const draft = computeShortname(url);
      fetchUrl = `https://w3c.github.io/csswg-drafts/${draft.shortname}/`;
    }
    let dom = null;
    try {
      dom = await JSDOMFromURL(fetchUrl);
    }
    catch (err) {
      throw new Error(`Could not retrieve ${fetchUrl} with JSDOM: ${err.message}`);
    }

    if (spec.url.startsWith("https://tc39.es/")) {
      // Title is either flagged with specific class or the second h1
      const h1ecma =
        dom.window.document.querySelector('#spec-container h1.title') ??
        dom.window.document.querySelectorAll("h1")[1];
      if (h1ecma) {
        return {
          nightly: { url: url },
          title: h1ecma.textContent.replace(/\n/g, '').trim()
        };
      }
    }

    // Extract first heading when set
    let title = dom.window.document.querySelector("h1");
    if (!title) {
      // Use the document's title if first heading could not be found
      // (that typically happens in Respec specs)
      title = dom.window.document.querySelector("title");
    }

    if (title) {
      title = title.textContent.replace(/\n/g, '').trim();

      // The draft CSS specs server sometimes goes berserk and returns
      // the contents of the directory instead of the actual spec. Let's
      // throw an error when that happens so as not to create fake titles.
      if (title.startsWith('Index of ')) {
        throw new Error(`CSS server issue detected in ${url} for ${spec.shortname}`);
      }

      return {
        nightly: { url },
        title
      };
    }

    throw new Error(`Could not find title in ${url} for ${spec.shortname}`);
  }));

  const results = {};
  specs.forEach((spec, idx) => results[spec.shortname] = info[idx]);
  return results;
}


/**
 * Main function that takes a list of specifications and returns an object
 * indexed by specification "shortname" that provides, for each specification,
 * the URL of the Editor's Draft, of the /TR/ version, and the title.
 */
async function fetchInfo(specs, options) {
  if (!specs || specs.find(spec => !spec.shortname || !spec.url)) {
    throw "Invalid list of specifications passed as parameter";
  }

  options = Object.assign({}, options);
  options.timeout = options.timeout || 30000;

  // Compute information from W3C API
  let remainingSpecs = specs;
  const w3cInfo = await fetchInfoFromW3CApi(remainingSpecs, options);

  // Compute information from Specref for remaining specs
  remainingSpecs = remainingSpecs.filter(spec => !w3cInfo[spec.shortname]);
  const specrefInfo = await fetchInfoFromSpecref(remainingSpecs, options);

  // Extract information directly from the spec for remaining specs
  remainingSpecs = remainingSpecs.filter(spec => !specrefInfo[spec.shortname]);
  const specInfo = await fetchInfoFromSpecs(remainingSpecs, options);

  // Merge results
  const results = {};
  specs.map(spec => spec.shortname).forEach(name => results[name] =
    (w3cInfo[name] ? Object.assign(w3cInfo[name], { source: "w3c" }) : null) ||
    (specrefInfo[name] ? Object.assign(specrefInfo[name], { source: "specref" }) : null) ||
    (specInfo[name] ? Object.assign(specInfo[name], { source: "spec" }) : null));

  // Add series info from W3C API
  results.__series = w3cInfo.__series;

  return results;
}


module.exports = fetchInfo;
