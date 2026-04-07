# CLI dispatch is still a stringly `if/else` ladder

The top-level CLI command path in `src/cli.js` is still an `if/else` dispatch chain keyed by strings.

It works, but it keeps command behavior, help identity, and reporting identity softer than they should be.
