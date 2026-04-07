# CLI parsing still depends on one large options bag

`src/cli/options.js` builds a large procedural options object and validates it later through command-specific conditionals.

The result is serviceable but structurally mushy. Parsing and validation should return a smaller, more explicit runtime-backed parsed-command form.
