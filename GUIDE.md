# Guide — Think

This is the developer-level operator guide for Think. Use it for orientation, the productive-fast path, and to understand how the thought-capture engine orchestrates your cognitive worldline.

For deep-track doctrine, graph model internals, and repository-wide engineering standards, use [ADVANCED_GUIDE.md](./ADVANCED_GUIDE.md).

## Choose Your Lane

### 1. Local Setup & First Capture
Bootstrap your private thought repository and record your first idea.
- **Run**: `npm install && node ./bin/think.js "first thought"`
- **Read**: [README Quick Start](./README.md#quick-start)

### 2. Fast Ingress (Human & Agent)
Capture thoughts through the most efficient path for your current context.
- **Human (macOS)**: Use the global hotkey `Cmd+Shift+I`.
- **Human (CLI)**: `think "my thought"`
- **Agent (MCP)**: Call the `capture` tool.
- **System**: `printf 'piped input\n' | think --ingest`

### 3. Re-entry & Navigation
Return to your archive through high-fidelity browse or context-aware recall.
- **Browse**: `think --browse` (Reader-first TUI)
- **Recall**: `think --remember` (Ambient project-aware search)
- **Inspect**: `think --inspect=<entryId>` (Exact metadata and receipts)

### 4. Pressure-Testing (Reflect)
Move beyond simple capture by challenging your ideas through structured prompt families.
- **Run**: `think --reflect`
- **Modes**: `challenge`, `constraint`, `sharpen`

## Big Picture: System Orchestration

Think is a tiered engine designed to keep capture cheap while enabling rich re-entry:

1. **Ingress Surfaces (Surfaces)**: The CLI, macOS app, and MCP server are thin interfaces that communicate with the core logic. They ensure that capture is always a "trapdoor" experience.
2. **Think Store (The Bedrock)**: Manages the private Git repository, WARP graph indexing, and derivation pipeline. It ensures that raw thoughts are immutable and derived artifacts are inspectable.
3. **WARP (Memory)**: The Structural Worldline Memory that tracks the evolution of your thoughts and their relationships over time without requiring whole-graph materialization.

## Orientation Checklist

- [ ] **I am setting up a new machine**: Start with `README.md` Quick Start.
- [ ] **I want to separate my agent's thoughts**: Use `THINK_REPO_DIR` in an agent wrapper script.
- [ ] **I need to backup my archive**: Configure `THINK_UPSTREAM_URL`.
- [ ] **I am debugging the TUI**: Start with `ADVANCED_GUIDE.md`.
- [ ] **I am contributing to Think**: Read `docs/method/process.md` and `docs/BEARING.md`.

## Rule of Thumb

If you need a comprehensive command reference, use the [README CLI section](./README.md#cli-reference).

If you need to know "what's true right now," use [docs/BEARING.md](./docs/BEARING.md).

If you are just starting, use the [README.md](./README.md) and the orientation tracks above.

---
**The goal is to move the terminal from a collection of widgets to a professional application bedrock for your cognitive history.**
