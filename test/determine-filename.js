const assert = require("assert");
const determineFilename = require("../src/determine-filename.js");

describe("determine-filename module", function () {
  // Tests need to send network requests
  this.slow(5000);
  this.timeout(30000);

  it("extracts filename from URL", async () => {
    const url = "https://example.org/spec/filename.html";
    const filename = await determineFilename(url);
    assert.equal(filename, "filename.html");
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

  it("finds cover.html filenames", async () => {
    const url = "https://drafts.csswg.org/css2/";
    const filename = await determineFilename(url);
    assert.equal(filename, "cover.html");
  });
});
