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

/**
 * Some Working Groups do not develop specifications directly targeted at
 * browsers. Specs from these Working Groups should not be flagged with a
 * "browsers" category. Ideally, we'd gather that information from some
 * authoritative source, but that information is not available, so let's
 * maintain a short list of working groups to catch main cases.
 *
 * Note: Closed groups may still need to appear in that list when specs they
 * developed are in browser-specs (for example, the Audiobooks Working Group)
 */
const nonBrowserGroups = [
  "Accessibility Guidelines Working Group",
  "Accessible Platform Architectures Working Group",
  "Advisory Board",
  "Audiobooks Working Group",
  "Data Shapes Working Group",
  "Dataset Exchange Working Group",
  "Decentralized Identifier Working Group",
  "Distributed Tracing Working Group",
  "JSON-LD Working Group",
  "Linked Web Storage Working Group",
  "MiniApps Working Group",
  "Patents and Standards Interest Group",
  "Publishing Maintenance Working Group",
  "RDF Dataset Canonicalization and Hash Working Group",
  "RDF-star Working Group",
  "Spatio-temporal Data on the Web Working Group",
  "Technical Architecture Group",
  "Verifiable Credentials Working Group",
  "Web of Things Working Group"
];


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
export default function (spec) {
  if (!spec || !spec.groups) {
    throw "Invalid spec object passed as parameter";
  }

  let list = [];
  const requestedCategories = (typeof spec.categories === "string") ?
    [spec.categories] :
    (spec.categories || []);

  // All specs target browsers by default unless the spec object says otherwise
  if (!requestedCategories.includes("reset")) {
    const browserGroup = spec.groups.find(group => !nonBrowserGroups.includes(group.name));
    if (browserGroup) {
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