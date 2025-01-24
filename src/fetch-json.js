import ThrottledQueue from "./throttled-queue.js";

// Make sure we remain "friendly" with servers
const fetchQueue = new ThrottledQueue({ maxParallel: 2 });

// Maintain a cache of fetched JSON resources in memory to avoid sending the
// same fetch request again and again
const cache = {};

/**
 * Fetch a JSON URL
 */
export default async function (url, options) {
  if (cache[url]) {
    return structuredClone(cache[url]);
  }
  const res = await fetchQueue.runThrottled(fetch, url, options);
  if (res.status === 404) {
    return null;
  }
  if (res.status !== 200) {
    throw new Error(`Server returned an error for ${url}, status code is ${res.status}`);
  }

  try {
    const body = await res.json();
    cache[url] = body;
    return structuredClone(body);
  }
  catch (err) {
    throw new Error(`Server returned invalid JSON for ${url}`);
  }
}
