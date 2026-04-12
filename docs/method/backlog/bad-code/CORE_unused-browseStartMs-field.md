# Unused browseStartMs field in windowed model

`browseStartMs` was added to the windowed browse model during cycle
0004 for a fade-in approach that was later replaced. The field is set
in `createWindowedBrowseModel` but never read. Remove it.
