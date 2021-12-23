/**
 * Module that exports a function that takes a title as input and returns a
 * meaningful short title out of it, or the full title if it cannot be
 * abbreviated.
 *
 * For instance, given "CSS Conditional Rules Module Level 3" as a title, the
 * function would return "CSS Conditional 3"
 */


/**
 * Internal function that takes a URL as input and returns a name for it
 * if the URL matches well-known patterns, or if the given parameter is actually
 * already a name (meaning that it does not contains any "/").
 *
 * The function throws if it cannot compute a meaningful name from the URL.
 */
module.exports = function (title) {
  if (!title) {
    return title;
  }

  // Handle HTTP/1.1 specs separately to preserve feature name after "HTTP/1.1"
  const httpStart = 'Hypertext Transfer Protocol (HTTP/1.1): ';
  if (title.startsWith(httpStart)) {
    return 'HTTP/1.1 ' + title.substring(httpStart.length);
  }

  const level = title.match(/\s(\d+(\.\d+)?)$/);
  const shortTitle = title
    .replace(/\s/g, ' ')                // Replace non-breaking spaces
    .replace(/ \d+(\.\d+)?$/, '')       // Drop level number for now
    .replace(/( -)? Level$/, '')        // Drop "Level"
    .replace(/ Module$/, '')            // Drop "Module" (now followed by level)
    .replace(/ Proposal$/, '')          // Drop "Proposal" (TC39 proposals)
    .replace(/ Specification$/, '')     // Drop "Specification"
    .replace(/ Standard$/, '')          // Drop "Standard" and "Living Standard"
    .replace(/ Living$/, '')
    .replace(/ \([^\)]+ Edition\)/, '') // Drop edition indication
    .replace(/^.*\(([^\)]+)\).*$/, '$1'); // Use abbr between parentheses

  if (level) {
    return shortTitle + " " + level[1];
  }
  else {
    return shortTitle;
  }
};
