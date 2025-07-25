import { describe, it } from "node:test";
import assert from "node:assert";
import fetchGroups from "../src/fetch-groups.js";

const githubToken = (function () {
  try {
    return require("../config.json").GITHUB_TOKEN;
  }
  catch (err) {
    return null;
  }
})() ?? process.env.GITHUB_TOKEN;

describe("fetch-groups module (without API keys)", function () {
  // Long timeout since tests may need to send network requests
  const timeout = { timeout: 30000 };

  async function fetchGroupsFor(url, options) {
    const spec = { url };
    const result = await fetchGroups([spec], options);
    return result[0];
  };

  it("handles WHATWG URLs", timeout, async () => {
    const res = await fetchGroupsFor("https://url.spec.whatwg.org/");
    assert.equal(res.organization, "WHATWG");
    assert.deepStrictEqual(res.groups, [{
      name: "URL Workstream",
      url: "https://url.spec.whatwg.org/"
    }]);
  });

  it("handles TC39 URLs", timeout, async () => {
    const res = await fetchGroupsFor("https://tc39.es/proposal-relative-indexing-method/");
    assert.equal(res.organization, "Ecma International");
    assert.deepStrictEqual(res.groups, [{
      name: "TC39",
      url: "https://tc39.es/"
    }]);
  });

  it("handles W3C TAG URLs", timeout, async () => {
    const res = await fetchGroupsFor("https://www.w3.org/2001/tag/doc/promises-guide");
    assert.equal(res.organization, "W3C");
    assert.deepStrictEqual(res.groups, [{
      name: "Technical Architecture Group",
      url: "https://www.w3.org/2001/tag/"
    }]);
  });

  it("handles WebGL URLs", timeout, async () => {
    const res = await fetchGroupsFor("https://registry.khronos.org/webgl/extensions/EXT_clip_cull_distance/");
    assert.equal(res.organization, "Khronos Group");
    assert.deepStrictEqual(res.groups, [{
      name: "WebGL Working Group",
      url: "https://www.khronos.org/webgl/"
    }]);
  });

  it("handles IETF RFCs", timeout, async () => {
    const res = await fetchGroupsFor("https://www.rfc-editor.org/rfc/rfc9110");
    assert.equal(res.organization, "IETF");
    assert.deepStrictEqual(res.groups, [{
      name: "HTTP Working Group",
      url: "https://datatracker.ietf.org/wg/httpbis/"
    }]);
  });

  it("handles IETF group drafts", timeout, async () => {
    const res = await fetchGroupsFor("https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-digest-headers");
    assert.equal(res.organization, "IETF");
    assert.deepStrictEqual(res.groups, [{
      name: "HTTP Working Group",
      url: "https://datatracker.ietf.org/wg/httpbis/"
    }]);
  });

  it("handles IETF individual drafts", timeout, async () => {
    const res = await fetchGroupsFor("https://datatracker.ietf.org/doc/html/draft-cutler-httpbis-partitioned-cookies");
    assert.equal(res.organization, "IETF");
    assert.deepStrictEqual(res.groups, [{
      name: "Individual Submissions",
      url: "https://datatracker.ietf.org/wg/none/"
    }]);
  });

  it("handles IETF area drafts", timeout, async () => {
    const res = await fetchGroupsFor("https://datatracker.ietf.org/doc/html/draft-zern-webp");
    assert.equal(res.organization, "IETF");
    assert.deepStrictEqual(res.groups, [{
      name: "Applications and Real-Time Area",
      url: "https://datatracker.ietf.org/wg/art/"
    }]);
  });

  it("handles AOM specs", timeout, async () => {
    const res = await fetchGroupsFor("https://aomediacodec.github.io/afgs1-spec/");
    assert.equal(res.organization, "Alliance for Open Media");
    assert.deepStrictEqual(res.groups, [{
      name: "Codec Working Group",
      url: "https://aomedia.org/about/#codec-working-group"
    }]);
  });

  it("preserves provided info", timeout, async () => {
    const spec = {
      url: "https://url.spec.whatwg.org/",
      organization: "Acme Corporation",
      groups: [{
        name: "Road Runner Group",
        url: "https://en.wikipedia.org/wiki/Wile_E._Coyote_and_the_Road_Runner"
      }]
    };
    const res = await fetchGroups([spec]);
    assert.equal(res[0].organization, spec.organization);
    assert.deepStrictEqual(res[0].groups, spec.groups);
  });

  it("preserves provided info for Patent Policy", timeout, async () => {
    const spec = {
      "url": "https://www.w3.org/Consortium/Patent-Policy/",
      "shortname": "w3c-patent-policy",
      "groups": [
        {
          "name": "Patents and Standards Interest Group",
          "url": "https://www.w3.org/2004/pp/psig/"
        }
      ]
    };
    const res = await fetchGroups([spec]);
    assert.equal(res[0].organization, "W3C");
    assert.deepStrictEqual(res[0].groups, spec.groups);
  });

  describe("fetch from W3C API", () => {
    it("handles /TR URLs", timeout, async () => {
      const res = await fetchGroupsFor("https://www.w3.org/TR/gamepad/");
      assert.equal(res.organization, "W3C");
      assert.deepStrictEqual(res.groups, [{
        name: "Web Applications Working Group",
        url: "https://www.w3.org/groups/wg/webapps/"
      }]);
    });

    it("handles multiple /TR URLs", timeout, async () => {
      const specs = [
        { url: "https://www.w3.org/TR/gamepad/" },
        { url: "https://www.w3.org/TR/accname-1.2/" }
      ];
      const res = await fetchGroups(specs);
      assert.equal(res[0].organization, "W3C");
      assert.deepStrictEqual(res[0].groups, [{
        name: "Web Applications Working Group",
        url: "https://www.w3.org/groups/wg/webapps/"
      }]);
      assert.equal(res[1].organization, "W3C");
      assert.deepStrictEqual(res[1].groups, [{
        name: "Accessible Rich Internet Applications Working Group",
        url: "https://www.w3.org/WAI/about/groups/ariawg/"
      }]);
    });

    it("handles w3c.github.io URLs", timeout, async () => {
      const res = await fetchGroupsFor("https://w3c.github.io/web-nfc/", { githubToken });
      assert.equal(res.organization, "W3C");
      assert.deepStrictEqual(res.groups, [{
        name: "Web NFC Community Group",
        url: "https://www.w3.org/community/web-nfc/"
      }]);
    });

    it("handles SVG URLs", timeout, async () => {
      const res = await fetchGroupsFor("https://svgwg.org/specs/animations/");
      assert.equal(res.organization, "W3C");
      assert.deepStrictEqual(res.groups, [{
        name: "SVG Working Group",
        url: "https://www.w3.org/Graphics/SVG/WG/"
      }]);
    });

    it("handles CSS WG URLs", timeout, async () => {
      const res = await fetchGroupsFor("https://drafts.csswg.org/css-animations-2/");
      assert.equal(res.organization, "W3C");
      assert.deepStrictEqual(res.groups, [{
        name: "Cascading Style Sheets (CSS) Working Group",
        url: "https://www.w3.org/Style/CSS/"
      }]);
    });

    it("handles CSS Houdini TF URLs", timeout, async () => {
      const res = await fetchGroupsFor("https://drafts.css-houdini.org/css-typed-om-2/");
      assert.equal(res.organization, "W3C");
      assert.deepStrictEqual(res.groups, [{
        name: "Cascading Style Sheets (CSS) Working Group",
        url: "https://www.w3.org/Style/CSS/"
      }]);
    });

    it("handles CSS FXTF URLs", timeout, async () => {
      const res = await fetchGroupsFor("https://drafts.fxtf.org/filter-effects-2/");
      assert.equal(res.organization, "W3C");
      assert.deepStrictEqual(res.groups, [{
        name: "Cascading Style Sheets (CSS) Working Group",
        url: "https://www.w3.org/Style/CSS/"
      }]);
    });

    it("uses last published info for discontinued specs", timeout, async () => {
      const spec = {
        url: "https://wicg.github.io/close-watcher/",
        shortname: "close-watcher",
        __last: {
          standing: "discontinued",
          organization: "Acme Corporation",
          groups: [{
            name: "Road Runner",
            url: "beep beep"
          }]
        }
      };
      const result = await fetchGroups([spec]);
      assert.equal(result[0].organization, spec.__last.organization);
      assert.deepStrictEqual(result[0].groups, spec.__last.groups);
    });
  });
});
