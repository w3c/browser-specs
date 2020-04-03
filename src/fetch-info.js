/**
 * Module that exports a function that takes an array of specifications objects
 * that each have at least a "url" and a "name" property. The function returns
 * an object indexed by specification "name" with additional information
 * about the specification fetched from the W3C API, Specref, or from the spec
 * itself. Object returned for each specification contains the following
 * properties:
 *
 * - "edUrl": the URL of the Editor's Draft of the specification. Always set.
 * - "trUrl": the URL of the latest version of the specification published to
 * /TR/. Only set when the specification has been published there.
 * - "title": the title of the specification. Always set.
 * - "source": one of "w3c", "specref", "spec", depending on how the information
 * was determined.
 *
 * The function throws when something goes wrong, e.g. if the given spec object
 * describes a /TR/ specification but the specification has actually not been
 * published to /TR/, if the specification cannot be fetched, or if no W3C API
 * key was specified for a /TR/ URL.
 *
 * The function will start by querying the W3C API, using the given "name"
 * properties. For specifications where this fails, the function will query
 * SpecRef, using the given "name" as well. If that too fails, the function
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

    const url = `https://api.w3.org/specifications/${spec.name}`;
    return new Promise((resolve, reject) => {
      const request = https.get(url, options, res => {
        if (res.statusCode === 404) {
          resolve(null);
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
      results[spec.name] = {
        trUrl: info[idx].shortlink,
        edUrl: info[idx]["editor-draft"],
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
      chunk.map(spec => spec.name).join(',');

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
      if (specs.find(spec => spec.name === name)) {
        const info = chunkRes[resolveAlias(name)];
        results[name] = {
          edUrl: info.edDraft || info.href,
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
          reject(`Could not fetch URL ${spec.url} for spec "${spec.name}", ` +
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
        edUrl: spec.url,
        title: h1Match[1].replace(/\n/g, '').trim()
      };
    }

    // Use the document's title if first heading could not be found
    // (that typically happens in Respec specs)
    const titleMatch = html.match(/<title[^>]*?>(.*?)<\/title>/mis);
    if (titleMatch) {
      return {
        edUrl: spec.url,
        title: titleMatch[1].replace(/\n/g, '').trim()
      };
    }

    throw `Could not find title in ${spec.url} for spec "${spec.name}"`;
  }));

  const results = {};
  specs.forEach((spec, idx) => results[spec.name] = info[idx]);
  return results;
}


/**
 * Main function that takes a list of specifications and returns an object
 * indexed by specification "name" that provides, for each specification, the
 * URL of the Editor's Draft, of the /TR/ version, and the title.
 */
async function fetchInfo(specs, options) {
  if (!specs || specs.find(spec => !spec.name || !spec.url)) {
    throw "Invalid list of specifications passed as parameter";
  }

  options = Object.assign({}, options);
  options.timeout = options.timeout || 30000;

  // Compute information from W3C API
  let remainingSpecs = specs;
  const w3cInfo = await fetchInfoFromW3CApi(remainingSpecs, options);

  // Compute information from Specref for remaining specs
  remainingSpecs = remainingSpecs.filter(spec => !w3cInfo[spec.name]);
  const specrefInfo = await fetchInfoFromSpecref(remainingSpecs, options);

  // Extract information directly from the spec for remaining specs
  remainingSpecs = remainingSpecs.filter(spec => !specrefInfo[spec.name]);
  const specInfo = await fetchInfoFromSpecs(remainingSpecs, options);

  // Merge results
  const results = {};
  specs.map(spec => spec.name).forEach(name => results[name] =
    (w3cInfo[name] ? Object.assign(w3cInfo[name], { source: "w3c" }) : null) ||
    (specrefInfo[name] ? Object.assign(specrefInfo[name], { source: "specref" }) : null) ||
    (specInfo[name] ? Object.assign(specInfo[name], { source: "spec" }) : null));

  return results;
}


module.exports = fetchInfo;