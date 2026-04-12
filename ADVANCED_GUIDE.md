# Advanced Guide — Think

This is the second-track manual for Think. Use it when you need the deeper doctrine behind the graph model, the derivation pipeline, or repository-wide engineering standards.

For orientation and the productive-fast path, use the [GUIDE.md](./GUIDE.md).

## Graph-Native Doctrine

Think uses a "window-based" read model to ensure the TUI remains responsive even as your archive grows to thousands of entries.

- **No Whole-Graph Materialization**: Commands like `browse` and `remember` use `git-warp` read handles to query specific worldline slices.
- **Checkpoint-Backed Reuse**: The browse TUI uses checkpoints to avoid redundant traversal of chronological neighbors.
- **Immutable Raw Layer**: The core Git repository is the system of record. Raw thoughts are never modified after capture.

## Derivation Pipeline

Interpretation happens after the "trapdoor" closes. Think's derivation stack is append-only:

1. **Raw Capture**: Immutable text + ambient context.
2. **Canonical Identity**: Content-addressed fingerprint (`thought:<sha256>`).
3. **Interpretive Artifacts**: Fast, deterministic metadata (e.g., `seed_quality`).
4. **Contextual Artifacts**: Relational metadata (e.g., `session_attribution`).
5. **Operational Descendants**: Resulting thoughts from `reflect` sessions.

## Performance & Benchmarks

Capture latency is a non-negotiable target. We measure the "Warm-Path" to ensure that repeat captures remain sub-second.

- **Current Baseline**: ~350ms (Median).
- **Run Benchmarks**: `npm run test:benchmarks`.
- **Latency Tracking**: Use `think --prompt-metrics` to inspect real-world panel telemetry.

## Monorepo Orchestration

Think is organized as a multi-platform engine:

| Module | Role | Bedrock |
| :--- | :--- | :--- |
| **`src/store/`** | Graph logic, migration, and storage | Git / WARP |
| **`src/cli/`** | Human/Agent command orchestration | Node.js |
| **`src/mcp/`** | Agentic tool provider | MCP SDK |
| **`macos/`** | High-fidelity native ingress | Swift 6 / Alfred |

## Contributing

Think follows the **METHOD** doctrine.
- **Backlog Lanes**: `asap/`, `up-next/`, `cool-ideas/`.
- **The Cycle Loop**: Red → Green → Retro.
- **Naming Convention**: `<LEGEND>_<slug>.md`.

---
**The goal is inevitably. Every feature is defined by its tests.**
