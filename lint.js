"use strict";

const fs = require("fs").promises;

// Lint by normalizing specs.json and comparing it to the original,
// fixing it in place if |fix| is true.
async function lint(fix = false) {
  const specsBuffer = await fs.readFile("./specs.json");
  let specs = JSON.parse(specsBuffer);

  const fixed = specs.map(spec => {
    const url = new URL(spec.url).toString();
    return { url };
  });
  fixed.sort((a, b) => {
    a.url.localeCompare(b.url);
  });

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
