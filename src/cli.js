#!/usr/bin/env node
import { Command } from 'commander';
import path from 'node:path';
import { fileURLToPath } from "node:url";
import fs from 'node:fs/promises';
import Mocha from 'mocha';
import { build } from './build-diff.js';
import { lintStr } from './lint.js';
import { execSync } from "node:child_process";
import loadJSON from './load-json.js';
import splitIssueBodyIntoSections from './split-issue-body.js';

const scriptPath = path.dirname(fileURLToPath(import.meta.url));


/**
 * Command-line execution parameters for calls to `execSync`
 */
const execParams = { cwd: path.join(scriptPath, '..') };


/**
 * Use the version in `package.json`` as the version of the CLI. The code of
 * the CLI likely won't have changed from one version to another but, by
 * definition, the `index.json`` file will have changed, so results of the
 * command may change.
 *
 * TODO: The version in `package.json` is the version of the package that
 * *will be* released. Ideally, the version should rather be the version of
 * the latest released package.
 */
const packageContents = await loadJSON(path.join(scriptPath, '..', 'package.json'));
const version = packageContents.version;


/**
 * Custom Mocha test reporter that fills a result object passed as an option
 */
class ObjectReporter {
  constructor(runner, options) {
    this._results = options?.reporterOption?.results ?? {};
    this._results.pass = [];
    this._results.fail = [];
    runner
      .on(Mocha.Runner.constants.EVENT_TEST_PASS, test => {
        this._results.pass.push({
          title: test.fullTitle(),
          result: 'pass'
        });
      })
      .on(Mocha.Runner.constants.EVENT_TEST_FAIL, (test, err) => {
        this._results.fail.push({
          title: test.fullTitle(),
          result: 'fail',
          actual: err.actual,
          expected: err.expected
        });
      });
  }
}


/**
 * Prepare a report from the build and test results
 */
function buildReport(buildResults, testResults) {
  try {
    const diffLabels = {
      add: 'Add spec',
      update: 'Update spec',
      delete: 'Remove spec',
      seriesUpdate: 'Update spec in the same series'
    };
    let report = '### Changes to `index.json`\n';
    if (!buildResults.diff.changes) {
      report += 'This update would not trigger any change in `index.json`.\n';
    }
    else {
      report += 'This update would trigger the following changes in `index.json`:\n\n';
      for (const type of ['add', 'update', 'seriesUpdate', 'delete']) {
        const diff = buildResults.diff[type];
        if (!diff?.length) {
          continue;
        }
        report += `<details><summary>${diffLabels[type]} (${diff.length})</summary>\n\n`;
        for (const spec of diff) {
          if (type === 'delete') {
            report += `- [${spec.shortname}](${spec.url}): ${spec.title}\n`;
          }
          else {
            report += '```json\n' +
              JSON.stringify(spec, null, 2) +
              '\n```\n';
          }
        }
        report += '</details>\n';
      }
    }
    report += '\n### Tests\n';
    if (testResults?.fail?.length) {
      report += 'With these changes, the following tests would fail:\n';
      for (const test of testResults.fail) {
        report += `<details><summary>${test.title}</summary>\n\n` +
          'Expected:\n' +
          '```json\n' +
          JSON.stringify(test.expected, null, 2) +
          '\n```\n' +
          'Actual:\n' +
          '```json\n' +
          JSON.stringify(test.actual, null, 2) +
          '\n```\n' +
          '</details>\n';
      }
    }
    else {
      report += 'These changes look good! 😎\n';
    }

    for (const spec of (buildResults.analysis?.crawl ?? [])) {
      report += `### Crawl results for ${spec.title}
${spec.crawlSummary}

`;
    }

    return report;
  }
  catch (err) {
    return `Could not build a report due to an internal error:

      ${err}`;
  }
}


/*****************************************************************************
 * Main loop, creates the CLI using Commander.
 *****************************************************************************/
const program = new Command();
program
  .name('browser-specs')
  .version(version)
  .description('Manage the list of specs in browser-specs: the main list, whose source is the `specs.json` file with resulting data in the `index.json` file.');

program
  .command('build')
  .summary('build the info for the given spec or list of changes made to `specs.json`.')
  .description(`Build the info for the given spec or list of changes made to \`specs.json\`.`)
  .argument('<what>', 'what to build. The argument may either be a `<url>` that represents the canonical URL of the spec to build, a named commit `<commit>` to point at the git commit that contains the changes to build in `specs.json`, two arbitrary named commits `<commit>..<commit>` to compile the list of changes made to `specs.json` between the two commits, or an issue number of the w3c/browser-specs repo that represents a spec suggestion and follows the expected structure. The `gh` CLI command must be available if `<what>` is an issue number.')
  .option('-c, --commit', 'commit potential updates to a dedicated branch and switch to that branch. This option implies the `--update` option. The `git` CLI command must be available.')
  .option('-j, --json <json>', 'link to a JSON file with additional spec properties, or a serialized JSON object directly. The option can only be set if `<what>` is a URL. The option value can also be the JSON object directly enclosed in single quotes or double quotes depending on your platform, e.g. `\'{ "nightly": { "sourcePath": "compatibility.bs" } }\'` on Unix systems or `"{ ""nightly"": { ""sourcePath"": ""compatibility.bs"" } }"` on Windows. A `url` property at the root level will be ignored.')
  .option('-p, --pr', 'create a pull request with updates made to the list. This option implies the `--commit` and `--update` options. The `git` and `gh` CLI commands must be available.')
  .option('-r, --reffy', 'crawl the spec with Reffy and report.')
  .option('-q, --quiet', 'do not report progress to the console. Note the command may still report a couple of warnings, because because!')
  .option('-u, --update', 'add the given spec to `specs.json` if needed. The `<what>` argument must be a `<url>` and the command only makes changes to `specs.json` if all tests pass. This option is implied if the `--commit` or `--pr` option is set.')
  .addHelpText('after', `
Output:
  - If the build is successful and tests pass, the command reports a commit message for the changes that includes the result of the build and details changes that the changes would trigger to \`index.json\`. If the \`--commit\` option was set, that message was used as commit message. It may be used to commit the change manually otherwise.
  - If the build is successful but some tests fail, the command reports failed tests.
  - If the build is not successful, the command reports the build error.

Notes:
  - The command logs progress to the console as warnings, to make it easy to redirect the report itself to a file. Use the \`--quiet\` option to silence progress report.
  - The report is in markdown, intended for use in GitHub issues and commit messages.
  - The report includes updates to specs that belong to the same series as the specs identified by the \`<what>\` argument, as needed.

Examples:
  Test a new spec:
  $ browser-specs build https://w3c.github.io/my-funky-spec/

  Test a new spec with additional properties (on a Unix system):
  $ browser-specs build https://w3c.github.io/my-funky-spec/ --json '{ "seriesComposition": "delta" }'

  Test a new spec with additional properties (on a Windows system):
  $ browser-specs build https://w3c.github.io/my-funky-spec/ --json "{ ""seriesComposition"": ""delta"" }"

  Add a new spec:
  $ browser-specs build https://w3c.github.io/my-funky-spec/ --update

  Add and commit a new spec:
  $ browser-specs build https://w3c.github.io/my-funky-spec/ --commit --message "My funky spec is groovy"

  Test a pending \`specs.json\` update in your local repo. Both commands mean the same thing:
  $ browser-specs build working
  $ browser-specs build working..HEAD

  Build changes made to \`specs.json\` in last 3 commits:
  $ browser-specs build HEAD..HEAD~3
`)
  .action(async (what, options) => {
    // Retrieve additional spec properties from the `--json` option
    let custom;
    if (options.json) {
      if (options.json.match(/{/)) {
        try {
          custom = JSON.parse(options.json);
        }
        catch {
          console.error('The JSON option contains invalid JSON');
          process.exit(1);
        }
      }
      else {
        custom = await loadJSON(path.join(process.cwd(), options.json));
        if (!custom) {
          console.error('The JSON option points to an invalid JSON file');
          process.exit(1);
        }
      }
    }

    // Set implicit options
    if (options.pr) {
      options.commit = true;
    }
    if (options.commit) {
      // TODO: make sure that there aren't any pending local changes that
      // would end up in the commit
      options.update = true;
    }

    // Function used to report on progress
    const logProgress = options.quiet ? function () {} : console.warn;

    // Retrieve the actual parameters from GitHub if "what" is an issue number
    let issueNumber = null;
    if (what.match(/^\d+$/)) {
      issueNumber = what;
      what = null;
      custom = {};
      let issueStr = null;
      try {
        issueStr = execSync(`gh issue view ${issueNumber} --json body,state,title`, execParams);
      }
      catch (err) {
        console.log(`Could not retrieve issue #${issueNumber}.`);
        process.exit(1);
      }
      // Note: I wish input IDs set in the YAML template would appear somewhere
      // in the issue body. They do not. Section titles are the only available
      // anchors in practice.
      const issue = JSON.parse(issueStr);
      const sections = splitIssueBodyIntoSections(issue.body);
      for (const section of sections) {
        if (section.title === 'URL') {
          what = section.value;
        }
        else if (section.title === 'Rationale') {
          // When a spec that was already in the list gets published as FPWD,
          // the issue URL should target the /TR URL and mention the ED URL in
          // the Rationale section. We'll use that to tell the build to also
          // delete the associated entry from the list.
          const reED = /\[Editor's Draft\]\((.+?)\) already in the list/i;
          const match = section.value.match(reED);
          if (match) {
            custom.knownUrl = match[1];
          }
        }
        else if (section.title === 'Additional properties') {
          try {
            const json = section.value
              .replace(/^```json\s+{/, '{')
              .replace(/}\s+```$/, '}')
              .trim();
            custom = Object.assign(custom, JSON.parse(json));
          }
          catch {
            console.log('The "Additional properties" section does not contain a valid JSON object.');
            return;
          }
        }
      }
      if (!what) {
        console.log(`Issue #${issueNumber} does not follow the expected structure.`);
        process.exit(1);
      }
    }

    // Prepare test runner
    const mocha = new Mocha({ color: false });
    const testResults = {};
    mocha.reporter(ObjectReporter, { results: testResults });

    // Build the diff and create a new temporary index
    const testIndex = path.join(scriptPath, '..', '__testIndex.json');
    let buildResults;
    try {
      buildResults = await build(what, {
        log: logProgress,
        diffType: 'all',
        custom,
        analyze: !!options.reffy
      });
    }
    catch (err) {
      console.log('The update could not be built:');
      console.log(err);
      return;
    }
    await fs.writeFile(testIndex, JSON.stringify(buildResults.index, null, 2), 'utf8');

    // Build a new temporary specs.json if "what" was a new spec
    const isNewSpec =
      buildResults.what.type === 'spec' &&
      buildResults.diff.add.length === 1;
    const testSpecs = path.join(scriptPath, '..', '__testSpecs.json');
    if (isNewSpec) {
      const specs = await loadJSON(path.join(scriptPath, '..', 'specs.json'));
      specs.push(buildResults.what.spec);
      const specsStr = JSON.stringify(specs, null, 2);
      const linted = lintStr(specsStr) ?? specsStr;
      await fs.writeFile(testSpecs, linted, 'utf8');
    }

    // Run tests against the temporary files created above.
    // Note: we use "process.env" to pass the temporary file names to the
    // test file. Not super clean, but that works ;)
    logProgress(`Run tests...`);
    if (isNewSpec) {
      process.env.testSpecs = testSpecs;
      mocha.addFile(path.join(scriptPath, '..', 'test', 'specs.js'));
    }
    process.env.testIndex = testIndex;
    mocha.addFile(path.join(scriptPath, '..', 'test', 'index.js'));
    // Mocha's `run()` function loads files as CommonJS modules by default.
    // To load them as ESM modules, we need to do it ourselves using
    // `loadFilesAsync()`, see https://mochajs.org/api/mocha#loadFilesAsync
    await mocha.loadFilesAsync();
    const failures = await new Promise(resolve => {
      mocha.run(failures => resolve(failures));
    });
    if (failures) {
      logProgress(`- some tests failed (${failures})`);
    }
    else {
      logProgress(`- all tests ok`);
    }
    logProgress(`Run tests... done`);

    // Prepare results
    const report = buildReport(buildResults, testResults);

    // If "what" was a new spec, no failures were detected and goal is to
    // update `specs.json`, let's do that.
    if (options.update && isNewSpec && !failures) {
      logProgress(`Update specs.json...`);
      await fs.copyFile(testSpecs, path.join(scriptPath, '..', 'specs.json'));
      logPrFogress(`Update specs.json... done`);Z

      const branchName = `add-` + spec.shortname;
      if (options.commit) {
        logProgress(`Commit changes...`);
        const commitFile = path.join(scriptPath, '..', '__commit.md');
        const linkToIssue = issueNumber ? `Close #${issueNumber}, adding the suggested spec to the list.\n` : '';
        await fs.writeFile(
          commitFile,
          `Add ${spec.title}

${linkToIssue}
${report}`,
          'utf8');
        execSync(`git checkout -b ${branchName}`, execParams);
        execSync(`git add specs.json`, execParams);
        execSync(`git commit --file __commit.md`, execParams);
        await fs.rm(commitFile, { force: true });
        logProgress(`Commit changes... done`);
      }

      if (options.pr) {
        logProgress(`Create a PR...`);
        execSync(`git push origin ${branchName}`);
        execSync(`gh pr create --fill`, execParams);
        logProgress(`Create a PR... done`);
      }
    }

    // Drop temp files
    logProgress(`Delete temporary files...`);
    await fs.rm(testIndex, { force: true });
    await fs.rm(testSpecs, { force: true });
    logProgress(`Delete temporary files... done`);

    // Report result
    console.log(report);
  });

program.parseAsync(process.argv);
