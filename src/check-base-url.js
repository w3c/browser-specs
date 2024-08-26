/**
 * CLI tool that parses the generated index of specifications to make sure that
 * the base URL either matches the release URL if there is one, or the nightly
 * URL otherwise.
 *
 * The CLI tool returns Markdown that can typically be used to create an issue.
 * It also sets a check_list environment variable that can be used in GitHub
 * actions.
 *
 * No content is returned when everything looks good.
 */

import core from "@actions/core";
import specs from "../index.json" with { type: "json" };

const problems = specs
  // A subset of the IETF RFCs are crawled from their httpwg.org rendering
  // see https://github.com/tobie/specref/issues/672 and
  // https://github.com/w3c/browser-specs/issues/280
  .filter(s => s.nightly &&
               !s.nightly.url.startsWith('https://httpwg.org') &&
               !s.nightly.url.startsWith('https://www.ietf.org/') &&
               !s.nightly.url.startsWith('https://explainers-by-googlers.github.io/CHIPS-spec/'))
  .filter(s => (s.release && s.url !== s.release.url) || (!s.release && s.url !== s.nightly.url))
  .map(s => {
    const expected = s.release ? "release" : "nightly";
    const expectedUrl = s.release ? s.release.url : s.nightly.url;
    return `- [ ] [${s.title}](${s.url}): expected ${expected} URL ${expectedUrl} to match base URL ${s.url}`;
  });

if (problems.length > 0) {
  const res = problems.join("\n");
  core.exportVariable("check_list", res);
  console.log(res);
}
