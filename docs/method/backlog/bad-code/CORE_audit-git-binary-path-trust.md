# Git execution still trusts ambient PATH lookup

Think invokes `git` by bare command name from `src/project-context.js` and `src/git.js`.

That is acceptable for a local developer tool until it is not. The repo should resolve and trust one Git binary intentionally instead of inheriting whatever PATH happens to provide.
