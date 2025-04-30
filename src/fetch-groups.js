/**
 * Module that exports a function that takes a list of specifications as input
 * and computes, for each of them, the name of the organization and groups
 * within that organization that develop the specification.
 *
 * The function needs an authentication token for the GitHub API.
 */

import Octokit from "./octokit.js";
import parseSpecUrl from "./parse-spec-url.js";
import fetchJSON from "./fetch-json.js";


/**
 * We will very likely need to use group information from the validate-repos
 * project which compiles w3c.json files across repositories.
 */
let w3cGroups = null;


/**
 * Retrieve the information about the exact organization and the group that
 * develops an ISO specification from the description page on the ISO web site.
 *
 * The group's name and URL appear in the page under the General Information
 * heading.
 *
 * Note: It would be better to use Puppeteer to parse the HTML, but that seems
 * a bit overkill (and would not be future proof either since the HTML page
 * does not contain good non-text anchors to extract the info we need.
 */
async function setISOGroupFromPage(spec, options) {
  const res = await fetch(spec.url, options);
  if (res.status !== 200) {
    throw new Error(`Could not retrieve ISO page ${spec.url}, status code is ${res.status}`);
  }
  const html = await res.text();
  let startPos = html.indexOf('<h3>General information</h3>');
  if (startPos === -1) {
    throw new Error(`Cannot find General information heading in ISO page ${spec.url}`);
  }
  startPos = html.indexOf('Technical Committee&nbsp;:', startPos);
  if (startPos === -1) {
    throw new Error(`Cannot find technical committee information in ISO page ${spec.url}`);
  }
  startPos = html.indexOf('<a ', startPos);
  if (startPos === -1) {
    throw new Error(`Cannot find technical committee anchor in ISO page ${spec.url}`);
  }
  startPos = html.indexOf('href="', startPos);
  let endPos = html.indexOf('"', startPos + 'href="'.length);
  if (startPos === -1 || endPos === -1) {
    throw new Error(`Cannot find technical committee href in ISO page ${spec.url}`);
  }
  const groupUrl = html.substring(startPos + 'href="'.length, endPos);
  startPos = html.indexOf('>', endPos);
  endPos = html.indexOf('<', startPos);
  if (startPos === -1 || endPos === -1) {
    throw new Error(`Cannot find technical committee name in ISO page ${spec.url}`);
  }
  const groupName = html.substring(startPos + 1, endPos).trim();

  if (groupName.startsWith('ISO/IEC')) {
    spec.organization = 'ISO/IEC';
  }
  else {
    spec.organization = 'ISO';
  }

  spec.groups = [{
    name: groupName,
    url: (new URL(groupUrl, 'https://www.iso.org')).href
  }];
}


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
export default async function (specs, options) {
  // Maintain a cache of fetched resources in memory to avoid sending the
  // same fetch request again and again
  const cache = {};

  for (const spec of specs) {
    if (spec.__last?.standing === 'discontinued' &&
        (!spec.standing || spec.standing === 'discontinued')) {
      spec.organization = spec.__last.organization;
      spec.groups = spec.__last.groups;
      continue;
    }
    const info = parseSpecUrl(spec.url);
    if (!info) {
      // For IETF documents, retrieve the group info from datatracker
      const ietfName =
        spec.url.match(/rfc-editor\.org\/rfc\/([^\/]+)/) ??
        spec.url.match(/datatracker\.ietf\.org\/doc\/html\/([^\/]+)/);
      if (ietfName) {
        spec.organization = spec.organization ?? "IETF";
        if (spec.groups) continue;
        const ietfJson = await fetchJSON(`https://datatracker.ietf.org/doc/${ietfName[1]}/doc.json`, options);
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

      // For ISO documents, retrieve the group info from the HTML page
      // (NB: it would be cleaner to use Puppeteer here)
      const isoName = spec.url.match(/https:\/\/www\.iso\.org\//);
      if (isoName) {
        await setISOGroupFromPage(spec, options);
      }

      if (!spec.groups) {
        throw new Error(`Cannot extract any useful info from ${spec.url}`);
      }
    }

    if (info && info.owner === "whatwg") {
      const workstreams = await fetchJSON("https://raw.githubusercontent.com/whatwg/sg/main/db.json", options);
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

    // For the Alliance for Open Media (AOM), let's consider that the Codec WG
    // is the default group, noting that it is not super clear which AOM group
    // develops which spec in practice: https://aomedia.org/about/
    if (info && info.owner === "aomediacodec") {
      spec.organization = spec.organization ?? "Alliance for Open Media";
      spec.groups = spec.groups ?? [{
        name: "Codec Working Group",
        url: "https://aomedia.org/about/#codec-working-group"
      }]
    }



    // All specs that remain should be developed by some W3C group.
    spec.organization = spec.organization ?? "W3C";

    if (!spec.groups) {
      // Get group info from validate-repos if possible to avoid having to
      // send individual network requests for each spec
      // Note: this will not yield anything for many /TR specs because we
      // guess the name of the repo from the shortname.
      if (!w3cGroups) {
        const report = await fetchJSON(
          "https://w3c.github.io/validate-repos/report.json"
        );
        w3cGroups = report.groups;
      }
      spec.groups = Object.values(w3cGroups)
        .filter(group => group.repos?.find(repo =>
          repo.fullName?.toLowerCase() === `${info.owner}/${info.name}`.toLowerCase()
        ))
        .map(group => Object.assign({
          name: group.name,
          url: group._links.homepage.href
        }));
    }
    if (spec.groups.length === 0) {
      let groups = [];
      if (info.name === "svgwg") {
        groups.push(19480);
      }
      else if (info.type === "tr") {
        // Use the W3C API to find info about /TR specs
        const url = `https://api.w3.org/specifications/${info.name}/versions/latest`;
        let resp = await fetchJSON(url, options);
        if (!resp?._links?.deliverers) {
          throw new Error(`W3C API did not return deliverers for the spec`);
        }
        resp = await fetchJSON(resp._links.deliverers.href, options);

        if (!resp?._links?.deliverers) {
          throw new Error(`W3C API did not return deliverers for the spec`);
        }
        for (const deliverer of resp._links.deliverers) {
          groups.push(deliverer.href);
        }
      }
      else {
        // Use info in w3c.json file, which we'll either retrieve from the
        // repository when one is defined or directly from the spec origin
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
        const body = await fetchJSON(url.toString(), options);

        // Note the "group" property is either an ID or an array of IDs
        groups = [body?.group].flat().filter(g => !!g);
      }

      // Retrieve info about W3C groups from W3C API
      // (Note the "groups" array may contain numbers, strings or API URLs)
      for (const id of groups) {
        const url = ('' + id).startsWith("https://") ? id : `https://api.w3.org/groups/${id}`;
        const info = await fetchJSON(url, options);
        spec.groups.push({
          name: info.name,
          url: info._links.homepage.href
        });
      }
    }
  }

  return specs;
};
