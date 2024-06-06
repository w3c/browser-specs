/**
 * Loads a spec into a Puppeteer page, avoiding fetching resources that are not
 * useful for our needs (images, streams) and that, once in a while, tend to
 * cause timeout issues on CSS servers.
 */

module.exports = async function (url, page) {
  // Inner function that returns a network interception method for Puppeteer,
  // to avoid downloading images and getting stuck on streams.
  // NB: this is a simplified version of the code used in Reffy:
  // https://github.com/w3c/reffy/blob/25bb1be05be63cae399d2648ecb1a5ea5ab8430a/src/lib/util.js#L351
  function interceptRequest(cdp) {
    return async function ({ requestId, request }) {
      try {
        // Abort network requests to common image formats
        if (/\.(gif|ico|jpg|jpeg|png|ttf|woff|svg)$/i.test(request.url)) {
          await cdp.send('Fetch.failRequest', { requestId, errorReason: 'Failed' });
          return;
        }

        // Abort network requests that return a "stream", they don't
        // play well with Puppeteer's "networkidle0" option
        if (request.url.startsWith('https://drafts.csswg.org/api/drafts/') ||
            request.url.startsWith('https://drafts.css-houdini.org/api/drafts/') ||
            request.url.startsWith('https://drafts.fxtf.org/api/drafts/') ||
            request.url.startsWith('https://api.csswg.org/shepherd/') ||
            request.url.startsWith('https://test.csswg.org/harness/')) {
          await cdp.send('Fetch.failRequest', { requestId, errorReason: 'Failed' });
          return;
        }

        // Proceed with the network request otherwise
        await cdp.send('Fetch.continueRequest', { requestId });
      }
      catch (err) {
        console.warn(`[warn] Network request to ${request.url} failed`, err);
      }
    }
  }

  // Intercept network requests to avoid downloading images and streams
  const cdp = await page.target().createCDPSession();

  try {
    await cdp.send('Fetch.enable');
    cdp.on('Fetch.requestPaused', interceptRequest(cdp));

    const response = await page.goto(url, { timeout: 120000, waitUntil: 'networkidle0' });

    if (response.status() !== 200) {
      throw new Error(`Fetching ${url} failed with HTTP code ${response.status()}`);
    }
    // Wait until the generation of the spec is completely over
    // (same code as in Reffy, except Reffy forces the latest version of
    // Respec and thus does not need to deal with older specs that rely
    // on a version that sets `respecIsReady` and not `respec.ready`.
    await page.evaluate(async () => {
      const usesRespec =
        (window.respecConfig || window.eval('typeof respecConfig !== "undefined"')) &&
        window.document.head.querySelector("script[src*='respec']");

      function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms, 'slept'));
      }

      async function isReady(counter) {
        counter = counter || 0;
        if (counter > 60) {
          throw new Error(`Respec generation took too long for ${window.location.toString()}`);
        }
        if (document.respec?.ready || document.respecIsReady) {
          // Wait for resolution of ready promise
          const res = await Promise.race([document.respec?.ready ?? document.respecIsReady, sleep(60000)]);
          if (res === 'slept') {
            throw new Error(`Respec generation took too long for ${window.location.toString()}`);
          }
        }
        else if (usesRespec) {
          await sleep(1000);
          await isReady(counter + 1);
        }
      }

      await isReady();
    });

    return page;
  }
  finally {
    await cdp.detach();
  }
}
