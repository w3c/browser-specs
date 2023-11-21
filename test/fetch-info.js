/**
 * Tests for the fetch-info module
 */

const assert = require("assert");
const fetchInfo = require("../src/fetch-info.js");

describe("fetch-info module", function () {
  // Tests need to send network requests
  this.slow(5000);
  this.timeout(30000);

  function getW3CSpec(shortname, series) {
    const spec = { shortname, url: `https://www.w3.org/TR/${shortname}/` };
    if (series) {
      spec.series = { shortname: series };
    }
    return spec;
  }


  describe("fetch from Specref", () => {
    it("works on a WHATWG spec", async () => {
      const spec = {
        url: "https://dom.spec.whatwg.org/",
        shortname: "dom"
      };
      const info = await fetchInfo([spec]);
      assert.ok(info[spec.shortname]);
      assert.equal(info[spec.shortname].source, "specref");
      assert.equal(info[spec.shortname].nightly.url, "https://dom.spec.whatwg.org/");
      assert.equal(info[spec.shortname].nightly.status, "Living Standard");
      assert.equal(info[spec.shortname].title, "DOM Standard");
    });

    it("can operate on multiple specs at once", async () => {
      const spec = getW3CSpec("presentation-api");
      const other = getW3CSpec("hr-time-2");
      const info = await fetchInfo([spec, other]);
      assert.ok(info[spec.shortname]);
      assert.equal(info[spec.shortname].source, "w3c");
      assert.equal(info[spec.shortname].nightly.url, "https://w3c.github.io/presentation-api/");
      assert.equal(info[spec.shortname].title, "Presentation API");

      assert.ok(info[other.shortname]);
      assert.equal(info[other.shortname].source, "w3c");
      assert.equal(info[other.shortname].nightly.url, "https://w3c.github.io/hr-time/");
      assert.equal(info[other.shortname].title, "High Resolution Time Level 2");
    });

    it("does not retrieve info from a spec that got contributed to Specref", async () => {
      const spec = {
        url: "https://registry.khronos.org/webgl/extensions/ANGLE_instanced_arrays/",
        shortname: "ANGLE_instanced_arrays"
      };
      const info = await fetchInfo([spec]);
      assert.ok(info[spec.shortname]);
      assert.equal(info[spec.shortname].source, "spec");
    });
  });


  describe("fetch from spec", () => {
    it("extracts spec info from a Bikeshed spec when needed", async () => {
      const spec = {
        url: "https://speced.github.io/bikeshed/",
        shortname: "bikeshed"
      };
      const info = await fetchInfo([spec]);
      assert.ok(info[spec.shortname]);
      assert.equal(info[spec.shortname].source, "spec");
      assert.equal(info[spec.shortname].nightly.url, spec.url);
      assert.equal(info[spec.shortname].nightly.status, "Living Standard");
      assert.equal(info[spec.shortname].title, "Bikeshed Documentation");
    });

    it("extracts spec info from a Respec spec when needed", async () => {
      const spec = {
        url: "https://screen-share.github.io/element-capture/",
        shortname: "respec"
      };
      const info = await fetchInfo([spec]);
      assert.ok(info[spec.shortname]);
      assert.equal(info[spec.shortname].source, "spec");
      assert.equal(info[spec.shortname].nightly.url, spec.url);
      assert.equal(info[spec.shortname].nightly.status, "Draft Community Group Report");
      assert.equal(info[spec.shortname].title, "Element Capture");
    });

    it("extracts right title from an ECMAScript proposal spec", async () => {
      const spec = {
        url: "https://tc39.es/proposal-intl-segmenter/",
        shortname: "tc39-intl-segmenter"
      };
      const info = await fetchInfo([spec]);
      assert.ok(info[spec.shortname]);
      assert.equal(info[spec.shortname].source, "spec");
      assert.equal(info[spec.shortname].nightly.url, spec.url);
      assert.equal(info[spec.shortname].nightly.status, "Editor's Draft");
      assert.equal(info[spec.shortname].title, "Intl.Segmenter Proposal");
    });

    it("extracts a suitable nightly URL from an IETF draft", async () => {
      const spec = {
        url: "https://datatracker.ietf.org/doc/html/draft-davidben-http-client-hint-reliability",
        shortname: "client-hint-reliability"
      };
      const info = await fetchInfo([spec]);
      assert.ok(info[spec.shortname]);
      assert.equal(info[spec.shortname].source, "spec");
      assert.match(info[spec.shortname].nightly.url, /^https:\/\/www\.ietf\.org\/archive\/id\/draft-davidben-http-client-hint-reliability-\d+\.html/);
    });

    it("extracts a suitable nightly URL from an IETF HTTP WG draft", async () => {
      const spec = {
        url: "https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-digest-headers",
        shortname: "digest-headers"
      };
      const info = await fetchInfo([spec]);
      assert.ok(info[spec.shortname]);
      assert.equal(info[spec.shortname].source, "spec");
      assert.equal(info[spec.shortname].nightly.url, "https://httpwg.org/http-extensions/draft-ietf-httpbis-digest-headers.html");
    });
  });

    describe("fetch from W3C API", () => {
    it("works on a TR spec", async () => {
      const spec = getW3CSpec("hr-time-2", "hr-time");
      const info = await fetchInfo([spec]);
      assert.ok(info[spec.shortname]);
      assert.equal(info[spec.shortname].source, "w3c");
      assert.equal(info[spec.shortname].release.url, spec.url);
      assert.equal(info[spec.shortname].release.status, "Recommendation");
      assert.equal(info[spec.shortname].nightly.url, "https://w3c.github.io/hr-time/");
      assert.equal(info[spec.shortname].nightly.status, "Editor's Draft");
      assert.equal(info[spec.shortname].title, "High Resolution Time Level 2");

      assert.ok(info.__series);
      assert.ok(info.__series["hr-time"]);
      assert.equal(info.__series["hr-time"].currentSpecification, "hr-time-3");
      assert.equal(info.__series["hr-time"].title, "High Resolution Time");
    });

    it("can operate on multiple specs at once", async () => {
      const spec = getW3CSpec("hr-time-2", "hr-time");
      const other = getW3CSpec("tracking-dnt", "tracking-dnt");
      const info = await fetchInfo([spec, other]);
      assert.ok(info[spec.shortname]);
      assert.equal(info[spec.shortname].source, "w3c");
      assert.equal(info[spec.shortname].release.url, spec.url);
      assert.equal(info[spec.shortname].release.status, "Recommendation");
      assert.equal(info[spec.shortname].nightly.url, "https://w3c.github.io/hr-time/");
      assert.equal(info[spec.shortname].nightly.status, "Editor's Draft");
      assert.equal(info[spec.shortname].title, "High Resolution Time Level 2");

      assert.ok(info[other.shortname]);
      assert.equal(info[other.shortname].source, "w3c");
      assert.equal(info[other.shortname].release.url, other.url);
      assert.equal(info[other.shortname].release.status, "Discontinued Draft");
      assert.equal(info[other.shortname].nightly.url, "https://w3c.github.io/dnt/drafts/tracking-dnt.html");
      assert.equal(info[other.shortname].nightly.status, "Editor's Draft");
      assert.equal(info[other.shortname].title, "Tracking Preference Expression (DNT)");

      assert.ok(info.__series);
      assert.ok(info.__series["hr-time"]);
      assert.ok(info.__series["tracking-dnt"]);
      assert.equal(info.__series["hr-time"].currentSpecification, "hr-time-3");
      assert.equal(info.__series["tracking-dnt"].currentSpecification, "tracking-dnt");
    });
  });

  describe("fetch from Specref", () => {
    it("works on a WHATWG spec", async () => {
      const spec = {
        url: "https://dom.spec.whatwg.org/",
        shortname: "dom"
      };
      const info = await fetchInfo([spec]);
      assert.ok(info[spec.shortname]);
      assert.equal(info[spec.shortname].source, "specref");
      assert.equal(info[spec.shortname].nightly.url, "https://dom.spec.whatwg.org/");
      assert.equal(info[spec.shortname].nightly.status, "Living Standard");
      assert.equal(info[spec.shortname].title, "DOM Standard");
    });
  });


  describe("fetch from all sources", () => {
    it("merges info from sources", async () => {
      const w3c = getW3CSpec("presentation-api");
      const whatwg = {
        url: "https://html.spec.whatwg.org/multipage/",
        shortname: "html"
      };
      const other = {
        url: "https://speced.github.io/bikeshed/",
        shortname: "bikeshed"
      };
      const info = await fetchInfo([w3c, whatwg, other]);
      assert.ok(info[w3c.shortname]);
      assert.equal(info[w3c.shortname].source, "w3c");
      assert.equal(info[w3c.shortname].release.url, w3c.url);
      assert.equal(info[w3c.shortname].nightly.url, "https://w3c.github.io/presentation-api/");
      assert.equal(info[w3c.shortname].nightly.status, "Editor's Draft");
      assert.equal(info[w3c.shortname].title, "Presentation API");

      assert.ok(info[whatwg.shortname]);
      assert.equal(info[whatwg.shortname].source, "specref");
      assert.equal(info[whatwg.shortname].nightly.url, whatwg.url);
      assert.equal(info[whatwg.shortname].nightly.status, "Living Standard");
      assert.equal(info[whatwg.shortname].title, "HTML Standard");

      assert.ok(info[other.shortname]);
      assert.equal(info[other.shortname].source, "spec");
      assert.equal(info[other.shortname].nightly.url, other.url);
      assert.equal(info[other.shortname].nightly.status, "Living Standard");
      assert.equal(info[other.shortname].title, "Bikeshed Documentation");      
    });
  });

});
