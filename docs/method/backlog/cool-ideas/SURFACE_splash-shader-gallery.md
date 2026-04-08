# Splash shader gallery — multiple animated backgrounds

The splash screen currently has one shader (trigonometric warp + density mapping). The infrastructure supports swapping shaders trivially since `shaderFrame()` is a pure function.

Build a small gallery of shaders and cycle between them — either randomly on each launch, or via a key to preview alternatives. Ideas:
- **Ripple** — concentric rings emanating from the brain center
- **Rain** — matrix-style code rain falling through the head
- **Starfield** — parallax star dots drifting through the silhouette
- **Plasma** — classic plasma effect with slow color cycling
- **Noise flow** — Perlin/simplex noise field with directional drift
- **Heartbeat** — radial pulse that expands and contracts rhythmically

Could also support user-selectable splash shader via a config option.
