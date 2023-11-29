const assert = require("assert");
const computeShortTitle = require("../src/compute-shorttitle.js");

describe("compute-shorttitle module", () => {
  function assertTitle(title, expected) {
    const shortTitle = computeShortTitle(title);
    assert.equal(shortTitle, expected);
  }

  it("finds abbreviation for main CSS spec", () => {
    assertTitle(
      "Cascading Style Sheets Level 2 Revision 1 (CSS 2.1) Specification",
      "CSS 2.1");
  });

  it("does not choke on non-breaking spaces", () => {
    assertTitle(
      "CSS Backgrounds and Borders Module Level\u00A04",
      "CSS Backgrounds and Borders 4");
  });

  it("does not choke on levels that are not levels", () => {
    assertTitle(
      "CORS and RFC1918",
      "CORS and RFC1918");
  });

  it("finds abbreviation for WAI-ARIA title", () => {
    assertTitle(
      "Accessible Rich Internet Applications (WAI-ARIA) 1.2",
      "WAI-ARIA 1.2");
  });

  it("drops 'Level' from title but keeps level number", () => {
    assertTitle(
      "CSS Foo Level 42",
      "CSS Foo 42");
  });

  it("drops 'Module' from title but keeps level number", () => {
    assertTitle(
      "CSS Foo Module Level 42",
      "CSS Foo 42");
  });

  it("drops '- Level' from title", () => {
    assertTitle(
      "Foo - Level 2",
      "Foo 2");
  });

  it("drops 'Module - Level' from title", () => {
    assertTitle(
      "Foo Module - Level 3",
      "Foo 3");
  });

  it("drops 'Specification' from end of title", () => {
    assertTitle(
      "Foo Specification",
      "Foo");
  });

  it("drops 'Standard' from end of title", () => {
    assertTitle(
      "Foo Standard",
      "Foo");
  });

  it("drops 'Living Standard' from end of title", () => {
    assertTitle(
      "Foo Living Standard",
      "Foo");
  });

  it("drops edition indications", () => {
    assertTitle(
      "Foo (Second Edition) Bar",
      "Foo Bar");
  });

  it("drops '(Draft)' from title", () => {
    assertTitle(
      "(Draft) Beer",
      "Beer");
  });

  it("preserves title when needed", () => {
    assertTitle(
      "Edition Module Standard Foo",
      "Edition Module Standard Foo");
  });

  it("drops 'Proposal' from end of title", () => {
    assertTitle(
      "Hello world API Proposal",
      "Hello world API");
  });

  it("preserves scope in HTTP/1.1 spec titles", () => {
    assertTitle(
      "Hypertext Transfer Protocol (HTTP/1.1): Foo bar",
      "HTTP/1.1 Foo bar")
  });

  it("applies rules in order", () => {
    assertTitle(
      " AOMedia Film Grain Synthesis (v1.0) (AFGS1) specification (Draft) ",
      "AFGS1")
  });
});
