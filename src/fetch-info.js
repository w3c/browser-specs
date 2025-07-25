/**
 * Module that exports a function that takes an array of specifications objects
 * that each have at least a "url" and a "short" property. The function returns
 * an object indexed by specification "shortname" with additional information
 * about the specification fetched from the W3C API, WHATWG, IETF or from the
 * spec itself. Object returned for each specification contains the following
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
 * - "source": one of "w3c", "ietf", "whatwg", "spec", depending on how the
 * information was determined.
 *
 * The function throws when something goes wrong, e.g. if the given spec object
 * describes a /TR/ specification but the specification has actually not been
 * published to /TR/, if the specification cannot be fetched, or if no W3C API
 * key was specified for a /TR/ URL.
 *
 * The function will start by querying the W3C API, using the given "shortname"
 * properties. For specifications where this fails, the function will query
 * IETF, then WHATWG, using the given "shortname" as well. If that too fails,
 * the function assumes that the given "url" is the URL of the Editor's Draft,
 * and will fetch it to determine the title.
 *
 * If the function needs to retrieve the spec itself, note that it will parse
 * the HTTP response body as a string, applying regular expressions to extract
 * the title. It will not parse it as HTML in particular. This means that the
 * function will fail if the title cannot easily be extracted for some reason.
 */

import puppeteer from "puppeteer";
import loadSpec from "./load-spec.js";
import Octokit from "./octokit.js";
import ThrottledQueue from "./throttled-queue.js";
import fetchJSON from "./fetch-json.js";

async function useKnownInfoWhereAppropriate(specs) {
  const results = {};
  for (const spec of specs) {
    if (spec.__last?.standing === 'discontinued' &&
        (!spec.standing || spec.standing === 'discontinued')) {
      results[spec.shortname] = spec.__last;
    }
    else if (spec.url.match(/\.iso\.org/)) {
      // ISO specs were handled already in fetch-iso-info
      results[spec.shortname] = spec;
    }
  }
  return results;
}

function catchAndFallbackOnExistingData(fn) {
  return function(spec) {
    return fn(spec).catch(err => {
      if (spec.__last) {
        // TODO: log crawl error more visibly?
        console.error(`Failed to fetch info on ${spec.url} (${err}), reusing existing data`);
        return spec.__last;
      } else {
        throw err;
      }
    });
  };
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
    const body = await fetchJSON(url, options);

    // The shortname of the specification may have changed. In such cases, the
    // W3C API silently redirects to the info for the new shortname, whereas we
    // want to make sure we use the latest shortname in browser-specs. The
    // actual shortname used by the W3C API does not appear explicitly in the
    // response to a "/versions/latest" request, but it appears implicitly in
    // the "_links/specification/href" URL.
    const match = body._links.specification.href.match(/\/specifications\/([^\/]+)$/);
    const shortname = match[1];
    if (shortname !== spec.shortname) {
      throw new Error(`W3C API redirects "${spec.shortname}" to ` +
        `"${shortname}", update the shortname!`);
    }

    return body;
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
    const body = await fetchJSON(url, options);

    // The CSS specs and the CSS snapshots have different series shortnames for
    // us ("CSS" vs. "css"), but the W3C API is case-insentive, mixes the two
    // series,  and claims that the series shortname is "CSS" or "css"
    // depending on which spec got published last. Let's get back to the
    // shortname we requested.
    body.shortname = shortname;
    return body;
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

async function fetchInfoFromWHATWG(specs, options) {
  const whatwgRe = /\.whatwg\.org/;
  if (!specs.find(spec => spec.url.match(whatwgRe))) {
    return {};
  }

  // Note: The WHATWG biblio.json file could also be used, but we're going to
  // need the workstreams database in any case in fetch-groups, so let's fetch
  // the database directly (this will put it in cache for fetch-groups)
  const url = 'https://raw.githubusercontent.com/whatwg/sg/main/db.json';
  const db = await fetchJSON(url, options);
  const standards = db.workstreams.map(ws => ws.standards).flat();

  const specInfo = {};
  for (const spec of specs) {
    if (!spec.url.match(/\.whatwg\.org/)) {
      continue;
    }
    const entry = standards.find(std => std.href === spec.url);
    if (!entry) {
      console.warn(`[warning] WHATWG spec at ${spec.url} not found in WHATWG database`);
      continue;
    }
    specInfo[spec.shortname] = {
      nightly: { url: spec.url, status: 'Living Standard' },
      title: entry.name
    };
  }
  return specInfo;
}

async function fetchInfoFromIETF(specs, options) {
  async function fetchRFCName(docUrl) {
    const body = await fetchJSON(docUrl, options);
    return `rfc${body.rfc}`;
  }

  async function fetchObsoletedBy(draftName) {
    if (!draftName.startsWith('rfc')) {
      return [];
    }
    const url = `https://datatracker.ietf.org/api/v1/doc/relateddocument/?format=json&relationship__slug__in=obs&target__name__in=${draftName}`;
    const body = await fetchJSON(url, options);
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

  // IETF can only provide information about IETF specs, no need to fetch the
  // list of RFCs of the HTTP WG if there's no IETF spec in the list.
  if (!specs.find(spec =>
      spec.url.match(/\.rfc-editor\.org/) ||
      spec.url.match(/datatracker\.ietf\.org/))) {
    return {};
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
    const draftUrl = `https://datatracker.ietf.org/doc/${draftName[1]}/doc.json`;
    const jsonDoc = await fetchJSON(draftUrl, options);
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

    try {
      console.warn(`- fetch spec info from ${url}`);
      await loadSpec(url, page);

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
      else if (spec.url.endsWith(".txt")) {
        // Spec from another time (typically the GIF spec), published as plain
        // text. Nothing we can usefully extract from the spec. Let's proceed
        // and hope `specs.json` contains the appropriate info for the spec
        // (no official status for the spec either, using "Editor's Draft")
        return {
          nightly: { url, status: "Editor's Draft" }
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
          else if (status === "First Public Working Draft" ||
                   status === "Working Draft" ||
                   status === "Working Group Draft") {
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
      await page.close();
    }
  }

  try {
    const queue = new ThrottledQueue({
      maxParallel: 4,
      sleepInterval: origin => {
        switch (origin) {
        case 'https://csswg.org': return 2000;
        case 'https://www.w3.org': return 1000;
        default: return 100;
        }
      }
    });
    const info = await Promise.all(specs.map(spec =>
      queue.runThrottledPerOrigin(spec.nightly?.url || spec.url, catchAndFallbackOnExistingData(fetchInfoFromSpec), spec)
    ));
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
    { name: 'known', fn: useKnownInfoWhereAppropriate },
    { name: 'w3c', fn: fetchInfoFromW3CApi },
    { name: 'ietf', fn: fetchInfoFromIETF },
    { name: 'whatwg', fn: fetchInfoFromWHATWG },
    { name: 'spec', fn: fetchInfoFromSpecs }
  ];
  let remainingSpecs = specs;
  for (let i = 0; i < steps.length ; i++) {
    const step = steps[i];
    info[step.name] = remainingSpecs.length > 0 ?
      await step.fn(remainingSpecs, options) :
      {};
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


export default fetchInfo;
