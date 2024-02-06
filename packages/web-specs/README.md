# Web browser specifications

This repository contains a curated list of technical Web specifications.

This list is meant to be an up-to-date input source for projects that run
analyses on web technologies to create reports on test coverage,
cross-references, WebIDL, quality, etc.


## Table of Contents

- [Installation and usage](#installation-and-usage)
- [Upgrading](#upgrading)
<!-- COMMON-TOC: start --><!-- COMMON-TOC: end -->
- [Spec selection criteria](#spec-selection-criteria)


## Installation and usage

The list is distributed as an NPM package. To incorporate it to your project,
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

## Upgrading

The only breaking change in version `3.x` is that some spec entries may not
have a `nightly` property. This happens for specs that are not public. An
example of a non public spec is an ISO standard. In such cases, the `url`
property targets the public page that describes the spec on the standardization
organization's web site. To upgrade from version `2.x` to version `3.x`, make
sure that your code can handle specs without a `nightly` property.

<!-- COMMON-BODY: start -->
<!-- COMMON-BODY: end -->

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
Group, the WHATWG, the IETF, the TC39 group or the Khronos Group.
4. The spec sits at the application layer or is "close to it". For instance,
most IETF specs are likely out of scope, but some that are exposed to Web developers are in scope.
5. The spec defines normative content (terms, CSS, IDL), or it contains
informative content that other specs often need to refer to (e.g. guidelines
from horizontal activities such as accessibility, internationalization, privacy
and security).

There are and there will be exceptions to the rule. Besides, some of these
criteria remain fuzzy and/or arbitrary, and we expect them to evolve over time,
typically driven by needs expressed by projects that may want to use the list.