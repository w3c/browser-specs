# Intermediary files on the way to `index.json`

This folder holds **intermediary files** created on the way to building the main
`index.json` file.

Except for debugging, **these intermediary files are essentially useless**.

When a build fails, these intermediary files may be used:

1. To quickly restart the build at the step that failed, hopefully skipping
steps that may take a few minutes.
2. To view the index file that was generated without having to re-run the build
locally when the build failed at the testing phase (a common case), avoiding a
~10 minutes build.
