"use strict";

const fs = require("fs").promises;

// Lint by normalizing specs.json and comparing it to the original,
// fixing it in place if |fix| is true.
async function lint(fix = false) {
  const specsBuffer = await fs.readFile("./specs.json");
  const specs = JSON.parse(specsBuffer);

  const sorted = specs
    .map(spec => (typeof spec === "string") ? { url: spec } : spec)
    .map(spec => Object.assign({}, spec, { url: new URL(spec.url).toString() }));
  sorted.sort((a, b) => a.url.localeCompare(b.url));

  // Prefer URL-only format when we only have a URL
  const fixed = sorted
    .map(spec => (Object.keys(spec).length > 1) ? spec : spec.url);

  const fixedBuffer = Buffer.from(JSON.stringify(fixed, null, "  ") + "\n");
  if (!specsBuffer.equals(fixedBuffer)) {
    if (fix) {
      console.log("specs.json has lint issues, updating in place");
      await fs.writeFile("./specs.json", fixedBuffer);
    } else {
      console.log("specs.json has lint issues, run with --fix");
    }
    return false;
  }

  console.log("specs.json passed lint");
  return true;
}

lint(process.argv.includes("--fix")).then(
  ok => {
    process.exit(ok ? 0 : 1);
  },
  reason => {
    console.error(reason);
    process.exit(1);
  }
);
