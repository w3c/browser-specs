const assert = require("assert");
const fetchGroups = require("../src/fetch-groups.js");

describe("fetch-groups module (without API keys)", function () {
  // Tests may need to send network requests
  this.slow(5000);
  this.timeout(30000);

  async function fetchGroupsFor(url) {
    const spec = { url };
    const result = await fetchGroups([spec]);
    return result[0];
  };

  it("handles WHATWG URLs", async () => {
    const res = await fetchGroupsFor("https://url.spec.whatwg.org/");
    assert.equal(res.organization, "WHATWG");
    assert.deepStrictEqual(res.groups, [{
      name: "URL Workstream",
      url: "https://url.spec.whatwg.org/"
    }]);
  });

  it("handles TC39 URLs", async () => {
    const res = await fetchGroupsFor("https://tc39.es/proposal-relative-indexing-method/");
    assert.equal(res.organization, "Ecma International");
    assert.deepStrictEqual(res.groups, [{
      name: "TC39",
      url: "https://tc39.es/"
    }]);
  });

  it("handles WebGL URLs", async () => {
    const res = await fetchGroupsFor("https://registry.khronos.org/webgl/extensions/EXT_clip_cull_distance/");
    assert.equal(res.organization, "Khronos Group");
    assert.deepStrictEqual(res.groups, [{
      name: "WebGL Working Group",
      url: "https://www.khronos.org/webgl/"
    }]);
  });

  it("preserves provided info", async () => {
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

  it("preserves provided info for Patent Policy", async () => {
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
});
