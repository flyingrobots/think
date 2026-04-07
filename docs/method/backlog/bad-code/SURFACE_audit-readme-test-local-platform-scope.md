# README does not mark `test:local` as Darwin-only

`README.md` presents `npm run test:local` as a generic verification command, but `package.json` and `CONTRIBUTING.md` make clear that it includes the macOS Swift suite and is Darwin-only.

This is a small docs bug, but it is the kind that wastes contributor time immediately.
