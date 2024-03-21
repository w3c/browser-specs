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
const Octokit = require("./octokit");

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

async function useLastInfoForDiscontinuedSpecs(specs) {
  const results = {};
  for (const spec of specs) {
    if (spec.__last?.standing === 'discontinued' &&
        (!spec.standing || spec.standing === 'discontinued')) {
      results[spec.shortname] = spec.__last;
    }
  }
  return results;
}

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

      // The CSS specs and the CSS snapshots have different series shortnames for
      // us ("CSS" vs. "css"), but the W3C API is case-insentive, mixes the two
      // series,  and claims that the series shortname is "CSS" or "css"
      // depending on which spec got published last. Let's get back to the
      // shortname we requested.
      body.shortname = shortname;

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

    // The W3C API mixes CSS specs and CSS snapshots, let's hardcode the titles
    // of these series. No way to determine the current specification from the
    // W3C API for them, latest spec will be used by default. If needed, a
    // different current specification can be forced in specs.json.
    if (info.shortname === "CSS") {
      results.__series[info.shortname] = {
        title: "Cascading Style Sheets"
      };
    }
    else if (info.shortname === "css") {
      results.__series[info.shortname] = {
        title: "CSS Snapshot"
      };
    }
    else {
      results.__series[info.shortname] = {
        title: info.name,
        currentSpecification: currSpec
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
        if (nightly?.startsWith("https://www.iso.org/")) {
          // The URL is to a page that describes the spec, not to the spec
          // itself (ISO specs are not public).
          results[name] = {
            title: info.title
          }
        }
        else {
          results[name] = {
            nightly: { url: nightly, status },
            title: info.title
          };
        }
      }
    });
  });

  return results;
}


async function fetchInfoFromIETF(specs, options) {
  async function fetchJSONDoc(draftName) {
    const url = `https://datatracker.ietf.org/doc/${draftName}/doc.json`;
    const res = await throttledFetch(url, options);
    if (res.status !== 200) {
      throw new Error(`IETF datatracker returned an error for ${url}, status code is ${res.status}`);
    }
    try {
      return await res.json();
    }
    catch (err) {
      throw new Error(`IETF datatracker returned invalid JSON for ${url}`);
    }
  }

  async function fetchRFCName(docUrl) {
    const res = await fetch(docUrl, options);
    if (res.status !== 200) {
      throw new Error(`IETF datatracker returned an error for ${url}, status code is ${res.status}`);
    }
    try {
      const body = await res.json();
      if (!body.rfc) {
        throw new Error(`Could not find an RFC name in ${docUrl}`);
      }
      return `rfc${body.rfc}`;
    }
    catch (err) {
      throw new Error(`IETF datatracker returned invalid JSON for ${url}`);
    }
  }

  async function fetchObsoletedBy(draftName) {
    if (!draftName.startsWith('rfc')) {
      return [];
    }
    const url = `https://datatracker.ietf.org/api/v1/doc/relateddocument/?format=json&relationship__slug__in=obs&target__name__in=${draftName}`;
    const res = await throttledFetch(url, options);
    if (res.status !== 200) {
      throw new Error(`IETF datatracker returned an error for ${url}, status code is ${res.status}`);
    }
    let body;
    try {
      body = await res.json();
    }
    catch (err) {
      throw new Error(`IETF datatracker returned invalid JSON for ${url}`);
    }

    return Promise.all(body.objects
      .map(obj => `https://datatracker.ietf.org${obj.source}`)
      .map(fetchRFCName));
  }

  // Most RFCs published by the HTTP WG have a friendly version under:
  //   https://httpwg.org/specs
  // ... but not all (e.g., not rfc9292) and some related specs from other
  // groups are also published under httpwg.org. To get a current list of specs
  // published under https://httpwg.org/specs, let's look at the contents of
  // the underlying GitHub repository:
  // https://github.com/httpwg/httpwg.github.io/
  async function getHttpwgRFCs() {
    let rfcs;
    const octokit = new Octokit({ auth: options.githubToken });
    const { data } = await octokit.git.getTree({
        owner: 'httpwg',
        repo: 'httpwg.github.io',
        tree_sha: "HEAD",
        recursive: true
      });
    const paths = data.tree;
    return paths.filter(p => p.path.match(/^specs\/rfc\d+\.html$/))
      .map(p => p.path.match(/(rfc\d+)\.html$/)[1]);
  }
  const httpwgRFCs = await getHttpwgRFCs();

  const info = await Promise.all(specs.map(async spec => {
    // IETF can only provide information about IETF specs
    if (!spec.url.match(/\.rfc-editor\.org/) &&
        !spec.url.match(/datatracker\.ietf\.org/)) {
      return;
    }

    // Retrieve information about the spec
    const draftName =
      spec.url.match(/rfc-editor\.org\/rfc\/([^\/]+)/) ??
      spec.url.match(/datatracker\.ietf\.org\/doc\/html\/([^\/]+)/);
    if (!draftName) {
      throw new Error(`IETF document follows an unexpected URL pattern: ${spec.url}`);
    }
    const jsonDoc = await fetchJSONDoc(draftName[1]);
    const lastRevision = jsonDoc.rev_history.pop();
    if (lastRevision.name !== draftName[1])  {
      throw new Error(`IETF spec ${spec.url} published under a new name "${lastRevision.name}". Canonical URL must be updated accordingly.`);
    }

    // Compute the nightly URL from the spec name, publication status, and
    // groups that develops it.
    // Note we prefer the httpwg.org version for HTTP WG RFCs and drafts.
    let nightly;
    if (lastRevision.name.startsWith('rfc')) {
      if (httpwgRFCs.includes(lastRevision.name)) {
        nightly = `https://httpwg.org/specs/${lastRevision.name}.html`
      }
      else {
        nightly = `https://www.rfc-editor.org/rfc/${lastRevision.name}`;
      }
    }
    else if (jsonDoc.group?.acronym === 'httpbis' || jsonDoc.group?.acronym === 'httpstate') {
      nightly = `https://httpwg.org/http-extensions/${lastRevision.name}.html`
    }
    else {
      nightly = `https://www.ietf.org/archive/id/${lastRevision.name}-${lastRevision.rev}.html`;
    }

    // For the status, use the std_level property, which contains one of the
    // statuses in https://datatracker.ietf.org/api/v1/name/stdlevelname/
    // The property is null for an unpublished Editor's Draft.
    const status = jsonDoc.std_level ?? "Editor's Draft";

    const specInfo = { title: jsonDoc.title, nightly, status };

    // RFCs may have been obsoleted by another IETF spec. When that happens, we
    // should flag the spec as discontinued and obsoleted by the other spec(s).
    const obsoletedBy = await fetchObsoletedBy(draftName[1]);
    const missingRFC = obsoletedBy.find(shortname => !specs.find(spec => spec.shortname === shortname));
    if (missingRFC) {
      throw new Error(`IETF spec at ${spec.url} is obsoleted by ${missingRFC} which is not in the list.`);
    }

    if (obsoletedBy.length > 0) {
      specInfo.standing = "discontinued";
      specInfo.obsoletedBy = obsoletedBy;
    }

    return specInfo;
  }));

  const results = {};
  specs.forEach((spec, idx) => {
    const specInfo = info[idx];
    if (specInfo) {
      results[spec.shortname] = {
        nightly: { url: specInfo.nightly, status: specInfo.status },
        title: specInfo.title
      };
      if (specInfo.standing === "discontinued") {
        results[spec.shortname].standing = specInfo.standing;
        results[spec.shortname].obsoletedBy = specInfo.obsoletedBy;
      }
    }
  });
  return results;
}


async function fetchInfoFromSpecs(specs, options) {
  const browser = await puppeteer.launch();

  async function fetchInfoFromSpec(spec) {
    const url = spec.nightly?.url || spec.url;
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
      else if (spec.url.startsWith("https://www.iso.org/")) {
        const isoTitle = await page.evaluate(_ => {
          const meta = document.querySelector('head meta[property="og:description"]');
          return meta ? meta.getAttribute('content').trim() : null;
        });
        if (isoTitle) {
          return {
            title: isoTitle
          };
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
            .replace(/^W3C /, "")   // Once every full moon, a "W3C " prefix gets added
            .replace(/^AOM /, "");  // ... or an "AOM " prefix in AOM specs
          // And once every other full moon, spec has a weird status
          // (e.g., https://privacycg.github.io/gpc-spec/)
          if (status === "Proposal" || status === "Unofficial Draft") {
            status = "Unofficial Proposal Draft";
          }
          else if ((status === "Working Draft") || (status === "Working Group Draft")) {
            // W3C specs that have a Working Draft nightly status are really
            // Editor's Drafts in practice. Similarly "Working Group Draft" is
            // an AOM status that really means Editor's Draft.
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
        const res = {
          nightly: { url, status: titleAndStatus.status },
          title: titleAndStatus.title
        };

        // The AOM has Draft Deliverables and Final Deliverables. Most AOM
        // specs don't say what they are, we'll assume that they are drafts.
        if (spec.organization === "Alliance for Open Media") {
          if (res.nightly.status === "Editor's Draft" ||
              res.nightly.status === "AOM Working Group Draft") {
            res.nightly.status = "Draft Deliverable";
          }
          if (spec.nightly?.url && spec.url !== spec.nightly.url) {
            res.release = {
              url: spec.url,
              status: "Final Deliverable"
            };
          }
        }

        return res;
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

  const info = {};
  const steps = [
    { name: 'discontinued', fn: useLastInfoForDiscontinuedSpecs },
    { name: 'w3c', fn: fetchInfoFromW3CApi },
    { name: 'ietf', fn: fetchInfoFromIETF },
    { name: 'specref', fn: fetchInfoFromSpecref },
    { name: 'spec', fn: fetchInfoFromSpecs }
  ];
  let remainingSpecs = specs;
  for (let i = 0; i < steps.length ; i++) {
    const step = steps[i];
    info[step.name] = await step.fn(remainingSpecs, options);
    remainingSpecs = remainingSpecs.filter(spec => !info[step.name][spec.shortname]);
  }

  function getFirstInfo(shortname) {
    for (const step of steps) {
      const specInfo = info[step.name][shortname];
      if (specInfo) {
        if (!specInfo.source) {
          specInfo.source = step.name;
        }
        return specInfo;
      }
    }
  }

  // Merge results
  const results = {};
  specs.map(spec => spec.shortname).forEach(name => results[name] = getFirstInfo(name));

  // Add series info from W3C API
  results.__series = info.w3c.__series;

  return results;
}


module.exports = fetchInfo;
