import { describe, it } from "node:test";
import assert from "node:assert";
import determineFilename from "../src/determine-filename.js";

describe("determine-filename module", {timeout: 30000}, function () {
  // Long timeout since tests need to send network requests

  it("extracts filename from URL (.html)", async () => {
    const url = "https://example.org/spec/filename.html";
    const filename = await determineFilename(url);
    assert.equal(filename, "filename.html");
  });

  it("extracts filename from URL (.pdf)", async () => {
    const url = "https://example.org/spec/filename.pdf";
    const filename = await determineFilename(url);
    assert.equal(filename, "filename.pdf");
  });

  it("finds index.html filenames", async () => {
    const url = "https://w3c.github.io/presentation-api/";
    const filename = await determineFilename(url);
    assert.equal(filename, "index.html");
  });

  it("finds Overview.html filenames", async () => {
    const url = "https://www.w3.org/TR/presentation-api/";
    const filename = await determineFilename(url);
    assert.equal(filename, "Overview.html");
  });
});
