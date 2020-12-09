# Web browser specifications

This repository contains a curated list of technical Web specifications that are
directly implemented or that will be implemented by Web browsers (see [Spec
selection criteria](#spec-selection-criteria)).

This list is meant to be an up-to-date input source for projects that run
analyses on browser technologies to create reports on test coverage,
cross-references, WebIDL, quality, etc.


## Table of Contents

- [Installation and usage](#installation-and-usage)
- [Spec object](#spec-object)
  - [`url`](#url)
  - [`shortname`](#shortname)
  - [`title`](#title)
  - [`shortTitle`](#shorttitle)
  - [`series`](#series)
    - [`series.shortname`](#seriesshortname)
    - [`series.currentSpecification`](#seriescurrentspecification)
  - [`seriesVersion`](#seriesversion)
  - [`seriesComposition`](#seriescomposition)
  - [`seriesPrevious`](#seriesprevious)
  - [`seriesNext`](#seriesnext)
  - [`release`](#release)
    - [`release.url`](#releaseurl)
    - [`release.filename`](#releasefilename)
    - [`release.pages`](#releasepages)
  - [`nightly`](#nightly)
    - [`nightly.url`](#nightlyurl)
    - [`nightly.filename`](#nightlyfilename)
    - [`nightly.pages`](#nightlypages)
    - [`nightly.repository`](#nightlyrepository)
  - [`source`](#source)
- [How to add/update/delete a spec](#how-to-addupdatedelete-a-spec)
- [Spec selection criteria](#spec-selection-criteria)
- [Versioning](#versioning)
- [Development notes](#development-notes)
  - [How to generate `index.json` manually](#how-to-generate-indexjson-manually)
  - [Debugging tool](#debugging-tool)
  - [Tests](#tests)
  - [How to release a new version](#how-to-release-a-new-version)


## Installation and usage

The list is distributed as an NPM package. To incorporate it to your project,
run:

```bash
npm install browser-specs
```

You can then retrieve the list from your Node.js program:

```js
const specs = require("browser-specs");
console.log(JSON.stringify(specs, null, 2));
```

Alternatively, you can either retrieve the [latest
release](https://github.com/w3c/browser-specs/releases/latest) or fetch
[`index.json`](https://w3c.github.io/browser-specs/index.json).

**Note:** If you choose to fetch the `index.json` file directly, keep in mind
that it may contain (possibly incorrect) updates that have not yet been included
in the NPM package and the latest GitHub release (see also #38).


## Spec object

Each specification in the list comes with the following properties:

```json
{
  "url": "https://www.w3.org/TR/css-color-4/",
  "shortname": "css-color-4",
  "title": "CSS Color Module Level 4",
  "shortTitle": "CSS Color 4",
  "series": {
    "shortname": "css-color",
    "currentSpecification": "css-color-4"
  },
  "seriesVersion": "4",
  "seriesComposition": "full",
  "seriesPrevious": "css-color-3",
  "seriesNext": "css-color-5",
  "release": {
    "url": "https://www.w3.org/TR/css-color-4/",
    "filename": "Overview.html"
  },
  "nightly": {
    "url": "https://drafts.csswg.org/css-color/",
    "repository": "https://github.com/w3c/csswg-drafts",
    "filename": "Overview.html"
  },
  "source": "w3c"
}
```


### `url`

The versioned (but not dated) URL for the spec. For W3C specs published as
TR documents, this is the TR URL. For WHATWG specs, this is the URL of the
living standard. In other cases, this is the URL of the latest Editor's Draft.

The `url` property is always set.


### `shortname`

A shortname that uniquely identifies the spec in the list. The value matches the
"well-known" shortname of the spec, that usually appears in the versioned URL.
For instance, for W3C specs published as TR documents, this is the TR shortname.
For WHATWG specs, this is the shortname that appears at the beginning of the URL
(e.g. `compat` for `https://compat.spec.whatwg.org/`). For specs developed on
GitHub, this is usually the name of repository that holds the spec.

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


### `seriesVersion`

The level or version of the spec, represented as an `x`, `x.y` or `x.y.z` string
with `x`, `y` and `z` numbers, and `x` always greater than or equal to `1`. For
instance, this property will have the value `1.2` (as a string, so enclosed
in `"`) for the WAI-ARIA 1.2 spec.

The `seriesVersion` property is only set for specs that have a level or version
number.


### `seriesComposition`

Whether the spec is a standalone spec, or whether it is a delta spec over the
previous level or version in the series. Possible values are `full` or `delta`.

The `seriesComposition` property is always set.


### `seriesPrevious`

The `shortname` of the previous spec in the series.

The `seriesPrevious` property is only set where there is a previous level or
version.


### `seriesNext`

The `shortname` of the next spec in the series.

The `seriesNext` property is only set where there is a next level or version.


### `release`

An object that represents the latest published snapshot of the spec, when it
exists.

The `release` property is only set for W3C specs published as TR documents.


#### `release.url`

The URL of the latest published snapshot of the spec. Matches the versioned
URL (see [`url`](#url)).

The `url` property is always set.


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

The `nightly` property is always set.


#### `nightly.url`

The URL of the latest Editor's Draft or of the living standard.

The URL is either retrieved from the [W3C API](https://w3c.github.io/w3c-api/)
for W3C specs, or [Specref](https://www.specref.org/). The document at the
versioned URL is considered to be the latest Editor's Draft if the spec does
neither exist in the W3C API nor in Specref. The [`source`](#source) property
details the actual provenance.

The `url` property is always set.


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

The `repository` property is always set.


### `source`

The provenance for the `title` and `nightly` property values. Can be one of:
- `w3c`: information retrieved from the [W3C API](https://w3c.github.io/w3c-api/)
- `specref`: information retrieved from [Specref](https://www.specref.org/)
- `spec`: information retrieved from the spec itself

The `source` property is always set.


## How to add/update/delete a spec

If you believe that a spec should be added, modified, or removed from the list,
or if you would like to otherwise contribute to this project, please check
[contributing instructions](CONTRIBUTING.md).


## Spec selection criteria

This repository contains a curated list of technical Web specifications that are
deemed relevant for Web browsers. Roughly speaking, this list should match the
list of specs that appear in projects such as [Web Platform
Tests](https://github.com/web-platform-tests/wpt) or
[MDN](https://developer.mozilla.org/).

To try to make things more concrete, the following criteria are used to assess
whether a spec should a priori appear in the list:

1. The spec is stable or in development. Superseded and abandoned specs will not
appear in the list. For instance, the list contains the HTML LS spec, but not
HTML 4.01 or HTML 5).
2. The spec is being developed by a well-known standardization or
pre-standardization group. Today, this means a W3C Working Group or Community
Group, the WHATWG, or the Khronos Group.
3. Web browsers expressed some level of support for the spec, e.g. through a
public intent to implement.
4. The spec sits at the application layer or is "close to it". For instance,
IETF specs are essentially out of scope, at least for now.
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


## Development notes

### How to generate `index.json` manually

To re-generate the `index.json` file locally, run:

```bash
npm run build
```

**Important:** The generation process will try to retrieve information about W3C
specification from the W3C API. For that to work, the code requires the presence
of a `config.json` file in the root folder with a `w3cApiKey` field set to a
valid [W3C API key](https://w3c.github.io/w3c-api/).


### Tests

To run all tests or to test a given module locally, use one of:

```bash
npm test
npm test test/compute-shortname
```

Tests are run automatically on pull requests.


### Debugging tool

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

**Note:** The `index.js` CLI is not part of the released package, which only
contains the actual list of specifications.


### How to release a new version

Provided that you have the appropriate admin rights and that a `GITHUB_TOKEN`
environment variable is set to a [GitHub Personal
Token](https://github.com/settings/tokens) with `repo` rights, you may release a
new version through the following command, to be run from an up-to-date local
`master` branch:

```bash
npm run release
```

The release command should take care of everything including incrementing the
version number, updating the [changelog](CHANGELOG.md), creating a GitHub
Release, and publishing a new NPM package. The command is interactive and will
ask you to confirm the different steps. Please check the [versioning
rules](#versioning) to select the right version part to increment!