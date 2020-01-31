# Web browser specifications

This repository contains a curated list of technical Web specifications that are directly implemented or that will be implemented by Web browsers.

This list is meant to be an up-to-date input source for projects that run analyses on browser technologies to create reports on test coverage, cross-references, WebIDL, quality, etc.

## Format

`specs.json` contains an array of items that are either:
1. a string that represents a valid URL;
2. an object with a `url` property (additional properties to be added over time as needed)

In most cases, a URL should be enough. As such, to keep the file readable by human beings, the string format should be preferred whenever possible. The object format should only be used when additional properties need to be specified.

Tools that want to ingest the list are encouraged to use the `specs` array exported by the `index.js` file, which contains a normalized version of the list in `specs.json` where each entry is an object with a `url` property to ease processing.

## Linting

Run `node lint` to identify potential linting issues (automatically done for pull requests).

Run `node lint --fix` to overwrite `specs.json` locally with the linted version.
