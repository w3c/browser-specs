import { describe, it } from "node:test";
import assert from "node:assert";
import computeStanding from "../src/compute-standing.js";

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

  it("returns `discontinued` for an Discontinued Draft", function () {
    const spec = { nightly: { status: "Discontinued Draft" } };
    assert.strictEqual(computeStanding(spec), "discontinued");
  });

  it("returns `good` for an ISO spec", function () {
    const spec = { url: "https://www.iso.org/standard/85253.html" };
    assert.strictEqual(computeStanding(spec), "good");
  });

  it("returns the standing that the spec says it has", function () {
    const spec = {
      standing: "good",
      nightly: { status: "Unofficial Proposal Draft" }
    };
    assert.strictEqual(computeStanding(spec), "good");
  });
});
