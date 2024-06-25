// Tests may run against a test version of the index file
const specs = require(process.env.testIndex ?? "../index.json");
const assert = require("assert");
const os = require("os");
const fs = require("fs");
const path = require("path");
const util = require("util");
const exec = util.promisify(require("child_process").exec);

describe("The build", function () {
  this.slow(30000);
  this.timeout(60000);

  let tmpdir;

  before(async () => {
    tmpdir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "web-specs-"));
    await exec("npm install web-specs", { cwd: tmpdir });
  });

  it("preserves shortnames", () => {
    const lastPublishedSpecs = require(path.join(
      tmpdir, "node_modules", "web-specs", "index.json"));

    const shortnames = lastPublishedSpecs.map(spec => spec.shortname);
    const wrong = shortnames.filter(shortname => !specs.find(spec =>
      spec.shortname === shortname ||
      spec.formerNames?.includes(shortname))
    );
    assert.deepStrictEqual(wrong, []);
  });
});