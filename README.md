# Think

An industrial-grade thought-capture engine for coding work. Think records raw ideas the moment they appear—before structure, before categories, before you forget.

Think is designed for the operator who demands a stable foundation for their cognitive worldline. It scales from sub-second local capture to high-fidelity structural reflection across multi-mind archives.

[![License](https://img.shields.io/github/license/think)](./LICENSE)

![Think demo](./docs/demo.gif)

## Why Think?

Unlike traditional note-taking apps that prioritize organization over ingestion, Think prioritizes the sanctity of the raw capture moment.

- **Capture must be cheap**: The capture path is a trapdoor. Raw text in, immutable entry out. No embeddings, no tagging, and no retrieval-before-write to slow you down.
- **Local-First Bedrock**: Your thoughts live in a private Git-backed repository on your machine. Local save never depends on network success; backup is a best-effort follow-through.
- **Geometric Lawfulness**: The terminal is the primary operating surface. Think treats your thoughts as a layered worldline of raw entries and derived artifacts.
- **Structural Re-entry**: Browse with a window-based TUI, recall with bounded search, and pressure-test ideas through structured prompt families (Reflect).

## Quick Start

### 1. Local Setup
Clone, install dependencies, and capture your first thought.
```bash
npm install
node ./bin/think.js "first captured thought"
```

### 2. Fast Ingress
Capture thoughts via CLI, stdin, or the macOS global hotkey (`Cmd+Shift+I`).
```bash
think "turkey is good in burritos"
printf 'piped input\n' | think --ingest
```

### 3. High-Fidelity Browse
Open the reader-first TUI to navigate your cognitive worldline.
```bash
think --browse
```

## Documentation

- **[Guide](./GUIDE.md)**: Orientation, the fast path, and mind management.
- **[Advanced Guide](./ADVANCED_GUIDE.md)**: Deep dives into the graph model, derivation pipeline, and benchmarks.
- **[Architecture](./docs/ARCHITECTURE.md)**: The authoritative structural reference (Git, WARP, Minds).
- **[Vision](./docs/VISION.md)**: Core tenets and the capture doctrine.
- **[Method](./docs/method/process.md)**: Repo work doctrine and the cycle loop.

---
Built with cognitive ambition by [FLYING ROBOTS](https://github.com/flyingrobots)
