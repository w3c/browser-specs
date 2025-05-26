/**
 * Make sure that the browser-specs CLI runs as intended.
 */
import { describe, it } from "node:test";
import assert from "node:assert";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { exec as execCb } from 'node:child_process';
import util from "node:util";
const exec = util.promisify(execCb);

const scriptPath = path.dirname(fileURLToPath(import.meta.url));
const cwd = path.join(scriptPath, '..', 'src');

describe("The browser-specs CLI", () => {
  it("runs without errors", async () => {
    await exec("node cli.js --help", { cwd });
  });
});