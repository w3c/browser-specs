/**
 * Tests for the fetch-info module
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import fetchInfoFromISO from "../src/fetch-iso-info.js";

import { MockAgent, setGlobalDispatcher, getGlobalDispatcher } from 'undici';

const tcResponse = `
{"id":48148,"reference":"ISO/TC 38"}
{"id":45316,"reference":"ISO/IEC JTC 1/SC 29"}
`;

const catalogResponse = `
{"id":54989,"deliverableType":"IS","supplementType":null,"reference":"ISO/IEC 10918-5:2013","title":{"en":"Information technology — Digital compression and coding of continuous-tone still images: JPEG File Interchange Format (JFIF) — Part 5:","fr":"Technologies de l'information — Compression numérique et codage des images fixes à modelé continu: Format d'échange de fichiers JPEG (JFIF) — Partie 5:"},"publicationDate":"2013-04-26","edition":1,"icsCode":["35.040.30"],"ownerCommittee":"ISO/IEC JTC 1/SC 29","currentStage":9060,"replaces":null,"replacedBy":null,"languages":["en"],"pages":{"en":9},"scope":{"en":"<p>ISO/IEC 10918-5:2013 specifies the JPEG File Interchange Format (JFIF).</p>\\n"}}
{"id":61292,"deliverableType":"IS","supplementType":null,"reference":"ISO 18074:2015","title":{"en":"Textiles — Identification of some animal fibres by DNA analysis method — Cashmere, wool, yak and their blends","fr":"Textiles — Identification de certaines fibres animales par la méthode d'analyse de l'ADN — Cachemire, laine, yack et leurs mélanges"},"publicationDate":"2015-11-19","edition":1,"icsCode":["59.080.01"],"ownerCommittee":"ISO/TC 38","currentStage":9093,"replaces":null,"replacedBy":null,"languages":["en","fr"],"pages":{"en":22},"scope":{"en":"<p>ISO 18074:2015 specifies a testing method for DNA analysis of some animal fibres to identify cashmere, wool, yak, and their blends by using extraction, amplification by the polymerase chain reaction (PCR) method and DNA detection processes.</p>\\n<p>ISO 18084:2015 is applicable to cashmere, yak, and wool and their blends as a qualitative method.</p>\\n\\n"}}
`;

describe("The ISO catalog module", async function () {
  // Long time out since tests need to send network requests
  const timeout = {
    timeout: 60000
  };

  let defaultDispatcher = getGlobalDispatcher();
  let mockAgent = new MockAgent();

  function initIntercepts() {
    const mockPool = mockAgent
      .get("https://isopublicstorageprod.blob.core.windows.net");
    mockPool
      .intercept({ path: "/opendata/_latest/iso_technical_committees/json/iso_technical_committees.jsonl" })
      .reply(200, tcResponse);
    mockPool
      .intercept({ path: "/opendata/_latest/iso_deliverables_metadata/json/iso_deliverables_metadata.jsonl" })
      .reply(200, catalogResponse);
  }

  before(() => {
    setGlobalDispatcher(mockAgent);
    mockAgent.disableNetConnect();
  });

  after(() => {
    setGlobalDispatcher(defaultDispatcher);
  })

  it("extracts spec info for an ISO spec", timeout, async () => {
    initIntercepts();
    const spec = { url: "https://www.iso.org/standard/61292.html" };
    const specs = await fetchInfoFromISO([spec]);
    assert.ok(specs[0]);
    assert.equal(specs[0].shortname, "iso18074");
    assert.equal(specs[0].series?.shortname, "iso18074");
    assert.equal(specs[0].source, "iso");
    assert.equal(specs[0].title, "Textiles — Identification of some animal fibres by DNA analysis method — Cashmere, wool, yak and their blends");
    assert.equal(specs[0].organization, "ISO");
    assert.equal(specs[0].groups[0].url, "https://www.iso.org/committee/48148.html");
    assert.equal(specs[0].groups[0].name, "ISO/TC 38");
    assert.equal(specs[0].nightly, undefined);
  });

  it("extracts spec info for an ISO/IEC spec", timeout, async () => {
    initIntercepts();
    const spec = { url: "https://www.iso.org/standard/54989.html" };
    const specs = await fetchInfoFromISO([spec]);
    assert.ok(specs[0]);
    assert.equal(specs[0].shortname, "iso10918-5");
    assert.equal(specs[0].series?.shortname, "iso10918-5");
    assert.equal(specs[0].source, "iso");
    assert.equal(specs[0].title, "Information technology — Digital compression and coding of continuous-tone still images: JPEG File Interchange Format (JFIF) — Part 5:");
    assert.equal(specs[0].organization, "ISO/IEC");
    assert.equal(specs[0].groups[0].url, "https://www.iso.org/committee/45316.html");
    assert.equal(specs[0].groups[0].name, "ISO/IEC JTC 1/SC 29");
    assert.equal(specs[0].nightly, undefined);
  });

  it("skips fetch in the absence of specs from ISO", timeout, async () => {
    // Note: as we don't call initIntercepts(), mock agent will throw if
    // code attempts to fetch something from the network
    const spec = { url: "https://www.w3.org/TR/from-w3c-with-love/" };
    const specs = await fetchInfoFromISO([spec]);
    assert.ok(specs[0]);
  });

  it("skips fetch when asked", timeout, async () => {
    // Note: as we don't call initIntercepts(), mock agent will throw if
    // code attempts to fetch something from the network.
    const spec = { url: "https://www.iso.org/standard/54989.html" };
    const specs = await fetchInfoFromISO([spec], { skipFetch: 'iso' });
    assert.ok(specs[0]);
  });
});
