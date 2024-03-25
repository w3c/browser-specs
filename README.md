# Web specifications

This repository contains a curated list of technical Web specifications.
The list is used in a variety of ways, which include:

* [Reffy](https://github.com/w3c/reffy), which generates
  [Webref](https://github.com/w3c/webref#webref), which is then used
  by tools such as [ReSpec](https://respec.org/docs/) and
  [Bikeshed](https://speced.github.io/bikeshed/) to create terminology
  and reference links between Web specifications.
* Analyzers of browser technologies to create reports on test coverage,
  WebIDL, and specification quality.

The repository is called `browser-specs` because browsers were
historically the focus of the list; it is now open to any spec that can 
reasonably be qualified as a "Web specification".

## Table of Contents

- [Installation and usage](#installation-and-usage)
<!-- COMMON-TOC: start -->
- [Spec object](#spec-object)
  - [`url`](#url)
  - [`shortname`](#shortname)
  - [`title`](#title)
  - [`shortTitle`](#shorttitle)
  - [`categories`](#categories)
  - [`standing`](#standing)
  - [`obsoletedBy`](#obsoletedby)
  - [`formerNames`](#formernames)
  - [`series`](#series)
    - [`series.shortname`](#seriesshortname)
    - [`series.currentSpecification`](#seriescurrentspecification)
    - [`series.title`](#seriestitle)
    - [`series.shortTitle`](#seriesshorttitle)
    - [`series.releaseUrl`](#seriesreleaseurl)
    - [`series.nightlyUrl`](#seriesnightlyurl)
  - [`seriesVersion`](#seriesversion)
  - [`seriesComposition`](#seriescomposition)
  - [`seriesPrevious`](#seriesprevious)
  - [`seriesNext`](#seriesnext)
  - [`forkOf`](#forkof)
  - [`forks`](#forks)
  - [`organization`](#organization)
  - [`groups`](#groups)
  - [`release`](#release)
    - [`release.url`](#releaseurl)
    - [`release.status`](#releasestatus)
    - [`release.filename`](#releasefilename)
    - [`release.pages`](#releasepages)
  - [`nightly`](#nightly)
    - [`nightly.url`](#nightlyurl)
    - [`nightly.status`](#nightlystatus)
    - [`nightly.alternateUrls`](#nightlyalternateurls)
    - [`nightly.filename`](#nightlyfilename)
    - [`nightly.pages`](#nightlypages)
    - [`nightly.repository`](#nightlyrepository)
    - [`nightly.sourcePath`](#nightlysourcepath)
  - [`tests`](#tests)
    - [`tests.repository`](#testsrepository)
    - [`tests.testPaths`](#teststestpaths)
    - [`tests.excludePaths`](#testsexcludepaths)
  - [`source`](#source)
- [Spec identifiers](#spec-identifiers)
- [How to add/update/delete a spec](#how-to-addupdatedelete-a-spec)
- [Versioning](#versioning)<!-- COMMON-TOC: end -->
- [Spec selection criteria](#spec-selection-criteria)
- [Development notes](#development-notes)
  - [How to generate `index.json` manually](#how-to-generate-indexjson-manually)
  - [Debugging tools](#debugging-tools)
    - [Lookup a spec in `index.json`](#lookup-a-spec-in-indexjson)
    - [Build a restricted set of specs](#build-a-restricted-set-of-specs)
    - [Build a diff of `index.json`](#build-a-diff-of-indexjson)
  - [Tests](#tests)
  - [How to release a new version](#how-to-release-a-new-version)


## Installation and usage

The whole list is distributed as an NPM package called [web-specs](https://www.npmjs.com/package/web-specs). To incorporate it to your project,
run:

```bash
npm install web-specs
```

You can then retrieve the list from your Node.js program:

```js
const specs = require("web-specs");
console.log(JSON.stringify(specs, null, 2));
```

Alternatively, you can fetch [`index.json`](https://w3c.github.io/browser-specs/index.json)
or retrieve the list from the [`web-specs@latest` branch](https://github.com/w3c/browser-specs/tree/web-specs%40latest).

The subset of specs that target web browsers is published in a separate [`browser-specs`](https://www.npmjs.com/package/browser-specs) package. You may retrieve that filtered list from the [`browser-specs@latest` branch](https://github.com/w3c/browser-specs/tree/browser-specs%40latest)

<!-- COMMON-BODY: start -->
## Spec object

Each specification in the list comes with the following properties:

```json
{
  "url": "https://www.w3.org/TR/css-color-4/",
  "seriesComposition": "full",
  "shortname": "css-color-4",
  "series": {
    "shortname": "css-color",
    "currentSpecification": "css-color-4",
    "title": "CSS Color",
    "shortTitle": "CSS Color",
    "releaseUrl": "https://www.w3.org/TR/css-color/",
    "nightlyUrl": "https://drafts.csswg.org/css-color/"
  },
  "seriesVersion": "4",
  "seriesNext": "css-color-5",
  "organization": "W3C",
  "groups": [
    {
      "name": "Cascading Style Sheets (CSS) Working Group",
      "url": "https://www.w3.org/Style/CSS/"
    }
  ],
  "release": {
    "url": "https://www.w3.org/TR/css-color-4/",
    "filename": "Overview.html"
  },
  "nightly": {
    "url": "https://drafts.csswg.org/css-color/",
    "repository": "https://github.com/w3c/csswg-drafts",
    "sourcePath": "css-color-4/Overview.bs",
    "filename": "Overview.html"
  },
  "title": "CSS Color Module Level 4",
  "source": "w3c",
  "shortTitle": "CSS Color 4",
  "categories": ["browser"],
  "tests": {
    "repository": "https://github.com/web-platform-tests/wpt",
    "testPaths": [
      "css/css-color"
    ]
  }
}
```


### `url`

The versioned (but not dated) URL for the spec. For W3C specs published as
TR documents, this is the TR URL. For WHATWG specs, this is the URL of the
living standard. For specs developed by an organization that does not provide
a public version of the spec such as ISO, this is the URL of the page that
describes the spec on the organization's web site. In other cases, this is the
URL of the latest Editor's Draft.

The URL should be relatively stable but may still change over time. See
[Spec identifiers](#spec-identifiers) for details.

The `url` property is always set.


### `shortname`

A shortname that uniquely identifies the spec in the list. The value matches the
"well-known" shortname of the spec, that usually appears in the versioned URL.
For instance, for W3C specs published as TR documents, this is the TR shortname.
For WHATWG specs, this is the shortname that appears at the beginning of the URL
(e.g. `compat` for `https://compat.spec.whatwg.org/`). For specs developed on
GitHub, this is usually the name of repository that holds the spec.

When the spec is a fork (see [`forkOf`](#forkof)) of a base spec, its shortname
will start with the shortname of the base spec completed by `-fork-` and the
actual shortname of the fork spec. For instance, given an exception handling
fork of the WebAssembly spec for which the raw shortname would be
`exception-handling`, the actual spec shortname will be
`wasm-js-api-1-fork-exception-handling`.

The shortname should be relatively stable but may still change over time. See
[Spec identifiers](#spec-identifiers) for details.

The `shortname` property is always set.


### `title`

The title of the spec. The title is either retrieved from the
[W3C API](https://w3c.github.io/w3c-api/) for W3C specs,
[Specref](https://www.specref.org/) or from the spec itself. The
[`source`](#source) property details the actual provenance.

The `title` property is always set.


### `shortTitle`

The short title of the spec. In most cases, the short title is generated from
`title` by dropping terms such as "Module", "Level", or "Standard". In some
cases, the short title is set manually.

The `shortTitle` property is always set. When there is no meaningful short
title, the property is set to the actual (possibly long) title of the spec.


### `categories`

An array that contains the list of categories that the spec belongs to. The only
possible value so far is `"browser"`, which means that the spec targets web
browsers.

The `categories` property is always set. Value may be an empty array for some of
the specs in the `web-specs` package. Value always contains `"browser"` for
specs in the `browser-specs` package.


### `standing`

A rough approximation of whether the spec is in good standing, meaning that,
regardless of its current status, it should be regarded as a spec that gets some
love from targeted implementers and as a spec that has some well-defined scope,
whether the spec has not yet matured enough or should only be viewed as a
collection of interesting ideas for now, or whether development of the spec has
been discontinued.

Specs for which the status is "Unofficial Proposal Draft" or "A Collection of
Interesting Ideas" typically have a standing set to `"pending"` (but there may
be exceptions).

Specs whose status is "Discontinued Draft" typically have a standing set to
`"discontinued"`.

The `standing` property is always set. Value may either be `"good"`, `"pending"`
or `"discontinued"`. Value is always `"good"` for specs in the `browser-specs`
package.


### `obsoletedBy`

An array that contains the list of shortnames of specs that replace or otherwise
obsolete the contents of a discontinued spec.

The `obsoletedBy` property is only set when `standing` is `"discontinued"`,
provided that there are indeed specs that replace the contents of the spec.


### `formerNames`

An array that contains the list of shortnames that were used to identify the
spec in the past. The property is not meant to provide an exhaustive list of all
the shortnames that a spec ever had, but just a list of the shortnames that the
spec used to have *in browser-specs*.

By definition, shortnames listed in `formerNames` properties are not *current*
shortnames. They can be used in projects that consume the list of specs to track
a specification over time.

The `formerNames` property is only set for specs that used to be known under a
different `shortname` in browser-specs.


### `series`

An object that describes the series that the spec is part of. A series includes
existing levels/versions of the spec. For instance, CSS Color Module Level 4
belongs to the same series as CSS Color Module Level 3 and CSS Color Module
Level 5.

Please note that the list only contains specs that are deemed to be
[of interest](#spec-selection-criteria). In particular, the list does not
contain levels and versions that have been fully superseded, and may not contain
early drafts of new levels and versions either.

The `series` property is always set.


#### `series.shortname`

A shortname that uniquely identifies the series. In most cases, the shortname
is the shortname of the spec without the level or version number. For instance,
the series' shortname for `css-color-5` is `css-color`. When a specification is
not versioned, the series' shortname is identical to the spec's shortname.

The `shortname` property is always set.


#### `series.currentSpecification`

The shortname of the spec that should be regarded as the current level or
version in the series. The current spec in a series is up to the group who
develops the series. In most cases, the current spec is the latest level or
version in the series that is a "full" spec (see
[`seriesComposition`](#seriescomposition)).

The `currentSpecification` property is always set.


#### `series.title`


The version-less version of the title of the spec which can be used to refer to
all specs in the series. The title is either retrieved from the
[W3C API](https://w3c.github.io/w3c-api/) for W3C specs, or derived from the
spec's [`title`](#title).

The `title` property is always set.


#### `series.shortTitle`


The short title of the series title. In most cases, the short title is generated
from [`series.title`](#seriestitle) by dropping terms such as "Module", "Level",
or "Standard". In some cases, the short title is set manually.

The `shortTitle` property is always set. When there is no meaningful short
title, the property is set to the actual (possibly long) series title.


#### `series.releaseUrl`

The URL of the latest published snapshot for the spec series. For leveled specs
(those that create a series), this matches the unversioned URL. In most cases,
that unversioned URL will return the specification identified by the
[`currentSpecification`](#seriescurrentspecification) property. It may return
an earlier level though, e.g. when the current specification has not yet been
published as a TR document.

For instance, this property will be set to `https://www.w3.org/TR/css-fonts/`
for all specifications in the CSS Fonts series.

For non-leveled specs, this matches the [`url`](#url) property.

The `releaseUrl` property is only set for W3C specs published as TR documents.


#### `series.nightlyUrl`

For leveled specs (those that create a series), this matches the unversioned URL
that allows to access the latest Editor's Draft of the current specification in
the series. That unversioned URL should return the specification identified by
the [`currentSpecification`](#seriescurrentspecification) property.

For instance, this property will be set to `https://drafts.csswg.org/css-fonts/`
for all specifications in the CSS Fonts series.

For specs that are not part of a series of specs, this matches the
[`nightly.url`](#nightlyurl) property.

The `nightlyUrl` property is always set when the [`nightly`](#nightly) property
is set.


### `seriesVersion`

The level or version of the spec, represented as an `x`, `x.y` or `x.y.z` string
with `x`, `y` and `z` numbers, and `x` always greater than or equal to `1`. For
instance, this property will have the value `1.2` (as a string, so enclosed
in `"`) for the WAI-ARIA 1.2 spec.

The `seriesVersion` property is only set for specs that have a level or version
number.


### `seriesComposition`

Whether the spec is a standalone spec, whether it is a delta spec over the
previous level or version in the series, or whether it is a temporary fork of
another spec. Possible values are `full`, `delta`, or `fork`.

The `seriesComposition` property is always set.


### `seriesPrevious`

The `shortname` of the previous spec in the series.

The `seriesPrevious` property is only set where there is a previous level or
version.


### `seriesNext`

The `shortname` of the next spec in the series.

The `seriesNext` property is only set where there is a next level or version.


### `forkOf`

The shortname of the spec that this spec is a fork of.

The `forkOf` property is only set when the spec is a fork of another one. The
[`seriesComposition`](#seriescomposition) property is always `"fork"` when the
`forkOf` property is set.

A forked specs is supposed to be temporary by nature. It will be removed from
the list as soon as it gets merged into the main spec, or as soon as it gets
abandoned.


### `forks`

An array that lists shortnames of known forks of the spec in the list.

The `forks` property is only set when there exists at least one fork of the
spec in the list, in other words when there is an entry in the list that has a
[`forkOf`](#forkof) property set to the spec's shortname.


### `organization`

The name of the standardization organization that owns the spec such as `W3C`,
`WHATWG`, `IETF`, `Ecma International`, `Khronos Group`.

The `organization` property is always set.


### `groups`

The list the groups that develop (or developed) the spec. Each item in the array
is an object with a `name` property that contains the human-readable name of the
group and a `url` property that targets the homepage of the group.

The `groups` property is always set. In most cases, a spec is developed by one
and only one group.


### `release`

An object that represents the latest published snapshot of the spec, when it
exists.

The `release` property is only set for W3C specs published as TR documents.


#### `release.url`

The URL of the latest published snapshot of the spec. Matches the versioned
URL (see [`url`](#url)).

The `url` property is always set.


#### `release.status`

The status of the latest published snapshot of the spec. See
[Documents published at W3C](https://www.w3.org/standards/types) for possible
values, e.g. "Recommendation", "Candidate Recommendation Draft", "Draft
Registry" or "Working Draft".

The `status` property is always set.


#### `release.filename`

The filename of the resource that gets served when the default URL is fetched.
For instance, the filename for `https://www.w3.org/TR/presentation-api/` is
`Overview.html`, meaning that the specification could also be retrieved from
`https://www.w3.org/TR/presentation-api/Overview.html`. The filename may be
useful to distinguish links to self in a spec.

The `filename` property is always set.


#### `release.pages`

The list of absolute page URLs when the spec is a multipage spec.

The `pages` property is only set for specs identified as multipage specs.


### `nightly`

An object that represents the latest Editor's Draft of the spec, or the living
standard when the concept of Editor's Draft does not exist.

The `nightly` property is always set unless the spec does not have a public
version available through a URL. For instance, ISO specs are not publicly
available.


#### `nightly.url`

The URL of the latest Editor's Draft or of the living standard.

The URL is either retrieved from the [W3C API](https://w3c.github.io/w3c-api/)
for W3C specs, or [Specref](https://www.specref.org/). The document at the
versioned URL is considered to be the latest Editor's Draft if the spec does
neither exist in the W3C API nor in Specref. The [`source`](#source) property
details the actual provenance.

The URL should be relatively stable but may still change over time. See
[Spec identifiers](#spec-identifiers) for details.

The `url` property is always set.


#### `nightly.status`

The status of the nightly version of the spec. This is typically "Editor's
Draft" or "Living Standard", but can also be "Draft Community Group Report"
for Community Group drafts, "Unofficial Proposal Draft" for some unofficial
CSS specifications, "Internet Standard" for IETF specifications, etc.

The `status` property is always set.


#### `nightly.alternateUrls`

A list of alternate URLs for the Editor's Draft or the living standard.

The list typically contains URLs that external sources may use to reference the
spec, be it because the canonical URL evolved over time and sources still use
old URLs (e.g. when the spec was incubated in a Community Group and transitioned
to a Working Group), or because the canonical URL is unstable for some reason
and external sources decided to use a workaround (e.g. CSS drafts).

Alternate URLs should only be used to ease mapping between external sources and
specs in `browser-specs`. The canonical URL in [`nightly.url`](#nightlyurl)
should be preferred to reference a spec otherwise.

Alternate URLs are only set when needed, in other words when an alternate URL is
effectively in use in some external source and when the external source cannot
easily be updated to use the canonical URL. In particular, the list is not meant
to be exhaustive.

The `alternateUrls` property is always set and is often an empty array.


#### `nightly.filename`

The filename of the resource that gets served when the default URL is fetched.
For instance, the filename for `https://w3c.github.io/presentation-api/` is
`index.html`, meaning that the specification could also be retrieved from
`https://w3c.github.io/presentation-api/index.html`. The filename may be
useful to distinguish links to self in a spec.

The `filename` property is always set.


#### `nightly.pages`

The list of absolute page URLs when the spec is a multipage spec.

The `pages` property is only set for specs identified as multipage specs.


#### `nightly.repository`

The URL of the repository that contains the source of the Editor's Draft or of
the living standard.

The URL is either retrieved from the [Specref](https://www.specref.org/) or
computed from `nightly.url`.

The `repository` property is always set except for IETF specs where such a repo does not always exist.


#### `nightly.sourcePath`

The relative path to the filename that contains the source of the Editor's Draft
or of the living standard at the HEAD of the default branch of the repository.

That path is computed by parsing the contents of the repository for common
patterns. The info must be specified in `specs.json` for specifications that do
not follow a common pattern.

The `sourcePath` property is always set when `repository` is set... except in
rare cases where the source of the spec is not in the default branch of the
repository.

**Note:** The path is relative to the root of the repository, and only valid in
the default branch of the repository. If needed, the source may be fetched from
the absolute HTTPS URL `${nightly.repository}/blob/HEAD/${nightly.sourcePath}`.


### `tests`

An object that links the specification with its test suite when it has one.


#### `tests.repository`

The URL of the repository that contains the test suite of the specification,
typically `https://github.com/web-platform-tests/wpt`.

The `repository` property is always set when the `tests` object is present.

#### `tests.testPaths`

The list of relative paths to the actual tests at the HEAD of the default branch
of the test repository.

For test suites within [Web Platform
Tests](https://github.com/web-platform-tests/wpt), the list is determined by
looking at `META.yml` files within each folder.

The `testPaths` array typically only contains one entry, but tests of a given
spec are sometimes spread over multiple folders. For instance, that is the case
for DOM and HTML tests.

The `testPaths` property is usually set when the `tests` object is present. When
absent, that means that the entire repository is the test suite.

#### `tests.excludePaths`

The list of relative sub-paths of paths listed in the `testPaths` property that
do not contain tests for the underlying spec. For instance, tests for the
WebXR Device API are under the
[`webxr`](https://github.com/web-platform-tests/wpt/tree/master/webxr) folder,
but several folders under `webxr` actually contain test suites for WebXR module
specs and as such need to be excluded from the test suite of the WebXR Device
API spec.

The `excludePaths` property is seldom set.


### `source`

The provenance for the `title` and `nightly` property values. Can be one of:
- `w3c`: information retrieved from the [W3C API](https://w3c.github.io/w3c-api/)
- `specref`: information retrieved from [Specref](https://www.specref.org/)
- `ietf`: information retrieved from the [IETF datatracker](https://datatracker.ietf.org)
- `spec`: information retrieved from the spec itself

The `source` property is always set.


## Spec identifiers

An entry in browser-specs contains properties that can be viewed as
identifiers: [`shortname`](#shortname), [`url`](#url), and
[`nightly.url`](#nightlyurl). Please note that these identifiers are not fully
stable.

The `shortname` property should remain mostly stable over time. The `shortname`
may still change though, for instance when a W3C specification starts being
published as a TR document with a shortname that is different from the one used
during incubation, or when an IETF specification gets published as an RFC.
Starting in July 2023, when the `shortname` of a specification changes in
browser-specs, the previous `shortname` gets added to a
[`formerNames`](#formernames) property. This makes it possible to track a
specification entry over time in browser-specs.

The `url` property contains a URL of the specification that can be regarded as
canonical and mostly stable too, but that URL will typically change when a
specification starts getting published as a formal technical document, or when
a specification transitions from one organization or group to another one.

The `nightly.url` property is the least stable identifier of a specification.
That URL may be under the control of an individual or group, who may decide to
change the URL at any time. Or it may be affected by a change of status. For
instance, the `nightly.url` property will change when a W3C spec incubated in
the Web Platform Incubator Community Group (WICG) transitions to a Working
Group, or when a new version of an IETF draft gets published.

If your project tracks specifications over time and relies on browser-specs to
gather information about these specifications, you will need to record the
`shortname` of the specifications you're tracking, and apply the following
algorithm to find the relevant specification entry in browser-specs:

1. Look for an entry in browser-specs whose `shortname` matches the recorded
shortname. If one is found, that is the relevant specification entry.
2. Look for entries in browser-specs that have the recorded shortname in its
`formerNames` property. If one is found, that is the relevant specification
entry.
3. If you found more than one entry in the previous step, that looks like a bug
in browser-specs, please [raise an
issue](https://github.com/w3c/browser-specs/issues/new).
3. If you're still looking for a relevant specification entry at this point
whereas the recorded shortname used to exist in browser-specs, that looks like
a bug in browser-specs too, please [raise an
issue](https://github.com/w3c/browser-specs/issues/new).

Shortname changes may occur in major and minor releases of npm packages but not
in patch releases.


## How to add/update/delete a spec

If you believe that a spec should be added to the list, check the [selection
criteria](#spec-selection-criteria) below and use the ["New spec" issue
template](https://github.com/w3c/browser-specs/issues/new/choose).

For other types of changes, please check [contributing
instructions](CONTRIBUTING.md).


## Spec selection criteria

This repository contains a curated list of technical Web specifications that are
deemed relevant for the Web platform. Roughly speaking, this list should match
the list of web specs actively developed by W3C, the WHATWG and a few other
organizations.

To try to make things more concrete, the following criteria are used to assess
whether a spec should a priori appear in the list:

1. The spec is stable or in development. Superseded and abandoned specs will not
appear in the list. For instance, the list contains the HTML LS spec, but not
HTML 4.01 or HTML 5).
2. The spec is being developed by a well-known standardization or
pre-standardization group. Today, this means a W3C Working Group or Community
Group, the WHATWG, the IETF, the TC39 group, the Khronos Group, the Alliance for Open Media (AOM), or ISO.
4. The spec sits at the application layer or is "close to it". For instance,
most IETF specs are likely out of scope, but some that are exposed to Web developers are in scope.
5. The spec defines normative content (terms, CSS, IDL), or it contains
informative content that other specs often need to refer to (e.g. guidelines
from horizontal activities such as accessibility, internationalization, privacy
and security).

There are and there will be exceptions to the rule. Besides, some of these
criteria remain fuzzy and/or arbitrary, and we expect them to evolve over time,
typically driven by needs expressed by projects that may want to use the list.


## Versioning

This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
with the following increment rules given a `major.minor.patch` version:
- `major`: A property disappeared, its meaning has changed, or some other
incompatible API change was made. When the `major` number gets incremented, code
that parses the list likely needs to be updated.
- `minor`: A new property was added, the list of specs changed (a new spec
added, or a spec was removed). Code that parses the list should continue to work
undisturbed, but please note that there is no guarantee that a spec that was
present in the previous version will continue to appear in the new version.
Situations where a spec gets dropped should remain scarce. If you believe that
removal of a spec should rather trigger a `major` update, please
[raise an issue](https://github.com/w3c/browser-specs/issues/new) and explain
how it affects your project.
- `patch`: Info about one or more specs changed. Minor updates were made to the
code that don't affect the list.
<!-- COMMON-BODY: end -->

## Development notes

### How to generate `index.json` manually

To re-generate the `index.json` file locally, run:

```bash
npm run build
```

**Important:** The generation process will try to retrieve information about W3C
specification from the W3C API. For that to work, the code requires the presence
of a `config.json` file in the root folder with a `GH_TOKEN` field
set to a valid [GitHub Personal Token](https://github.com/settings/tokens)
(default read permissions are enough).

Generation takes several minutes. See
[Build a restricted set of specs](#build-a-restricted-set-of-specs) and
[Build a diff of `index.json`](#build-a-diff-of-indexjson) below for
incremental tools.


### Tests

To run all tests or to test a given module locally, use one of:

```bash
npm test
npm test test/compute-shortname
```

Tests are run automatically on pull requests.


### Debugging tools

#### Lookup a spec in `index.json`

The `index.js` module can be used as a command-line interface (CLI) to quickly
look at a given spec in the `index.json` file. The command outputs the spec or
list of specs that match the provided token as a formatted JSON string.

For instance, to retrieve all specs, the Compatibility Standard spec, the
CSS Media Queries Module Level 5 spec, all delta specs, and a spec identified by
its URL, run:

```bash
node index.js
node index.js compat
node index.js mediaqueries-5
node index.js delta
node index.js https://w3c.github.io/presentation-api/
```

**Note:** The `index.js` CLI is not part of released packages, which only
contain the actual list of specifications.


#### Build a restricted set of specs

The `src/build-index.js` script can take as parameters:

1. A JSON file to use as initial list of specs. Defaults to `specs.json`
2. The name of the index file to create. Defaults to `index.json`

For instance, supposing that you have a local `test.json` file that contains a
subset of `specs.json`, you can generate the index file for that file through:

```bash
node src/build-index.js test.json test-index.json
```


#### Build a diff of `index.json`

Before you commit make changes to `specs.json`, you may want to test that these
changes will create the right information in `index.json`. Generating the whole
`index.json` file takes several minutes. The `src/build-diff.js` allows you to
only generate the index entries that match the changes made in `specs.json`.
The tool takes three parameters:

1. The name of the Git reference to use to retrieve the version of `specs.json`
that you would like to test. This can be any Git reference, such as `HEAD`,
`HEAD~1` or a commit ID. Additionally, this parameter can take the value
`working` to target the uncommitted version of the `specs.json` file in your
working folder. Defaults to `working`.
2. The name of the Git reference to use as basis for the comparison. This can
again be any Git reference such as `HEAD`, `HEAD~1` or a commit ID. This cannot
be `working` though. Defaults to `HEAD`.
3. The type of result that you would like to get. Value can either be `diff` to
return a JSON object that lists generated entries under `added`, `updated` and
`deleted` properties; or `full` to return the result of merging the changes in
the base version of the `index.json` file. Defaults to `diff`.

For instance, let's say that you made some changes to your local `specs.json`
file, which you have not committed yet, the following command will return the
entries that these changes would generate (parameters may be omitted since they
match the default values):

```bash
node src/build-diff.js working HEAD diff
```

This could return something like (output truncated to better show the outline):

```json
{
  "added": [
    {
      "url": "https://dom.spec.whatwg.org/",
      "seriesComposition": "full",
      "shortname": "dom",
      "...": "..."
    }
  ],
  "updated": [
    {
      "url": "https://compat.spec.whatwg.org/",
      "seriesComposition": "full",
      "shortname": "compat",
      "...": "..."
    }
  ],
  "deleted": [
    {
      "url": "https://console.spec.whatwg.org/",
      "seriesComposition": "full",
      "shortname": "console",
      "...": "..."
    }
  ]
}
```

If you rather wanted to update your local version of `index.json` so as to run a
`git diff` command afterwards to spot differences more easily, you could run:

```bash
node src/build-diff.js working HEAD full > index.json
git diff index.json
```

**Important:** The script only generates the new information for specs that
have changed in `specs.json`. A full build of `index.json` could bring further
updates to other entries if spec info has changed in the meantime. The script
is only intended to be used for debugging to assess changes in the initial list
of specs.


### How to release a new version

Releases are semi-automated through GitHub workflows. Whenever the list of specs
is updated on the main branch, pre-release pull requests are created with the
diff to release as description. Merging these pull requests releases the new
version of NPM packages.
