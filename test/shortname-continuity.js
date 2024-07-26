// Tests may run against a test version of the index file
import assert from "node:assert";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import util from "node:util";
import { exec as execCb } from "node:child_process";
import { fileURLToPath } from "node:url";
const exec = util.promisify(execCb);
import loadJSON from "../src/load-json.js";

const scriptPath = path.dirname(fileURLToPath(import.meta.url));
const specsFile = process.env.testIndex ?? path.resolve(scriptPath, "..", "index.json");
const specs = await loadJSON(specsFile);

describe("The build", function () {
  this.slow(30000);
  this.timeout(60000);

  let tmpdir;

  before(async () => {
    tmpdir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "web-specs-"));
    await exec("npm install web-specs", { cwd: tmpdir });
  });

  it("preserves shortnames", async () => {
    const lastPublishedSpecs = await loadJSON(path.join(
      tmpdir, "node_modules", "web-specs", "index.json"));

    const shortnames = lastPublishedSpecs.map(spec => spec.shortname);
    const wrong = shortnames.filter(shortname => !specs.find(spec =>
      spec.shortname === shortname ||
      spec.formerNames?.includes(shortname))
    );
    assert.deepStrictEqual(wrong, []);
  });
});