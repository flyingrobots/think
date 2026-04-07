# Browse TUI is still a large switch-heavy monolith

`src/browse-tui.js` is the heaviest JS file in the repo and concentrates reducer logic, rendering, script normalization, key handling, and panel logic in one place.

The feature is valuable. The file shape is not.
