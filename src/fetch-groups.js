/**
 * Module that exports a function that takes a list of specifications as input
 * and computes, for each of them, the name of the organization and groups
 * within that organization that develop the specification.
 *
 * The function needs an authentication token for the GitHub API as well as for
 * the W3C API.
 */

const fetch = require("node-fetch");
const { Octokit } = require("@octokit/rest");


/**
 * Exports main function that takes a list of specs (with a url property)
 * as input, completes entries with an "organization" property that contains the
 * name of the organization such as W3C, WHATWG, IETF, Khronos Group,
 * Ecma International, and a "groups" property that contains an array of objects
 * that describe the groups responsible for the spec.
 * 
 * The function preserves the properties if they have already been provided in
 * the input array.
 *
 * The options parameter is used to specify the GitHub API and W3C API
 * authentication tokens.
 */
module.exports = async function (specs, options) {
  // Maintain a cache of fetched resources in memory to avoid sending the
  // same fetch request again and again
  const cache = {};

  // Helper function to retrieve a JSON resource or return null if resource
  // cannot be retrieved
  async function fetchJSON(url, options) {
    const body = cache[url] ?? await fetch(url, options).then(res => {
      if (res.status !== 200) {
        throw new Error(`W3C API returned an error, status code is ${res.status}`);
      }
      return res.json();
    });
    cache[url] = body;
    return body;
  }

  const w3cOptions = options?.w3cApiKey ? { headers: {
    Authorization: `W3C-API apikey="${options.w3cApiKey}"`
  }} : {};

  for (const spec of specs) {
    // Note: same RegExp logic to detect WHATWG, TC39, SVG, Khronos Group and
    // GitHub URLs as in compute-repository.
    const whatwg = spec.url.match(/^https:\/\/([^\.]*).spec.whatwg.org\//);
    if (whatwg) {
      spec.organization = spec.organization ?? "WHATWG";
      spec.groups = spec.groups ?? [{
        name: "WHATWG",
        url: "https://whatwg.org/"
      }];
      continue;
    }

    const tc39 = spec.url.match(/^https:\/\/tc39.es\/([^\/]*)\//);
    if (tc39) {
      spec.organization = spec.organization ?? "Ecma International";
      spec.groups = spec.groups ?? [{
        name: "TC39",
        url: "https://tc39.es/"
      }];
      continue;
    }

    const webgl = spec.url.match(/^https:\/\/www\.khronos\.org\/registry\/webgl\//);
    if (webgl) {
      spec.organization = spec.organization ?? "Khronos Group";
      spec.groups = spec.groups ?? [{
        name: "WebGL Working Group",
        url: "https://www.khronos.org/webgl/"
      }];
      continue;
    }

    // All specs that remain should be developed by some W3C group.
    spec.organization = spec.organization ?? "W3C";

    let groups = null;
    const svgwg = spec.url.match(/^https:\/\/svgwg.org\/specs\/([^\/]*)\/?/);
    if (svgwg) {
      groups = [19480];
    }

    if (!groups) {
      // Use the W3C API to find info about /TR specs
      const w3cTr = spec.url.match(/^https?:\/\/(?:www\.)?w3\.org\/TR\/([^\/]+)\/$/);
      if (w3cTr) {
        const url = `https://api.w3.org/specifications/${w3cTr[1]}/versions/latest`;
        let resp = await fetchJSON(url, w3cOptions);
        if (!resp?._links?.deliverers) {
          throw new Error(`W3C API did not return deliverers for the spec`);
        }
        resp = await fetchJSON(resp._links.deliverers.href, w3cOptions);

        if (!resp?._links?.deliverers) {
          throw new Error(`W3C API did not return deliverers for the spec`);
        }
        groups = [];
        for (const deliverer of resp._links.deliverers) {
          groups.push(deliverer.href);
        }
      }
    }
    
    if (!groups) {
      // Use info in w3c.json file, which we'll either retrieve from the
      // repository when one is defined or directly from the spec origin
      // (we may need to go through the repository in all cases in the future,
      // but that approach works for now)
      let url = null;
      const githubio = spec.url.match(/^https:\/\/([^\.]*)\.github\.io\/([^\/]*)\/?/);
      if (githubio) {
        const octokit = new Octokit({ auth: options?.githubToken });
        const cacheId = githubio[1] + "/" + githubio[2];
        const repo = cache[cacheId] ??
          await octokit.repos.get({ owner: githubio[1], repo: githubio[2] });
        cache[cacheId] = repo;
        const branch = repo?.data?.default_branch;
        if (!branch) {
          throw new Error(`Expected GitHub repository does not exist (${spec.url})`);
        }
        url = new URL(`https://raw.githubusercontent.com/${githubio[1]}/${githubio[2]}/${branch}/w3c.json`);
      }
      else {
        url = new URL(spec.url);
        url.pathname = "/w3c.json";
      }
      const body = await fetchJSON(url.toString());

      // Note the "group" property is either an ID or an array of IDs
      groups = [body?.group].flat().filter(g => !!g);
    }

    // Retrieve info about W3C groups from W3C API
    // (Note the "groups" array may contain numbers, strings or API URLs)
    if (!spec.groups) {
      spec.groups = [];
      for (const id of groups) {
        const url = ('' + id).startsWith("https://") ? id : `https://api.w3.org/groups/${id}`;
        const info = await fetchJSON(url, w3cOptions);
        spec.groups.push({
          name: info.name,
          url: info._links.homepage.href
        });
      }
    }
  }

  return specs;
};