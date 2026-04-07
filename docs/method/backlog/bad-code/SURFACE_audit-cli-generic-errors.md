# CLI still hides too much behind a generic top-level error

`src/cli.js` catches unexpected failures and tells the default human path only `Something went wrong`.

That keeps output terse, but it also weakens self-serve recovery and makes production debugging slower than necessary.
