/**
 * Module that exports a function that takes a spec object that already has a
 * "name", "shortname" and "level" properties (if needed) as input along with a
 * list of specs with the same info for each spec, and that returns an object
 * with "previousLevel" and "nextLevel" properties as needed, that point to the
 * "name" of the spec object that describes the previous and next level for the
 * spec in the list.
 */

/**
 * Exports main function that takes a spec object and a list of specs (which
 * may contain the spec object itself) and returns an object with properties
 * "previousLevel" and/or "nextLevel" set. Function only sets the properties
 * when needed, so returned object may be empty.
 */
module.exports = function (spec, list) {
  if (!spec || !spec.name || !spec.shortname) {
    throw "Invalid spec object passed as parameter";
  }

  list = list || [];
  const level = spec.level || 0;

  return list
    .filter(s => s.shortname === spec.shortname)
    .sort((a, b) => (a.level || 0) - (b.level || 0))
    .reduce((res, s) => {
      if ((s.level || 0) < level) {
        // Previous level is the last spec with a lower level
        res.previousLevel = s.name;
      }
      else if ((s.level || 0) > level) {
        // Next level is the first spec with a greater level
        if (!res.nextLevel) {
          res.nextLevel = s.name;
        }
      }
      return res;
    }, {});
}