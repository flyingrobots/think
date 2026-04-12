# CI-001 — Thought Heatmap Visualizer

Legend: [SURFACE — User Surfaces](../../legends/SURFACE.md)

## Idea

Implement a high-fidelity visualizer in the TUI splash screen or a dedicated page that shows a "Heatmap" of cognitive activity. It should use Bijou's braille-chart or sparkline primitives to show:
- Frequency of capture over time.
- Clusters of related thoughts (based on ambient project token overlap).
- Reflection density.

## Why

1. **Self-Reflection**: Provides the user with a spatial and temporal view of their "cognitive worldline" immediately upon opening the app.
2. **Engagement**: Makes the TUI feel "alive" and reactive to the depth of the archive.
3. **Data-Viz Maturity**: Showcases Think as a sophisticated analytical bedrock, not just a raw log.

## Effort

Medium-Large — requires a spatial layout engine for thought clusters and integration with Bijou's animated surfaces.
