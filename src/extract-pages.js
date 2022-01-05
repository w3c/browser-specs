/**
 * Module that exports a function that takes the URL of the index page of a
 * multi-page spec as input and that returns the list of pages referenced in
 * the table of contents, in document order, excluding the index page.
 */

const { JSDOM } = require("jsdom");

module.exports = async function (url) {
  try {
    const dom = await JSDOM.fromURL(url);
    const window = dom.window;
    const document = window.document;

    const allPages = [...document.querySelectorAll('.toc a[href]')]
      .map(link => link.href)
      .map(url => url.split('#')[0])
      .filter(url => url !== window.location.href);
    const pageSet = new Set(allPages);
    return [...pageSet];
  }
  catch (err) {
    throw new Error(`Could not extract pages from ${url} with JSDOM: ${err.message}`);
  }
};