/**
 * Prepare the contents of the NPM packages
 *
 * NPM packages include browser-specs.
 * 
 * These packages contain a filtered view of the list of specs.
 * 
 * The script copies relevant files to the "packages" folders.
 *
 * node src/prepare-packages.js
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import util from 'node:util';
import { fileURLToPath } from 'node:url';
import loadJSON from './load-json.js';

const scriptPath = path.dirname(fileURLToPath(import.meta.url));

async function preparePackages() {
  console.log('Load index file');
  const index = await loadJSON(path.join(scriptPath, '..', 'index.json'));
  console.log(`- ${index.length} specs in index file`);

  const packages = [
    {
      name: 'web-specs',
      filter: spec => true
    },
    {
      name: 'browser-specs',
      filter: spec =>
        spec.categories?.includes('browser') &&
        spec.standing === 'good'
    }
  ];

  for (const { name, filter } of packages) {
    console.log();
    console.log(`Prepare the ${name} package`);

    // Only keep relevant specs targeted at browsers
    const specs = index.filter(filter);
    console.log(`- ${specs.length}/${index.length} specs to include in the package`);

    // Write packages/${name}/index.json
    await fs.writeFile(
      path.resolve(scriptPath, '..', 'packages', name, 'index.json'),
      JSON.stringify(specs, null, 2),
      'utf8');
    console.log(`- packages/${name}/index.json updated`);

    // Update README.md
    const commonReadme = await fs.readFile(path.resolve(scriptPath, '..', 'README.md'), 'utf8');
    const packageReadmeFile = path.resolve(scriptPath, '..', 'packages', name, 'README.md');
    let packageReadme = await fs.readFile(packageReadmeFile, 'utf8');
    const commonBlocks = [
      { start: '<!-- COMMON-TOC: start -->', end: '<!-- COMMON-TOC: end -->' },
      { start: '<!-- COMMON-BODY: start -->', end: '<!-- COMMON-BODY: end -->' }
    ];
    for (const { start, end } of commonBlocks) {
      const [commonStart, commonEnd] = [commonReadme.indexOf(start), commonReadme.indexOf(end)];
      const [packageStart, packageEnd] = [packageReadme.indexOf(start), packageReadme.indexOf(end)];
      const commonBlock = commonReadme.substring(commonStart, commonEnd);
      packageReadme = packageReadme.substring(0, packageStart) +
        commonBlock +
        packageReadme.substring(packageEnd);
    }
    await fs.writeFile(packageReadmeFile, packageReadme, 'utf8');
    console.log(`- packages/${name}/README.md updated`);
  }
}

/*******************************************************************************
Kick things off
*******************************************************************************/
preparePackages()
  .then(() => {
    console.log();
    console.log("== The end ==");
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });