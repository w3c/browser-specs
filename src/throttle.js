/**
 * Provides a throttling wrapper to a function
 */

module.exports = function (fn, max) {
  let ongoing = 0;
  const pending = [];

  return async function throttled(...args) {
    if (ongoing >= max) {
      // Too many tasks in parallel, need to throttle
      return new Promise((resolve, reject) => {
        pending.push({ params: [...args], resolve, reject });
      });
    }
    else {
      // Task can run immediately
      ongoing += 1;
      const res = await fn.call(null, ...args);
      ongoing -= 1;

      // Done with current task, trigger next pending task in the background
      setTimeout(() => {
        if (pending.length && ongoing < max) {
          const next = pending.shift();
          throttled.apply(null, next.params)
            .then(res => next.resolve(res))
            .catch(err => next.reject(err));
        }
      }, 0);

      return res;
    }
  };
}
