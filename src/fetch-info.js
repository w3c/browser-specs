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
 * If the function needs to retrieve the spec itself, note that it will parse
 * the HTTP response body as a string, applying regular expressions to extract
 * the title. It will not parse it as HTML in particular. This means that the
 * function will fail if the title cannot easily be extracted for some reason.
 *
 * Note: the function operates on a list of specs and not only on one spec to
 * bundle requests to Specref.
 */

const puppeteer = require("puppeteer");
const throttle = require("./throttle");
const throttledFetch = throttle(fetch, 2);
const computeShortname = require("./compute-shortname");

// Map spec statuses returned by Specref to those used in specs
// Note we typically won't get /TR statuses from Specref, since all /TR URLs
// are handled through the W3C API. Also, "Proposal for a CSS module" entries
// were probably manually hardcoded in Specref, they are really just Editor's
// Drafts in practice.
const specrefStatusMapping = {
  "ED": "Editor's Draft",
  "Proposal for a CSS module": "Editor's Draft",
  "cg-draft": "Draft Community Group Report"
};

async function fetchInfoFromW3CApi(specs, options) {
  options.headers = options.headers || {};

  const info = await Promise.all(specs.map(async spec => {
    // Skip specs when the known URL is not a /TR/ URL, because there may still
    // be a spec with the same name published to /TR/ but that is probably an
    // outdated version (e.g. WHATWG specs such as DOM or Fullscreen, or CSS
    // drafts published a long long time ago)    
    if (!spec.url.match(/^https?:\/\/(?:www\.)?w3\.org\/TR\/([^\/]+)\/$/)) {
      return;
    }

    const url = `https://api.w3.org/specifications/${spec.shortname}/versions/latest`;
    const res = await throttledFetch(url, options);
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
      if (info[idx].shortlink?.startsWith('http:')) {
        console.warn(`[warning] force HTTPS for release of ` +
          `"${spec.shortname}", W3C API returned "${info[idx].shortlink}"`);
      }
      if (info[idx]["editor-draft"]?.startsWith('http:')) {
        console.warn(`[warning] force HTTPS for nightly of ` +
          `"${spec.shortname}", W3C API returned "${info[idx]["editor-draft"]}"`);
      }
      const release = info[idx].shortlink?.replace(/^http:/, 'https:') ?? null;
      const nightly = info[idx]["editor-draft"]?.replace(/^http:/, 'https:') ?? null;
      const status = info[idx].status === "Retired" ? "Discontinued Draft" : info[idx].status;

      results[spec.shortname] = {
        release: { url: release, status },
        nightly: { url: nightly, status: "Editor's Draft" },
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
    const res = await throttledFetch(url, options);
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

  // Browser-specs contributes specs to Specref. By definition, we cannot rely
  // on information from Specref about these specs. Unfortunately, the Specref
  // API does not return the "source" field, so we need to retrieve the list
  // ourselves from Specref's GitHub repository.
  const specrefBrowserspecsUrl = "https://raw.githubusercontent.com/tobie/specref/main/refs/browser-specs.json";
  const browserSpecsResponse = await throttledFetch(specrefBrowserspecsUrl, options);
  if (browserSpecsResponse.status !== 200) {
    throw new Error(`Could not retrieve specs contributed by browser-specs to Speref, status code is ${browserSpecsResponse.status}`);
  }
  const browserSpecs = await browserSpecsResponse.json();
  specs = specs.filter(spec => !browserSpecs[spec.shortname.toUpperCase()]);

  const chunks = chunkArray(specs, 50);
  const chunksRes = await Promise.all(chunks.map(async chunk => {
    let specrefUrl = "https://api.specref.org/bibrefs?refs=" +
      chunk.map(spec => spec.shortname).join(',');

    const res = await throttledFetch(specrefUrl, options);
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
        if (info.edDraft?.startsWith('http:')) {
          console.warn(`[warning] force HTTPS for nightly of ` +
            `"${spec.shortname}", Specref returned "${info.edDraft}"`);
        }
        if (info.href?.startsWith('http:')) {
          console.warn(`[warning] force HTTPS for nightly of ` +
            `"${spec.shortname}", Specref returned "${info.href}"`);
        }
        const nightly =
          info.edDraft?.replace(/^http:/, 'https:') ??
          info.href?.replace(/^http:/, 'https:') ??
          null;
        const status =
          specrefStatusMapping[info.status] ??
          info.status ??
          "Editor's Draft";
        results[name] = {
          nightly: { url: nightly, status },
          title: info.title
        };
      }
    });
  });

  return results;
}


async function fetchInfoFromSpecs(specs, options) {
  const browser = await puppeteer.launch();

  async function fetchInfoFromSpec(spec) {
    let url = spec.nightly?.url || spec.url;
    const page = await browser.newPage();

    // Inner function that returns a network interception method for Puppeteer,
    // to avoid downloading images and getting stuck on streams.
    // NB: this is a simplified version of the code used in Reffy:
    // https://github.com/w3c/reffy/blob/25bb1be05be63cae399d2648ecb1a5ea5ab8430a/src/lib/util.js#L351
    function interceptRequest(cdp) {
      return async function ({ requestId, request }) {
        try {
          // Abort network requests to common image formats
          if (/\.(gif|ico|jpg|jpeg|png|ttf|woff)$/i.test(request.url)) {
            await cdp.send('Fetch.failRequest', { requestId, errorReason: 'Failed' });
            return;
          }

          // Abort network requests that return a "stream", they don't
          // play well with Puppeteer's "networkidle0" option
          if (request.url.startsWith('https://drafts.csswg.org/api/drafts/') ||
              request.url.startsWith('https://drafts.css-houdini.org/api/drafts/') ||
              request.url.startsWith('https://drafts.fxtf.org/api/drafts/') ||
              request.url.startsWith('https://api.csswg.org/shepherd/')) {
            await cdp.send('Fetch.failRequest', { requestId, errorReason: 'Failed' });
            return;
          }

          // Proceed with the network request otherwise
          await cdp.send('Fetch.continueRequest', { requestId });
        }
        catch (err) {
          console.warn(`[warn] Network request to ${request.url} failed`, err);
        }
      }
    }

    // Intercept network requests to avoid downloading images and streams
    const cdp = await page.target().createCDPSession();

    try {
      await cdp.send('Fetch.enable');
      cdp.on('Fetch.requestPaused', interceptRequest(cdp));

      await page.goto(url, { timeout: 120000, waitUntil: 'networkidle0' });

      // Wait until the generation of the spec is completely over
      // (same code as in Reffy, except Reffy forces the latest version of
      // Respec and thus does not need to deal with older specs that rely
      // on a version that sets `respecIsReady` and not `respec.ready`.
      await page.evaluate(async () => {
        const usesRespec =
          (window.respecConfig || window.eval('typeof respecConfig !== "undefined"')) &&
          window.document.head.querySelector("script[src*='respec']");

        function sleep(ms) {
          return new Promise(resolve => setTimeout(resolve, ms, 'slept'));
        }

        async function isReady(counter) {
          counter = counter || 0;
          if (counter > 60) {
            throw new Error(`Respec generation took too long for ${window.location.toString()}`);
          }
          if (document.respec?.ready || document.respecIsReady) {
            // Wait for resolution of ready promise
            const res = await Promise.race([document.respec?.ready ?? document.respecIsReady, sleep(60000)]);
            if (res === 'slept') {
              throw new Error(`Respec generation took too long for ${window.location.toString()}`);
            }
          }
          else if (usesRespec) {
            await sleep(1000);
            await isReady(counter + 1);
          }
        }

        await isReady();
      });

      if (spec.url.startsWith("https://tc39.es/")) {
        // Title is either flagged with specific class or the second h1
        const ecmaTitle = await page.evaluate(_ => {
          const h1ecma =
            document.querySelector('#spec-container h1.title') ??
            document.querySelectorAll("h1")[1];
          return h1ecma ? h1ecma.textContent.replace(/\n/g, '').trim() : null;
        });
        if (ecmaTitle) {
          return {
            nightly: { url: url, status: "Editor's Draft" },
            title: ecmaTitle
          };
        }
      }

      // For IETF drafts, look at the front matter to extract the name of the
      // Internet Draft and compute the nightly URL from that name
      if (!spec.nightly?.url && spec.url.match(/datatracker\.ietf\.org/)) {
        const draftName = await page.evaluate(_ => {
          const el = document.querySelector('.internet-draft');
          if (el) {
            return el.innerText.trim();
          }
        });
        if (draftName) {
          url = `https://www.ietf.org/archive/id/${draftName}.html`;
          if (draftName.match(/^draft-ietf-http(bis)?-/)) {
            // Prefer the httpwg.org version for HTTP WG drafts
            url = `https://httpwg.org/http-extensions/${draftName.replace(/-\d+$/, '')}.html`;
          }
        }
      }

      const titleAndStatus = await page.evaluate(_ => {
        // Extract first heading when set
        let title = document.querySelector("h1");
        if (!title) {
          // Use the document's title if first heading could not be found
          // (that typically happens in Respec specs)
          title = document.querySelector("title");
        }

        if (title) {
          title = title.textContent.replace(/\n/g, '').trim();

          // The draft CSS specs server sometimes goes berserk and returns
          // the contents of the directory instead of the actual spec. Let's
          // throw an error when that happens so as not to create fake titles.
          if (title.startsWith('Index of ')) {
            return { error: "CSS server issue" };
          }

          // Extract status if found
          // Selectors are for W3C specs and WHATWG specs, other specs are assumed
          // to always be "Editor's Drafts" for now.
          // TODO: consider adding more explicit support for IETF draft specs.
          const subtitle = document.querySelector([
            ".head #w3c-state",         // Modern W3C specs
            ".head h2",                 // Some older W3C specs
            ".head #subtitle",          // WHATWG specs
            ".head #living-standard"    // HTML spec
          ].join(","));
          const match = subtitle?.textContent.match(/^\s*(.+?)(,| — Last Updated)?\s+\d{1,2} \w+ \d{4}\s*$/);
          let status = (match ? match[1] : "Editor's Draft")
            .replace(/’/g, "'")     // Bikeshed generates curly quotes
            .replace(/^W3C /, "");  // Once every full moon, a "W3C " prefix gets added
          // And once every other full moon, spec has a weird status
          // (e.g., https://privacycg.github.io/gpc-spec/)
          if (status === "Proposal" || status === "Unofficial Draft") {
            status = "Unofficial Proposal Draft";
          }
          else if (status === "Working Draft") {
            status = "Editor's Draft";
          }
          return { title, status };
        }
        else {
          return { error: "Could not find title" };
        }
      });

      if (titleAndStatus.error) {
        throw new Error(titleAndStatus.error + `, in ${url} for ${spec.shortname}`);
      }
      else {
        return {
          nightly: { url, status: titleAndStatus.status },
          title: titleAndStatus.title
        };
      }
    }
    finally {
      await cdp.detach();
      await page.close();
    }
  }

  try {
    const info = await Promise.all(specs.map(throttle(fetchInfoFromSpec, 2)));
    const results = {};
    specs.forEach((spec, idx) => results[spec.shortname] = info[idx]);
    return results;
  }
  finally {
    await browser.close();
  }
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
