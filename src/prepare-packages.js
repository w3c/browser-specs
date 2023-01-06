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

const fs = require('fs').promises;
const path = require('path');
const util = require('util');

async function preparePackages() {
  console.log('Load index file');
  const index = require(path.join('..', 'index.json'));
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
      path.resolve(__dirname, '..', 'packages', name, 'index.json'),
      JSON.stringify(specs, null, 2),
      'utf8');
    console.log(`- packages/${name}/index.json updated`);

    // Update README.md
    const commonReadme = await fs.readFile(path.resolve(__dirname, '..', 'README.md'), 'utf8');
    const packageReadmeFile = path.resolve(__dirname, '..', 'packages', name, 'README.md');
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