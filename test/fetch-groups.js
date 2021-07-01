const assert = require("assert");
const fetchGroups = require("../src/fetch-groups.js");

describe("fetch-groups module (without API keys)", () => {
  async function fetchGroupsFor(url) {
    const spec = { url };
    const result = await fetchGroups([spec]);
    return result[0];
  };

  it("handles WHATWG URLs", async () => {
    const res = await fetchGroupsFor("https://url.spec.whatwg.org/");
    assert.equal(res.organization, "WHATWG");
    assert.deepStrictEqual(res.groups, [{
      name: "WHATWG",
      url: "https://whatwg.org/"
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
    const res = await fetchGroupsFor("https://www.khronos.org/registry/webgl/extensions/EXT_clip_cull_distance/");
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
});