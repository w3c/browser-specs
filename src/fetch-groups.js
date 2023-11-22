/**
 * Module that exports a function that takes a list of specifications as input
 * and computes, for each of them, the name of the organization and groups
 * within that organization that develop the specification.
 *
 * The function needs an authentication token for the GitHub API.
 */

const Octokit = require("./octokit");
const parseSpecUrl = require("./parse-spec-url.js");


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
 * The options parameter is used to specify the GitHub API
 * authentication token.
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

  for (const spec of specs) {
    const info = parseSpecUrl(spec.url);
    if (!info) {
      // For IETF documents, retrieve the group info from datatracker
      const ietfName =
        spec.url.match(/rfc-editor\.org\/rfc\/([^\/]+)/) ??
        spec.url.match(/datatracker\.ietf\.org\/doc\/html\/([^\/]+)/);
      if (ietfName) {
        spec.organization = spec.organization ?? "IETF";
        if (spec.groups) continue;
        const ietfJson = await fetchJSON(`https://datatracker.ietf.org/doc/${ietfName[1]}/doc.json`);
        if (ietfJson.group?.type === "WG") {
          spec.groups = [{
            name: `${ietfJson.group.name} Working Group`,
            url: `https://datatracker.ietf.org/wg/${ietfJson.group.acronym}/`
          }];
          continue;
        }
        else if ((ietfJson.group?.type === "Individual") ||
            (ietfJson.group?.type === "Area")) {
          // Document uses the "Individual Submissions" stream, linked to the
          // "none" group in IETF: https://datatracker.ietf.org/group/none/
          // or to an IETF area, which isn't truly a group but still looks like
          // one. That's fine, let's reuse that info.
          spec.groups = [{
            name: ietfJson.group.name,
            url: `https://datatracker.ietf.org/wg/${ietfJson.group.acronym}/`
          }];
          continue;
        }
        else {
          throw new Error(`Could not derive IETF group for ${spec.url}.
            Unknown group type found in https://datatracker.ietf.org/doc/${ietfName[1]}/doc.json`);
        }
      }
      if (!spec.groups) {
        throw new Error(`Cannot extract any useful info from ${spec.url}`);
      }
    }

    if (info && info.owner === "whatwg") {
      const workstreams = await fetchJSON("https://raw.githubusercontent.com/whatwg/sg/main/db.json");
      const workstream = workstreams.workstreams.find(ws => ws.standards.find(s => s.href === spec.url));
      if (!workstream) {
        throw new Error(`No WHATWG workstream found for ${spec.url}`);
      }
      spec.organization = spec.organization ?? "WHATWG";
      spec.groups = spec.groups ?? [{
        name: `${workstream.name} Workstream`,
        url: spec.url
      }];
      continue;
    }

    if (info && info.owner === "tc39") {
      spec.organization = spec.organization ?? "Ecma International";
      spec.groups = spec.groups ?? [{
        name: "TC39",
        url: "https://tc39.es/"
      }];
      continue;
    }

    if (info && info.owner === "khronosgroup") {
      spec.organization = spec.organization ?? "Khronos Group";
      spec.groups = spec.groups ?? [{
        name: "WebGL Working Group",
        url: "https://www.khronos.org/webgl/"
      }];
      continue;
    }

    if (info && info.owner === "w3ctag") {
      spec.groups = spec.groups ?? [{
        name: "Technical Architecture Group",
        url: "https://www.w3.org/2001/tag/"
      }];
    }

    // All specs that remain should be developed by some W3C group.
    spec.organization = spec.organization ?? "W3C";

    if (!spec.groups) {
      let groups = null;
      if (info.name === "svgwg") {
        groups = [19480];
      }
      else if (info.type === "tr") {
        // Use the W3C API to find info about /TR specs
        const url = `https://api.w3.org/specifications/${info.name}/versions/latest`;
        let resp = await fetchJSON(url);
        if (!resp?._links?.deliverers) {
          throw new Error(`W3C API did not return deliverers for the spec`);
        }
        resp = await fetchJSON(resp._links.deliverers.href);

        if (!resp?._links?.deliverers) {
          throw new Error(`W3C API did not return deliverers for the spec`);
        }
        groups = [];
        for (const deliverer of resp._links.deliverers) {
          groups.push(deliverer.href);
        }
      }
      else {
        // Use info in w3c.json file, which we'll either retrieve from the
        // repository when one is defined or directly from the spec origin
        // (we may need to go through the repository in all cases in the future,
        // but that approach works for now)
        let url = null;
        if (info.type === "github") {
          const octokit = new Octokit({ auth: options?.githubToken });
          const cacheId = info.owner + "/" + info.name;
          const repo = cache[cacheId] ??
            await octokit.repos.get({ owner: info.owner, repo: info.name });
          cache[cacheId] = repo;
          const branch = repo?.data?.default_branch;
          if (!branch) {
            throw new Error(`Expected GitHub repository does not exist (${spec.url})`);
          }
          url = new URL(`https://raw.githubusercontent.com/${info.owner}/${info.name}/${branch}/w3c.json`);
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
      spec.groups = [];
      for (const id of groups) {
        const url = ('' + id).startsWith("https://") ? id : `https://api.w3.org/groups/${id}`;
        const info = await fetchJSON(url);
        spec.groups.push({
          name: info.name,
          url: info._links.homepage.href
        });
      }
    }
  }

  return specs;
};
