const assert = require("assert");
const computeStanding = require("../src/compute-standing.js");

describe("compute-standing module", () => {
  it("returns `good` for an Editor's Draft", function () {
    const spec = { nightly: { status: "Editor's Draft" } };
    assert.strictEqual(computeStanding(spec), "good");
  });

  it("returns `good` for a Living Standard", function () {
    const spec = { nightly: { status: "Living Standard" } };
    assert.strictEqual(computeStanding(spec), "good");
  });

  it("returns `good` for a Working Draft", function () {
    const spec = {
      release: { status: "Working Draft" },
      nightly: { status: "Editor's Draft" }
    };
    assert.strictEqual(computeStanding(spec), "good");
  });

  it("returns `good` for a Recommendation", function () {
    const spec = {
      release: { status: "Recommendation" },
      nightly: { status: "Editor's Draft" }
    };
    assert.strictEqual(computeStanding(spec), "good");
  });

  it("returns `pending` for a Collection of Interesting Ideas", function () {
    const spec = { nightly: { status: "A Collection of Interesting Ideas" } };
    assert.strictEqual(computeStanding(spec), "pending");
  });

  it("returns `pending` for an Unofficial Proposal Draft", function () {
    const spec = { nightly: { status: "Unofficial Proposal Draft" } };
    assert.strictEqual(computeStanding(spec), "pending");
  });

  it("returns the standing that the spec says it has", function () {
    const spec = {
      standing: "good",
      nightly: { status: "Unofficial Proposal Draft" }
    };
    assert.strictEqual(computeStanding(spec), "good");
  });

  it("throws if spec object is empty", () => {
    assert.throws(
      () => computeStanding({}),
      /^Invalid spec object passed as parameter$/);
  });

  it("throws if spec object does not have a nightly.status property", () => {
    assert.throws(
      () => computeStanding({ url: "https://example.org/" }),
      /^Invalid spec object passed as parameter$/);
  });
});