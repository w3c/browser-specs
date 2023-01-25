const assert = require("assert");
const computeSeriesUrls = require("../src/compute-series-urls.js");

describe("compute-series-urls module", () => {
  it("returns spec URLs when spec has no level", () => {
    const spec = {
      url: "https://www.w3.org/TR/preload/",
      shortname: "preload",
      series: { shortname: "preload" },
      release: { url: "https://www.w3.org/TR/preload/" },
      nightly: { url: "https://w3c.github.io/preload/" }
    };
    assert.deepStrictEqual(computeSeriesUrls(spec),
      { releaseUrl: "https://www.w3.org/TR/preload/",
        nightlyUrl: "https://w3c.github.io/preload/" });
  });


  it("does not return a release URL if spec has none", () => {
    const spec = {
      url: "https://compat.spec.whatwg.org/",
      shortname: "compat",
      series: { shortname: "compat" },
      nightly: { url: "https://compat.spec.whatwg.org/" }
    };
    assert.deepStrictEqual(computeSeriesUrls(spec),
      { nightlyUrl: "https://compat.spec.whatwg.org/" });
  });


  it("does not return a nightly URL if spec has none", () => {
    const spec = {
      url: "https://compat.spec.whatwg.org/",
      shortname: "compat",
      series: { shortname: "compat" },
    };
    assert.deepStrictEqual(computeSeriesUrls(spec), {});
  });


  it("returns series URLs for Houdini specs", () => {
    const spec = {
      url: "https://www.w3.org/TR/css-paint-api-1/",
      shortname: "css-paint-api-1",
      series: { shortname: "css-paint-api" },
      release: { url: "https://www.w3.org/TR/css-paint-api-1/" },
      nightly: { url: "https://drafts.css-houdini.org/css-paint-api-1/" }
    };
    assert.deepStrictEqual(computeSeriesUrls(spec),
      { releaseUrl: "https://www.w3.org/TR/css-paint-api/",
        nightlyUrl: "https://drafts.css-houdini.org/css-paint-api/" });
  });


  it("returns series URLs for CSS specs", () => {
    const spec = {
      url: "https://www.w3.org/TR/css-fonts-4/",
      shortname: "css-fonts-4",
      series: { shortname: "css-fonts" },
      release: { url: "https://www.w3.org/TR/css-fonts-4/" },
      nightly: { url: "https://drafts.csswg.org/css-fonts-4/" }
    };
    assert.deepStrictEqual(computeSeriesUrls(spec),
      { releaseUrl: "https://www.w3.org/TR/css-fonts/",
        nightlyUrl: "https://drafts.csswg.org/css-fonts/" });
  });


  it("returns right nightly URL for series when spec's nightly has no level", () => {
    const spec = {
      url: "https://www.w3.org/TR/pointerlock-2/",
      shortname: "pointerlock-2",
      series: { shortname: "pointerlock" },
      release: { url: "https://www.w3.org/TR/pointerlock-2/" },
      nightly: { url: "https://w3c.github.io/pointerlock/" }
    };
    assert.deepStrictEqual(computeSeriesUrls(spec),
      { releaseUrl: "https://www.w3.org/TR/pointerlock/",
        nightlyUrl: "https://w3c.github.io/pointerlock/" });
  });


  it("does not invent an unversioned nightly URL for SVG 2", () => {
    const spec = {
      url: "https://www.w3.org/TR/SVG2/",
      shortname: "SVG2",
      series: { shortname: "SVG" },
      release: { url: "https://www.w3.org/TR/SVG2/" },
      nightly: { url: "https://svgwg.org/svg2-draft/" }
    };
    assert.deepStrictEqual(computeSeriesUrls(spec),
      { releaseUrl: "https://www.w3.org/TR/SVG/",
        nightlyUrl: "https://svgwg.org/svg2-draft/" });
  });


  it("looks for a release URL in previous versions", () => {
    const spec = {
      url: "https://drafts.csswg.org/css-fonts-5/",
      shortname: "css-fonts-5",
      series: { shortname: "css-fonts" },
      seriesPrevious: "css-fonts-4",
      nightly: { url: "https://drafts.csswg.org/css-fonts-5/" }
    };

    const list = [
      spec,
      {
        url: "https://drafts.csswg.org/css-fonts-4/",
        shortname: "css-fonts-4",
        series: { shortname: "css-fonts" },
        seriesPrevious: "css-fonts-3",
        nightly: { url: "https://drafts.csswg.org/css-fonts-4/" }
      },
      {
        url: "https://drafts.csswg.org/css-fonts-3/",
        shortname: "css-fonts-3",
        series: { shortname: "css-fonts" },
        release: { url: "https://www.w3.org/TR/css-fonts-3/" },
        nightly: { url: "https://drafts.csswg.org/css-fonts-3/" }
      }
    ];

    assert.deepStrictEqual(computeSeriesUrls(spec, list),
      { releaseUrl: "https://www.w3.org/TR/css-fonts/",
        nightlyUrl: "https://drafts.csswg.org/css-fonts/" });
  });


  it("looks for a release URL in the provided spec if not the current one", () => {
    const spec = {
      url: "https://drafts.fxtf.org/compositing-1/",
      shortname: "compositing-1",
      series: { shortname: "compositing", currentSpecification: "compositing-2" },
      nightly: { url: "https://drafts.fxtf.org/compositing-1/" },
      release: { url: "https://www.w3.org/TR/compositing-1/" }
    };

    const list = [
      spec,
      {
        url: "https://drafts.fxtf.org/compositing-2/",
        shortname: "compositing-2",
        series: { shortname: "compositing", currentSpecification: "compositing-2" },
        seriesPrevious: "compositing-1",
        nightly: { url: "https://drafts.fxtf.org/compositing-2/" }
      }
    ];

    assert.deepStrictEqual(computeSeriesUrls(spec, list),
      { releaseUrl: "https://www.w3.org/TR/compositing/",
        nightlyUrl: "https://drafts.fxtf.org/compositing/" });
  });


  it("computes info based on current specification", () => {
    const spec = {
      url: "https://www.w3.org/TR/SVG11/",
      seriesComposition: "full",
      shortname: "SVG11",
      series: { shortname: "SVG", currentSpecification: "SVG2" },
      release: { url: "https://www.w3.org/TR/SVG11/" },
      nightly: { url: "https://www.w3.org/TR/SVG11/" }
    };

    const list = [
      spec,
      {
        url: "https://www.w3.org/TR/SVG2/",
        seriesComposition: "full",
        shortname: "SVG2",
        series: { shortname: "SVG", currentSpecification: "SVG2" },
        release: { url: "https://www.w3.org/TR/SVG2/" },
        nightly: { url: "https://svgwg.org/svg2-draft/" }
      }
    ];

    assert.deepStrictEqual(computeSeriesUrls(spec, list),
      { releaseUrl: "https://www.w3.org/TR/SVG/",
        nightlyUrl: "https://svgwg.org/svg2-draft/" });
  });
});