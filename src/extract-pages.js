/**
 * Module that exports a function that takes the URL of the index page of a
 * multi-page spec as input and that returns the list of pages referenced in
 * the table of contents, in document order, excluding the index page.
 */

module.exports = async function (url, browser) {
  const page = await browser.newPage();
  try {
    await page.goto(url);
    const allPages = await page.evaluate(_ =>
      [...document.querySelectorAll('.toc a[href]')]
        .map(link => link.href)
        .map(url => url.split('#')[0])
        .filter(url => url !== window.location.href)
    );
    const pageSet = new Set(allPages);
    return [...pageSet];
  }
  catch (err) {
    throw new Error(`Could not extract pages from ${url}: ${err.message}`);
  }
  finally {
    await page.close();
  }
};