/**
 * Module that exports a function that takes a spec object and a list of specs
 * that contains it, and that returns an object with a "currentSpecification"
 * property set to the "shortname" of the spec object that should be seen as
 * the current level for the set of specs with the same series' shortname in
 * the list.
 *
 * Each spec in the list must have "shortname", "series" and "seriesVersion"
 * (if needed) properties.
 *
 * By default, the current level is defined as the last level that is not a
 * delta/fork spec, unless a level is explicitly flagged with a "forceCurrent"
 * property in the list of specs.
 */

/**
 * Exports main function that takes a spec object and a list of specs (which
 * must contain the spec object itself) and returns an object with a
 * "currentSpecification" property. Function always sets the property (value is
 * the name of the spec itself when it is the current level)
 */
module.exports = function (spec, list) {
  list = list || [];
  if (!spec) {
    throw "Invalid spec object passed as parameter";
  }

  const current = list.reduce((candidate, curr) => {
    if (curr.series.shortname === candidate.series.shortname &&
        !candidate.forceCurrent &&
        curr.seriesComposition !== "fork" &&
        curr.seriesComposition !== "delta" &&
        (curr.forceCurrent ||
          candidate.seriesComposition === "delta" ||
          candidate.seriesComposition === "fork" ||
          (curr.seriesVersion || "0") > (candidate.seriesVersion || "0"))) {
      return curr;
    }
    else {
      return candidate;
    }
  }, spec);
  
  return {
    currentSpecification: current.shortname,
    forceCurrent: current.forceCurrent
  };
};