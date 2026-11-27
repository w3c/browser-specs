/**
 * Wrapper around the fetch module to identify the crawler with a specific
 * User-Agent, both not to hide that we're sending fetch requests as part of an
 * automated workflow, and because some servers may maintain dedicated rules to
 * allow our little crawling requests.
 * 
 * Note: To keep things simple for people maintaining these servers, we're
 * going to use the same User-Agent string as in Reffy, the "real" crawler.
 */

import packageConfig from '../package.json' with { type: 'json' };
const reffyVersion = packageConfig.devDependencies.reffy.replace('^', '');
const userAgent = `Reffy/${reffyVersion}`;

/**
 * Fetch function that adds a User-Agent string to identify requests as coming
 * from Reffy.
 *
 * @function
 * @param {String} url URL to fetch
 * @param {Object} options Fetch options
 * @return {Promise(Response)} Promise to get an HTTP response
 */
async function crawlFetch(url, options) {
  options = Object.assign({headers: {}}, options);
  options.headers['User-Agent'] = userAgent;
  return fetch(url, options);
}

export {
  crawlFetch as fetch,
  userAgent
}