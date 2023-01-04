/**
 * Module that exports a function that takes a spec object that already has its
 * `groups` property (see `fetch-groups.js`) and its `nightly.repository`
 * property (see `compute-repository.js`) set as input, and that returns
 * a list of categories for the spec.
 *
 * Note (2022-02-08): The function merely sets `browser` for now. Logic (and
 * initial spec properties used to compute the list) will likely be adjusted
 * over time.
 */

// Retrieve the list of groups and repositories that we know don't contain
// specs targeted at browsers. That logic will also very likely evolve over
// time, be it only to give the file a different name (the list of specs will
// be expanded to contain specs in that "ignore" list)
const { groups: nonbrowserGroups, repos: nonbrowserRepos } = require('./data/ignore.json');

/**
 * Exports main function that takes a spec object and returns a list of
 * categories for the spec.
 *
 * Function may return an empty array. If the spec object contains a
 * `categories` property, the list of categories is adjusted accordingly. For
 * instance, if the spec object contains `+browser`, `browser` is added to the
 * list. If it contains `-browser`, `browser` won't appear in the list. If it
 * contains `reset`, the function does not attempt to compute a list but rather
 * returns the list of categories in the spec object.
 */
module.exports = function (spec) {
  if (!spec || !spec.groups) {
    throw "Invalid spec object passed as parameter";
  }

  let list = [];
  const requestedCategories = (typeof spec.categories === "string") ?
    [spec.categories] :
    (spec.categories || []);

  // All specs target browsers by default unless the spec object says otherwise
  if (!requestedCategories.includes("reset")) {
    const browserGroup = spec.groups.find(group => !nonbrowserGroups[group.name]);
    const browserRepo = !spec.nightly?.repository ||
        !nonbrowserRepos[spec.nightly.repository.replace(/^https:\/\/github\.com\//, "")];
    if (browserGroup && browserRepo) {
      list.push("browser");
    }
  }

  // Apply requested incremental updates
  requestedCategories.filter(incr => (incr !== "reset")).forEach(incr => {
    const category = incr.substring(1);
    if (incr.startsWith("+")) {
      list.push(category);
    }
    else {
      list = list.filter(cat => cat !== category);
    }
  });

  return list;
}