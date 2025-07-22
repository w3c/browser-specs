/**
 * Module that exports a function that takes an array of specifications objects
 * that each have at least a "url" property. The function completes
 * specification objects that target ISO specifications with title,
 * organization and group info from the ISO Open Data catalog:
 * https://www.iso.org/open-data.html
 *
 * Having to download ~100MB of data for a fairly restricted number of ISO
 * specifications in browser-specs that will hardly ever change is not
 * fantastic. But ISO has put several restrictions in place that make fetching
 * individual pages harder with a bot.
 *
 * To avoid wasting time and resources, function may be called with a
 * "skipFetch" option. When set to "iso" or "all", code skips fetch and reuses
 * previous data instead. The expectation is that this option will be set for
 * most automated builds.
 */

async function fetchInfoFromISO(specs, options) {
  if (!specs || specs.find(spec => !spec.url)) {
    throw "Invalid list of specifications passed as parameter";
  }

  const isoRe = /\.iso\.org\//;
  const isoSpecs = specs.filter(spec => spec.url.match(isoRe));
  if (isoSpecs.length === 0) {
    return specs;
  }

  if (!['all', 'iso'].includes(options?.skipFetch)) {
    // Fetch the list of technical committees
    const tcUrl = 'https://isopublicstorageprod.blob.core.windows.net/opendata/_latest/iso_technical_committees/json/iso_technical_committees.jsonl';
    const tcResponse = await fetch(tcUrl, options);
    const tc = (await tcResponse.text()).split('\n')
      .map(line => line ? JSON.parse(line) : {});

    // Fetch the ISO catalog
    // TODO: read lines one by one instead of reading the entire body at once
    const catalogUrl = `https://isopublicstorageprod.blob.core.windows.net/opendata/_latest/iso_deliverables_metadata/json/iso_deliverables_metadata.jsonl`;
    const catalogResponse = await fetch(catalogUrl, options);
    const catalog = (await catalogResponse.text()).split('\n');

    for (const line of catalog) {
      if (!line) {
        continue;
      }
      const json = JSON.parse(line);
      const spec = isoSpecs.find(s => s.url.endsWith(`/${json.id}.html`));
      if (!spec) {
        continue;
      }
      const group = tc.find(c => c.reference === json.ownerCommittee);
      if (!group) {
        throw new Error(`Inconsistent information in catalog, could not find group "${json.ownerCommittee}"`);
      }
      
      // Let's compute a nice shortname using the reference number,
      // e.g., iso10918-5, excluding the release year if it exists.
      const match = json.reference.match(/ ([\d\-]+)(:\d+)?$/);
      if (!match) {
        throw new Error(`Could not extract ISO shortname from reference "${json.reference}"`);
      }
      const shortname = 'iso' + match[1];

      spec.__iso = {
        shortname,
        series: { shortname },
        organization: json.ownerCommittee.startsWith('ISO/IEC') ? 'ISO/IEC' : 'ISO',
        groups: [{
          name: group.reference,
          url: `https://www.iso.org/committee/${group.id}.html`
        }],
        title: json.title.en,
        source: 'iso'
      };
    }
  }

  return specs.map(spec => {
    if (spec.url.match(isoRe) && (spec.__iso || spec.__last)) {
      const isoInfo = spec.__iso;
      delete spec.__iso;
      const copy = Object.assign({}, spec, {
        shortname: isoInfo?.shortname ?? spec.__last?.shortname,
        organization: isoInfo?.organization ?? spec.__last?.organization,
        groups: isoInfo?.groups ?? spec.__last?.groups,
        title: isoInfo?.title ?? spec.__last?.title,
        source: isoInfo?.source ?? spec.__last?.source ?? spec.source
      });
      if (!copy.series) {
        copy.series = {};
      }
      copy.series.shortname = isoInfo?.series.shortname ?? spec.__last?.series.shortname;
      return copy;
    }
    else {
      return spec;
    }
  });
}

export default fetchInfoFromISO;
