# Migrate browse TUI onto bijou's runtime engine

Bijou 4.1.0–4.2.0 shipped a full runtime engine stack (RE-001 through RE-007): state machines, view stacks, retained layout trees, layout-driven input routing, buffered commands/effects, and the framed shell migration. The browse TUI currently uses the low-level `run()` TEA loop directly.

Migrating to `createFramedApp()` and the runtime engine seams would give us:
- Retained layout trees for hit-testing (future mouse support)
- View stack for modal/drawer management (instead of manual panelMode tracking)
- Shell-agnostic input routing through layouts
- Built-in page transitions via the transition shader system (replace our manual splash transition)
- Buffered commands and effects with proper cleanup handles

This is a non-trivial migration but would align Think's TUI with bijou's intended architecture and unlock future capabilities (mouse, multi-page, settings drawer, etc.).
