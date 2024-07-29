"use strict";

import specs from "./index.json" with { type: "json" };
import { fileURLToPath } from 'node:url';
import process from 'node:process';


/**
 * Return the list of specs that match the specified filter.
 *
 * - If the filter is an integer, return the spec at that index in the list
 * - If the filter is full or delta, return specs with same level composition
 * - If the filter is empty, return the whole list
 * - return specs that have the same URL, name, shortname, or source otherwise
 */
function getSpecs(filter) {
  if (filter) {
    const res = filter.match(/^\d+$/) ?
      [specs[parseInt(filter, 10)]] :
      specs.filter(s =>
        s.url === filter ||
        s.name === filter ||
        s.seriesComposition === filter ||
        s.source === filter ||
        s.title === filter ||
        (s.series && s.series.shortname === filter) ||
        (s.release && s.release.url === filter) ||
        (s.nightly && s.nightly.url === filter));
    return res;
  }
  else {
    return specs;
  }
}

export { getSpecs };

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // Code used as command-line interface (CLI), output info about known specs.
  const res = getSpecs(process.argv[2]);
  console.log(JSON.stringify(res.length === 1 ? res[0] : res, null, 2));
}
