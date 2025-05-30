import { describe, it } from "node:test";
import assert from "node:assert";
import computeInfo from "../src/compute-shortname.js";

describe("compute-shortname module", () => {

  describe("shortname property", () => {
    function assertName(url, name) {
      assert.equal(computeInfo(url).shortname, name);
    }

    it("handles TR URLs", () => {
      assertName("https://www.w3.org/TR/the-spec/", "the-spec");
    });

    it("handles WHATWG URLs", () => {
      assertName("https://myspec.spec.whatwg.org/whatever/", "myspec");
    });

    it("handles ECMAScript proposal URLs", () => {
      assertName("https://tc39.es/proposal-smartidea/", "tc39-smartidea");
    });

    it("handles Khronos Group WebGL extensions", () => {
      assertName("https://registry.khronos.org/webgl/extensions/EXT_wow32/", "EXT_wow32");
    });

    it("handles URLs of drafts on GitHub", () => {
      assertName("https://wicg.github.io/whataspec/", "whataspec");
    });

    it("handles URLs of WebAppSec drafts on GitHub", () => {
      assertName("https://w3c.github.io/webappsec-ultrasecret/", "ultrasecret");
    });

    it("handles extension specs defined in the same repo as the main spec (singular)", () => {
      assertName("https://w3c.github.io/specwithext/extension.html", "specwithext-extension");
    });

    it("handles extension specs defined in the same repo as the main spec (plural)", () => {
      assertName("https://w3c.github.io/specwithext/extensions.html", "specwithext-extensions");
    });

    it("handles CSS WG draft URLs", () => {
      assertName("https://drafts.csswg.org/css-is-aweso/", "css-is-aweso");
    });

    it("handles CSS FXTF draft URLs", () => {
      assertName("https://drafts.fxtf.org/megafx/", "megafx");
    });

    it("handles CSS Houdini TF draft URLs", () => {
      assertName("https://drafts.css-houdini.org/magic/", "magic");
    });

    it("handles IETF RFCs", () => {
      assertName("https://www.rfc-editor.org/rfc/rfc2397", "rfc2397");
    });

    it("handles IETF group drafts", () => {
      assertName("https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-rfc6265bis", "rfc6265bis");
    });

    it("handles IETF group drafts from individuals", () => {
      assertName("https://datatracker.ietf.org/doc/html/draft-cutler-httpbis-partitioned-cookies", "partitioned-cookies");
    });

    it("handles (simple) IETF individual drafts", () => {
      assertName("https://datatracker.ietf.org/doc/html/draft-zern-webp/", "webp");
    });

    it("handles SVG draft URLs", () => {
      assertName("https://svgwg.org/specs/module/", "svg-module");
    });

    it("handles SVG draft URLs that have an svg prefix", () => {
      assertName("https://svgwg.org/specs/svg-module/", "svg-module");
    });

    it("returns the name when given one", () => {
      assertName("myname", "myname");
    });

    it("preserves case", () => {
      assertName("https://www.w3.org/TR/IndexedDB/", "IndexedDB");
    });

    it("includes the version number in the name (int)", () => {
      assertName("https://www.w3.org/TR/level-42/", "level-42");
    });

    it("includes the version number in the name (float)", () => {
      assertName("https://www.w3.org/TR/level-4.2/", "level-4.2");
    });

    it("handles multi-specs repositories", () => {
      assertName("https://w3c.github.io/sdw/bp/", "sdw-bp");
    });

    it("throws when URL is a dated TR one", () => {
      assert.throws(
        () => computeInfo("https://www.w3.org/TR/2017/CR-presentation-api-20170601/"),
        /^Cannot extract meaningful name from /);
    });

    it("throws when URL that does not follow a known pattern", () => {
      assert.throws(
        () => computeInfo("https://www.w3.org/2022/12/webmediaapi.html"),
        /^Cannot extract meaningful name from /);
    });

    it("throws when name contains non basic Latin characters", () => {
      assert.throws(
        () => computeInfo("https://www.w3.org/TR/thé-ou-café/"),
        /^Specification name contains unexpected characters/);
    });

    it("throws when name contains a dot outside of a level definition", () => {
      assert.throws(
        () => computeInfo("https://w3c.github.io/spec.name/"),
        /^Specification name contains unexpected characters/);
    });

    it("handles non separated fractional level", () => {
      assertName("https://www.w3.org/TR/level4.2/", "level4.2");
    });

    it("handles forks", () => {
      const url = "https://www.w3.org/TR/extension/";
      assert.equal(computeInfo(url, "source-2").shortname, "source-2-fork-extension");
    });
  });


  describe("series' shortname property", () => {
    function assertSeries(url, shortname) {
      assert.equal(computeInfo(url).series.shortname, shortname);
    }

    it("parses form 'shortname-X'", () => {
      assertSeries("spec-4", "spec");
    });

    it("parses form 'shortname-XXX'", () => {
      assertSeries("horizon-2050", "horizon");
    });

    it("parses form 'shortname-X.Y'", () => {
      assertSeries("pi-3.1", "pi");
    });

    it("parses form 'shortnameX'", () => {
      assertSeries("loveu2", "loveu");
    });

    it("parses form 'shortnameXY'", () => {
      assertSeries("answer42", "answer");
    });

    it("parses form 'shortnameX.Y'", () => {
      assertSeries("answer4.2", "answer");
    });

    it("parses form 'rdfXY-something'", () => {
      assertSeries("rdf12-something", "rdf-something");
    });

    it("parses form 'sparqlXY-something'", () => {
      assertSeries("sparql12-something", "sparql-something");
    });

    it("parses form 'shaclXY-something'", () => {
      assertSeries("shacl12-something", "shacl-something");
    });

    it("includes final digits when they do not seem to be a level", () => {
      assertSeries("cors-rfc1918", "cors-rfc1918");
    });

    it("does not get lost with inner digits", () => {
      assertSeries("my-2-cents", "my-2-cents");
    });

    it("automatically updates CSS specs with an old 'css3-' name", () => {
      assertSeries("css3-conditional", "css-conditional");
    });

    it("preserves ECMA spec numbers", () => {
      assertSeries("ecma-402", "ecma-402");
    });

    it("preserves ISO spec numbers", () => {
      assertSeries("iso18181-2", "iso18181-2");
    });

    it("preserves digits at the end of WebGL extension names", () => {
      assertSeries("https://registry.khronos.org/webgl/extensions/EXT_wow32/", "EXT_wow32");
    });

    it("handles forks", () => {
      const url = "https://www.w3.org/TR/the-ext/";
      assert.equal(computeInfo(url, "source-2").series.shortname, "source");
    });
  });


  describe("seriesVersion property", () => {
    function assertSeriesVersion(url, level) {
      assert.equal(computeInfo(url).seriesVersion, level);
    }
    function assertNoSeriesVersion(url) {
      assert.equal(computeInfo(url).hasOwnProperty("seriesVersion"), false,
        "did not expect to see a seriesVersion property");
    }

    it("finds the right series version for form 'shortname-X'", () => {
      assertSeriesVersion("spec-4", "4");
    });

    it("finds the right series version for form 'shortname-XXX'", () => {
      assertSeriesVersion("horizon-2050", "2050");
    });

    it("finds the right series version for form 'shortname-X.Y'", () => {
      assertSeriesVersion("pi-3.1", "3.1");
    });

    it("finds the right series version for form 'shortnameX'", () => {
      assertSeriesVersion("loveu2", "2");
    });

    it("finds the right series version for form 'shortnameXY'", () => {
      assertSeriesVersion("answer42", "4.2");
    });

    it("finds the right series version for form 'rdfXY-something'", () => {
      assertSeriesVersion("rdf12-something", "1.2");
    });

    it("finds the right series version for form 'sparqlXY-something'", () => {
      assertSeriesVersion("sparql12-something", "1.2");
    });

    it("does not report any series version when there are none", () => {
      assertNoSeriesVersion("nolevel");
    });

    it("does not report a series version when final digits do not seem to be one", () => {
      assertNoSeriesVersion("cors-rfc1918");
    });

    it("does not get lost with inner digits", () => {
      assertNoSeriesVersion("my-2-cents");
    });

    it("does not confuse an ECMA spec number with a series version", () => {
      assertNoSeriesVersion("ecma-402");
    });

    it("does not confuse a TC39 proposal number with a series version", () => {
      assertNoSeriesVersion("tc39-arraybuffer-base64");
    });

    it("does not confuse an ISO spec number with a series version", () => {
      assertNoSeriesVersion("iso18181-2");
    });

    it("does not confuse digits at the end of a WebGL extension spec with a series version", () => {
      assertNoSeriesVersion("https://registry.khronos.org/webgl/extensions/EXT_wow32/");
    });

    it("handles forks", () => {
      const url = "https://www.w3.org/TR/the-ext/";
      assert.equal(computeInfo(url, "source-2").seriesVersion, "2");
    });
  });
});
