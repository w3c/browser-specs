/**
 * Tests for the fetch-info module
 */

import assert from "node:assert";
import fetchInfo from "../src/fetch-info.js";

import { MockAgent, setGlobalDispatcher, getGlobalDispatcher } from 'undici';

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

  describe("fetch from WHATWG", () => {
    it("works on a WHATWG spec", async () => {
      const spec = {
        url: "https://dom.spec.whatwg.org/",
        shortname: "dom"
      };
      const info = await fetchInfo([spec]);
      assert.ok(info[spec.shortname]);
      assert.equal(info[spec.shortname].source, "whatwg");
      assert.equal(info[spec.shortname].nightly.url, "https://dom.spec.whatwg.org/");
      assert.equal(info[spec.shortname].nightly.status, "Living Standard");
      assert.equal(info[spec.shortname].title, "DOM");
    });
  });

  describe("fetch from IETF datatracker", () => {
    it("fetches info about RFCs from datatracker", async () => {
      const spec = {
        url: "https://www.rfc-editor.org/rfc/rfc7578",
        shortname: "rfc7578"
      };
      const info = await fetchInfo([spec]);
      assert.ok(info[spec.shortname]);
      assert.equal(info[spec.shortname].title, "Returning Values from Forms: multipart/form-data");
      assert.equal(info[spec.shortname].source, "ietf");
      assert.equal(info[spec.shortname].nightly.url, "https://www.rfc-editor.org/rfc/rfc7578");
    });

    it("fetches info about HTTP WG RFCs from datatracker", async () => {
      const spec = {
        url: "https://www.rfc-editor.org/rfc/rfc9110",
        shortname: "rfc9110"
      };
      const info = await fetchInfo([spec]);
      assert.ok(info[spec.shortname]);
      assert.equal(info[spec.shortname].title, "HTTP Semantics");
      assert.equal(info[spec.shortname].source, "ietf");
      assert.equal(info[spec.shortname].nightly.url, "https://httpwg.org/specs/rfc9110.html");
    });

    it("extracts a suitable nightly URL from an IETF draft", async () => {
      const spec = {
        url: "https://datatracker.ietf.org/doc/html/draft-davidben-http-client-hint-reliability",
        shortname: "client-hint-reliability"
      };
      const info = await fetchInfo([spec]);
      assert.ok(info[spec.shortname]);
      assert.equal(info[spec.shortname].source, "ietf");
      assert.match(info[spec.shortname].nightly.url, /^https:\/\/www\.ietf\.org\/archive\/id\/draft-davidben-http-client-hint-reliability-\d+\.html/);
    });

    it("extracts a suitable nightly URL from an IETF HTTP WG draft", async () => {
      const spec = {
        url: "https://datatracker.ietf.org/doc/html/draft-cutler-httpbis-partitioned-cookies",
        shortname: "partitioned-cookies"
      };
      const info = await fetchInfo([spec]);
      assert.ok(info[spec.shortname]);
      assert.equal(info[spec.shortname].source, "ietf");
      assert.match(info[spec.shortname].nightly.url, /^https:\/\/www\.ietf\.org\/archive\/id\/draft-cutler-httpbis-partitioned-cookies-\d+\.html/);
    });

    it("extracts a suitable nightly URL from an IETF HTTP State Management Mechanism WG RFC", async () => {
      const spec = {
        url: "https://www.rfc-editor.org/rfc/rfc6265",
        shortname: "rfc6265"
      };
      const info = await fetchInfo([spec]);
      assert.ok(info[spec.shortname]);
      assert.equal(info[spec.shortname].source, "ietf");
      assert.equal(info[spec.shortname].nightly.url, "https://httpwg.org/specs/rfc6265.html");
    });

    it("uses the rfc-editor URL as nightly for an IETF HTTP WG RFC not published under httpwg.org", async () => {
      const spec = {
        url: "https://www.rfc-editor.org/rfc/rfc9163",
        shortname: "rfc9163"
      };
      const info = await fetchInfo([spec]);
      assert.ok(info[spec.shortname]);
      assert.equal(info[spec.shortname].source, "ietf");
      assert.equal(info[spec.shortname].nightly.url, spec.url);
    });

    it("identifies discontinued IETF specs", async () => {
      const info = await fetchInfo([
        { url: "https://www.rfc-editor.org/rfc/rfc7230", shortname: "rfc7230" },
        { url: "https://www.rfc-editor.org/rfc/rfc9110", shortname: "rfc9110" },
        { url: "https://www.rfc-editor.org/rfc/rfc9112", shortname: "rfc9112" }
      ]);
      assert.ok(info["rfc7230"]);
      assert.equal(info["rfc7230"].standing, "discontinued");
      assert.deepStrictEqual(info["rfc7230"].obsoletedBy, ["rfc9110", "rfc9112"]);
    });

    it("throws when a discontinued IETF spec is obsoleted by an unknown spec", async () => {
      const spec = {
        url: "https://www.rfc-editor.org/rfc/rfc7230",
        shortname: "rfc7230"
      };
      await assert.rejects(
        fetchInfo([spec]),
        /^Error: IETF spec at (.*)rfc7230 is obsoleted by rfc9110 which is not in the list.$/);
    });

    it("throws when an IETF URL needs to be updated", async () => {
      const spec = {
        url: "https://datatracker.ietf.org/doc/html/draft-ietf-websec-strict-transport-sec",
        shortname: "strict-transport-sec"
      };
      await assert.rejects(
        fetchInfo([spec]),
        /^Error: IETF spec (.*) published under a new name/);
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

    it("creates a release for final AOM deliverables published as PDF", async () => {
      const spec = {
        organization: "Alliance for Open Media",
        url: "https://aomediacodec.github.io/av1-spec/av1-spec.pdf",
        shortname: "av1-spec",
        nightly: {
          url: "https://aomediacodec.github.io/av1-spec/"
        }
      };
      const info = await fetchInfo([spec]);
      assert.ok(info[spec.shortname]);
      assert.equal(info[spec.shortname].source, "spec");
      assert.equal(info[spec.shortname].nightly.url, spec.nightly.url);
      assert.ok(info[spec.shortname].release);
      assert.equal(info[spec.shortname].release.url, spec.url);
      assert.equal(info[spec.shortname].release.status, "Final Deliverable");
    });

    it("extracts spec info from an ISO spec page", async () => {
      const spec = {
        url: "https://www.iso.org/standard/61292.html",
        shortname: "iso18074-2015"
      };
      const info = await fetchInfo([spec]);
      assert.ok(info[spec.shortname]);
      assert.equal(info[spec.shortname].source, "spec");
      assert.equal(info[spec.shortname].title, "Textiles — Identification of some animal fibres by DNA analysis method — Cashmere, wool, yak and their blends");
      assert.equal(info[spec.shortname].nightly, undefined);
    });

    it("uses the last published info when hitting an error fetching the spec", async () => {
      const defaultDispatcher = getGlobalDispatcher();
      const mockAgent = new MockAgent();
      setGlobalDispatcher(mockAgent);

      mockAgent.get("https://example.com")
	.intercept({ method: "GET", path: "/429" })
	.reply(429);

      const spec = {
        url: "https://example.com/429",
        shortname: "example",
        __last: {
          organization: "Acme Corporation"
        }
      };
      const info = await fetchInfo([spec]);
      assert.ok(info[spec.shortname]);
      assert.equal(info[spec.shortname].organization, spec.__last.organization);

      setGlobalDispatcher(defaultDispatcher);
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

    it("does not get confused by CSS snapshots", async () => {
      const css = getW3CSpec("CSS21", "CSS");
      const snapshot = getW3CSpec("css-2023", "css");
      const info = await fetchInfo([css, snapshot]);
      assert.equal(info[css.shortname].source, "w3c");
      assert.equal(info[snapshot.shortname].source, "w3c");

      assert.ok(info.__series);
      assert.ok(info.__series["CSS"]);
      assert.ok(info.__series["css"]);
      assert.equal(info.__series["CSS"].title, "Cascading Style Sheets");
      assert.equal(info.__series["css"].title, "CSS Snapshot");
    });

    it("detects redirects", async () => {
      const spec = {
        url: "https://www.w3.org/TR/webaudio/",
        shortname: "webaudio"
      };
      await assert.rejects(
        fetchInfo([spec]),
        /^Error: W3C API redirects "webaudio" to "webaudio-.*"/);
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
  });

  describe("fetch from all sources", () => {
    it("uses the last published info for discontinued specs", async () => {
      const spec = {
        url: "https://wicg.github.io/close-watcher/",
        shortname: "close-watcher",
        __last: {
          standing: "discontinued",
          organization: "Acme Corporation"
        }
      };
      const info = await fetchInfo([spec]);
      assert.ok(info[spec.shortname]);
      assert.equal(info[spec.shortname].organization, spec.__last.organization);
    });

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
      assert.equal(info[whatwg.shortname].source, "whatwg");
      assert.equal(info[whatwg.shortname].nightly.url, whatwg.url);
      assert.equal(info[whatwg.shortname].nightly.status, "Living Standard");
      assert.equal(info[whatwg.shortname].title, "HTML");

      assert.ok(info[other.shortname]);
      assert.equal(info[other.shortname].source, "spec");
      assert.equal(info[other.shortname].nightly.url, other.url);
      assert.equal(info[other.shortname].nightly.status, "Living Standard");
      assert.equal(info[other.shortname].title, "Bikeshed Documentation");      
    });
  });

});
