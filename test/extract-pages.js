const assert = require("assert");
const extractPages = require("../src/extract-pages.js");

describe("extract-pages module", function () {
  // Tests need to send network requests
  this.slow(5000);
  this.timeout(30000);

  it("extracts pages from the SVG2 spec", async () => {
    const url = "https://svgwg.org/svg2-draft/"
    const pages = await extractPages(url);
    assert.ok(pages.length > 20);
  });

  it("extracts pages from the HTML spec", async () => {
    const url = "https://html.spec.whatwg.org/multipage/";
    const pages = await extractPages(url);
    assert.ok(pages.length > 20);
  });

  it("extracts pages from the CSS 2.2 spec", async () => {
    const url = "https://drafts.csswg.org/css2/";
    const pages = await extractPages(url);
    assert.ok(pages.length > 20);
  });

  it("does not include the index page as first page", async () => {
    const url = "https://svgwg.org/svg2-draft/"
    const pages = await extractPages(url);
    assert.ok(!pages.find(page => page.url));
  });

  it("does not get lost when given a single-page ReSpec spec", async () => {
    const url = "https://w3c.github.io/presentation-api/";
    const pages = await extractPages(url);
    assert.deepStrictEqual(pages, []);
  });

  it("does not get lost when given a single-page Bikeshed spec", async () => {
    const url = "https://w3c.github.io/mediasession/";
    const pages = await extractPages(url);
    assert.deepStrictEqual(pages, []);
  });
});
