# README install requirements omit Git

`README.md` lists Node.js and the optional macOS toolchain as requirements, but Think shells out to `git` for storage, ambient context, and backup.

`docs/GUIDE.md` already says Git is required. The top-level README should not let a user satisfy the published requirements and still fail on the first real capture.
