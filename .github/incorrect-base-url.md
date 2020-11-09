---
title: New specs for review
assignees: tidoust, dontcallmedom
labels: bug
---
[check-base-url](../blob/master/src/check-base-url.js) has detected that the base URL of the following specifications is not the expected one:

{{ env.check_list }}

Please review the above list. For each specification, consider updating the URL in [specs.json](../blob/master/specs.json) or fixing the info at the source (the W3C API, Specref, or the spec itself). If the discrepancy seems warranted, the specification should be hardcoded as an exception to the rule in the [check-base-url](../blob/master/src/check-base-url.js) script.