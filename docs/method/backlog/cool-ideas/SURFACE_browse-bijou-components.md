# Use bijou's higher-level components in the browse TUI

The browse TUI currently builds its panels from raw `viewport`/`flex` primitives and hand-rolled text formatting. Bijou 4.x has purpose-built components that could replace several of these:

- **Inspector panel** → `inspector()` / `inspectorSurface()` — designed for exactly this (key-value metadata with labels)
- **Session panel** → `stepper()` / `stepperSurface()` or `timeline()` — session entries as a progression
- **Log panel** → `browsableList()` / `browsableListSurface()` — scrollable list with focus tracking, built-in viewport
- **Jump palette** → already using `commandPalette`, could upgrade to `commandPaletteSurface` with ctx
- **Thought content** → `accordion()` for collapsible THOUGHT / NEIGHBORS / SESSION sections
- **Help line** → `helpShortSurface()` for surface-native help rendering
- **Reflect modal** → `modal()` already used, but body could use `textarea()` for the response editor

This would reduce custom rendering code and get better keyboard/scroll behavior for free.
