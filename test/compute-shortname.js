const assert = require("assert");
const computeInfo = require("../src/compute-shortname.js");

describe("compute-shortname module", () => {

  describe("name property", () => {
    function assertName(url, name) {
      assert.equal(computeInfo(url).name, name);
    }

    it("handles TR URLs", () => {
      assertName("https://www.w3.org/TR/the-spec/", "the-spec");
    });

    it("handles WHATWG URLs", () => {
      assertName("https://myspec.spec.whatwg.org/whatever/", "myspec");
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

    it("throws when URL is a dated TR one", () => {
      assert.throws(
        () => computeInfo("https://www.w3.org/TR/2017/CR-presentation-api-20170601/"),
        /^Cannot extract meaningful name from /);
    });

    it("throws when URL that does not follow a known pattern", () => {
      assert.throws(
        () => computeInfo("https://www.w3.org/2001/tag/doc/promises-guide/"),
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

    it("throws when name contains a non separated fractional level", () => {
      assert.throws(
        () => computeInfo("https://w3c.github.io/spec4.2/"),
        /^Specification name contains unexpected characters/);
    });
  });


  describe("shortname property", () => {
    function assertShortname(url, shortname) {
      assert.equal(computeInfo(url).shortname, shortname);
    }

    it("parses form 'shortname-X'", () => {
      assertShortname("spec-4", "spec");
    });

    it("parses form 'shortname-XXX'", () => {
      assertShortname("horizon-2050", "horizon");
    });

    it("parses form 'shortname-X.Y'", () => {
      assertShortname("pi-3.1", "pi");
    });

    it("parses form 'shortnameX'", () => {
      assertShortname("loveu2", "loveu");
    });

    it("parses form 'shortnameXY'", () => {
      assertShortname("answer42", "answer");
    });

    it("includes final digits when they do not seem to be a level", () => {
      assertShortname("cors-rfc1918", "cors-rfc1918");
    });

    it("does not get lost with inner digits", () => {
      assertShortname("my-2-cents", "my-2-cents");
    });

    it("automatically updates CSS specs with an old 'css3-' name", () => {
      assertShortname("css3-conditional", "css-conditional");
    });
  });


  describe("level property", () => {
    function assertLevel(url, level) {
      assert.equal(computeInfo(url).level, level);
    }
    function assertNoLevel(url) {
      assert.equal(computeInfo(url).hasOwnProperty("level"), false,
        "did not expect to see a level property");
    }

    it("finds the right level for form 'shortname-X'", () => {
      assertLevel("spec-4", 4);
    });

    it("finds the right level for form 'shortname-XXX'", () => {
      assertLevel("horizon-2050", 2050);
    });

    it("finds the right level for form 'shortname-X.Y'", () => {
      assertLevel("pi-3.1", 3.1);
    });

    it("finds the right level for form 'shortnameX'", () => {
      assertLevel("loveu2", 2);
    });

    it("finds the right level for form 'shortnameXY'", () => {
      assertLevel("answer42", 4.2);
    });

    it("does not report any level when there are none", () => {
      assertNoLevel("nolevel");
    });

    it("does not report a level when final digits do not seem to be one", () => {
      assertNoLevel("cors-rfc1918");
    });

    it("does not get lost with inner digits", () => {
      assertNoLevel("my-2-cents");
    });
  });
});