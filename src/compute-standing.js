/**
 * Module that exports a function that takes a spec object that already has its
 * `nightly.status` (and `release.status` for released specs) properties set as
 * input, and that returns the "standing" of the spec.
 *
 * Note (2023-01-06): The definition of "standing" remains fuzzy and this
 * property should be regarded as unstable.
 */

// List of spec statuses that are not "official" ones, in the sense that the
// specs have not been officially adopted by a group as a deliverable.
const unofficialStatuses = [
  "A Collection of Interesting Ideas",
  "Unofficial Proposal Draft"
];


/**
 * Exports main function that takes a spec object and returns the standing of
 * the spec.
 */
module.exports = function (spec) {
  if (!spec || !spec.nightly?.status) {
    throw "Invalid spec object passed as parameter";
  }

  // If spec is already explicit about its standing, who are we to disagree?
  if (spec.standing) {
    return spec.standing;
  }

  const status = spec.release?.status ?? spec.nightly.status;
  if (status === "Discontinued Draft") {
    return "discontinued";
  }
  else {
    return unofficialStatuses.includes(status) ? "pending" : "good";
  }
}