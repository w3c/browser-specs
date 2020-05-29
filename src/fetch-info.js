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

const https = require("https");


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
    return new Promise((resolve, reject) => {
      const request = https.get(url, options, res => {
        if (res.statusCode === 404) {
          resolve(null);
        }
        if (res.statusCode === 301) {
          const location = res.headers.location.startsWith('/specifications/') ?
            res.headers.location.substring('/specifications/'.length) :
            res.headers.location;
          reject(`W3C API redirected to "${location}" ` +
            `for "${spec.shortname}" (${spec.url}), update the shortname!`);
          return;
        }
        if (res.statusCode !== 200) {
          reject(`W3C API returned an error, status code is ${res.statusCode}`);
          return;
        }
        res.setEncoding("utf8");
        let data = "";
        res.on("data", chunk => data += chunk);
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          }
          catch (err) {
            reject("Specref returned invalid JSON");
          }
        });
      });
      request.on("error", err => reject(err));
      request.end();
    });
  }));

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
    }
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

    return new Promise((resolve, reject) => {
      const request = https.get(specrefUrl, options, res => {
        if (res.statusCode !== 200) {
          reject(`Could not query Specref, status code is ${res.statusCode}`);
          return;
        }
        res.setEncoding("utf8");
        let data = "";
        res.on("data", chunk => data += chunk);
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          }
          catch (err) {
            reject("Specref returned invalid JSON");
          }
        });
      });
      request.on("error", err => reject(err));
      request.end();
    });
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
    const html = await new Promise((resolve, reject) => {
      const request = https.get(spec.url, options, res => {
        if (res.statusCode !== 200) {
          reject(`Could not fetch URL ${spec.url} for spec "${spec.shortname}", ` +
            `status code is ${res.statusCode}`);
          return;
        }
        res.setEncoding("utf8");
        let data = "";
        res.on("data", chunk => data += chunk);
        res.on("end", () => {
          resolve(data);
        });
      });
      request.on("error", err => reject(err));
      request.end();
    });

    // Extract first heading
    const h1Match = html.match(/<h1[^>]*?>(.*?)<\/h1>/mis);
    if (h1Match) {
      return {
        nightly: { url: spec.url },
        title: h1Match[1].replace(/\n/g, '').trim()
      };
    }

    // Use the document's title if first heading could not be found
    // (that typically happens in Respec specs)
    const titleMatch = html.match(/<title[^>]*?>(.*?)<\/title>/mis);
    if (titleMatch) {
      return {
        nightly: { url: spec.url },
        title: titleMatch[1].replace(/\n/g, '').trim()
      };
    }

    throw `Could not find title in ${spec.url} for spec "${spec.shortname}"`;
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

  return results;
}


module.exports = fetchInfo;