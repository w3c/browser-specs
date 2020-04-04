/**
 * Module that exports a function that takes a spec object that already has a
 * "shortname", "series" and "level" properties (if needed) as input along with
 * a list of specs with the same info for each spec, and that returns an object
 * with "previousInSeries" and "nextInSeries" properties as needed, that point
 * to the "shortname" of the spec object that describes the previous and next
 * level for the spec in the list.
 */

/**
 * Exports main function that takes a spec object and a list of specs (which
 * may contain the spec object itself) and returns an object with properties
 * "previousInSeries" and/or "nextInSeries" set. Function only sets the
 * properties when needed, so returned object may be empty.
 */
module.exports = function (spec, list) {
  if (!spec || !spec.shortname || !spec.series || !spec.series.shortname) {
    throw "Invalid spec object passed as parameter";
  }

  list = list || [];
  const level = spec.seriesVersion || "0";

  return list
    .filter(s => s.series.shortname === spec.series.shortname)
    .sort((a, b) => (a.seriesVersion || "0").localeCompare(b.seriesVersion || "0"))
    .reduce((res, s) => {
      if ((s.seriesVersion || "0") < level) {
        // Previous level is the last spec with a lower level
        res.previousInSeries = s.shortname;
      }
      else if ((s.seriesVersion || "0") > level) {
        // Next level is the first spec with a greater level
        if (!res.nextInSeries) {
          res.nextInSeries = s.shortname;
        }
      }
      return res;
    }, {});
}