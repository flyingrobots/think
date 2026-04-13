---
id: SURFACE_fadeInBrowse-throwaway-model
blocks: []
blocked_by: []
---

# fadeInBrowse creates a throwaway model to render

`fadeInBrowse()` in `src/browse-tui/app.js` constructs a full
`createWindowedBrowseModel` just to call `renderBrowseModel` for
the fade-in frames, then discards it. The real model is built
separately by `createBrowsePage`. This couples the fade to the
model shape and does redundant work.

The fade should accept pre-rendered content or share the model
with the page initialization.
