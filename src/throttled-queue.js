/**
 * Helper function to sleep for a specified number of milliseconds
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms, 'slept'));
}


/**
 * Helper function that returns the "origin" of a URL, defined in a loose way
 * as the part of the true origin that identifies the server that's going to
 * serve the resource.
 *
 * For example "github.io" for all specs under github.io, "whatwg.org" for
 * all WHATWG specs, "csswg.org" for CSS specs at large (including Houdini
 * and FXTF specs since they are served by the same server).
 */
function getOrigin(url) {
    if (!url) {
        return '';
    }
    const origin = (new URL(url)).origin;
    if (origin.endsWith('.whatwg.org')) {
        return 'whatwg.org';
    }
    else if (origin.endsWith('.github.io')) {
        return 'github.io';
    }
    else if (origin.endsWith('.csswg.org') ||
             origin.endsWith('.css-houdini.org') ||
             origin.endsWith('.fxtf.org')) {
        return 'csswg.org';
    }
    else {
        return origin;
    }
}


/**
 * The ThrottledQueue class can be used to run a series of tasks that send
 * network requests to an origin server in parallel, up to a certain limit,
 * while guaranteeing that only one request will be sent to a given origin
 * server at a time.
 */
module.exports = class ThrottledQueue {
  originQueue = {};
  maxParallel = 4;
  ongoing = 0;
  pending = [];

  constructor(maxParallel) {
    if (maxParallel >= 0) {
      this.maxPar = maxParallel;
    }
  }

  /**
   * Run the given processing function with the given parameters, immediately
   * if possible or as soon as possible when too many tasks are already running
   * in parallel.
   *
   * Note this function has no notion of origin. Users may call the function
   * directly if they don't need any throttling per origin.
   */
  async runThrottled(processFunction, ...params) {
    if (this.ongoing >= this.maxParallel) {
      return new Promise((resolve, reject) => {
        this.pending.push({ params, resolve, reject });
      });
    }
    else {
      this.ongoing += 1;
      const result = await processFunction.call(null, ...params);
      this.ongoing -= 1;

      // Done with current task, trigger next pending task in the background
      setTimeout(_ => {
        if (this.pending.length && this.ongoing < this.maxParallel) {
          const next = this.pending.shift();
          this.runThrottled(processFunction, ...next.params)
            .then(result => next.resolve(result))
            .catch(err => next.reject(err));
        }
      }, 0);

      return result;
    }
  }

  /**
   * Run the given processing function with the given parameters, immediately
   * if possible or as soon as possible when too many tasks are already running
   * in parallel, or when there's already a task being run against the same
   * origin as that of the provided URL.
   *
   * Said differently, the function serializes tasks per origin, and calls
   * "runThrottled" to restrict the number of tasks that run in parallel to the
   * requested maximum.
   *
   * Additionally, the function forces a 2 second sleep after processing to
   * keep a low network profile.
   */
  async runThrottledPerOrigin(url, processFunction, ...params) {
    const origin = getOrigin(url);
    if (!this.originQueue[origin]) {
      this.originQueue[origin] = Promise.resolve(true);
    }
    return new Promise((resolve, reject) => {
      this.originQueue[origin] = this.originQueue[origin]
        .then(async _ => this.runThrottled(processFunction, ...params))
        .then(async result => {
          await sleep(2000);
          return result;
        })
        .then(resolve)
        .catch(reject);
    });
  }
}
