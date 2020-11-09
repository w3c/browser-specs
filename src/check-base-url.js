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

const core = require("@actions/core");
const specs = require("../index.json");

const problems = specs
  .filter(s => (s.release && s.url !== s.release.url) || (!s.release && s.url !== s.nightly.url))
  .map(s => {
    const expected = s.release ? "release" : "nightly";
    const expectedUrl = s.release ? s.release.url : s.nightly.url;
    return `- [ ] [${s.title}](${s.url}): expected ${expected} URL ${expectedUrl} but base URL is ${s.url}`;
  });

if (problems.length > 0) {
  const res = problems.join("\n");
  core.exportVariable("check_list", res);
  console.log(res);
}