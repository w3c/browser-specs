import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import puppeteer from "puppeteer";
import extractPages from "../src/extract-pages.js";

describe("extract-pages module", {timeout: 30000}, function () {
  // Long timeout since tests need to send network requests
  let browser;

  before(async () => {
    browser = await puppeteer.launch();
  });

  after(async () => {
    await browser.close();
  });

  it("extracts pages from the SVG2 spec", async () => {
    const url = "https://svgwg.org/svg2-draft/";
    const pages = await extractPages(url, browser);
    assert.ok(pages.length > 20);
  });

  it("extracts pages from the HTML spec", async () => {
    const url = "https://html.spec.whatwg.org/multipage/";
    const pages = await extractPages(url, browser);
    assert.ok(pages.length > 20);
  });

  it("extracts pages from the CSS 2.1 spec", async () => {
    const url = "https://www.w3.org/TR/CSS21/";
    const pages = await extractPages(url, browser);
    assert.ok(pages.length > 20);
  });

  it("does not include the index page as first page", async () => {
    const url = "https://svgwg.org/svg2-draft/"
    const pages = await extractPages(url, browser);
    assert.ok(!pages.find(page => page.url));
  });

  it("does not get lost when given a single-page ReSpec spec", async () => {
    const url = "https://w3c.github.io/presentation-api/";
    const pages = await extractPages(url, browser);
    assert.deepStrictEqual(pages, []);
  });

  it("does not get lost when given a single-page Bikeshed spec", async () => {
    const url = "https://w3c.github.io/mediasession/";
    const pages = await extractPages(url, browser);
    assert.deepStrictEqual(pages, []);
  });
});
