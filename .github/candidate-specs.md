---
title: New specs for review
assignees: tidoust, dontcallmedom
labels: enhancement
---
[find-specs](src/find-specs.js) has identified the following candidates as potential new specs to consider:

{{ env.candidate_list }}

Please review if they match the inclusion criteria. Those that don't and never will should be added to [ignore.json](src/data/ignore.json), those that don't match yet but may in the future can be added to [monitor-repo.json](src/data/monitor-repos.json), and those that do match should be brought as a pull request on [specs.json](specs.json).