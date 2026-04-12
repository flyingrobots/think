# Reusable terminal fade-in utility

`fadeInBrowse()` rebuilds the browse model just to render it, then
discards it. The color-lerp-and-write logic is tightly coupled to
one call site. Extract a generic `fadeInContent(lines, palette, opts)`
that can fade any ANSI content from bg to visible. Useful for future
transitions (mind switch, page change).
