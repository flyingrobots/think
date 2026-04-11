# Consolidate BG_TOKEN definition

`BG_TOKEN` is defined identically in both `src/browse-tui/view.js` and
`src/browse-tui/overlays.js`. Both convert palette RGB values to hex
format for surface composition. Move the definition into `style.js`
(where the palette already lives) and import from there.
