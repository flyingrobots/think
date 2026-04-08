# Create a custom bijou theme for the Think warm palette

The browse TUI currently bypasses bijou's theming system — `style.js` uses hardcoded truecolor ANSI codes for the warm palette (plum bg, cream text, teal titles, amber headers, mauve dim). This works but means bijou components (drawer borders, modal frames, command palette highlights) use bijou's default theme colors, not Think's palette.

Define a proper bijou theme that maps the warm palette to bijou's token vocabulary:
- `semantic.accent` → teal (#41b797)
- `semantic.muted` → mauve (#7b5770)
- `semantic.primary` → cream (#fffcc9)
- `ui.sectionHeader` → amber (#eda126)
- `surface.primary` → plum bg (#2d1922)
- `surface.overlay` → slightly lighter plum for drawers/modals
- `border.primary` → cream or mauve

This would make bijou's built-in components (drawer chrome, modal borders, command palette, help views) automatically respect Think's visual identity. Also enables `ctx.style.styled()` to work correctly in style.js instead of the ANSI fallback path.
