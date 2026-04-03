# CORE

The capture path, storage substrate, and graph infrastructure.

## What it covers

- Raw thought capture — the sacred write path that must stay cheap and immediate
- Local WARP/Git-backed graph storage and the append-only entry contract
- Graph model versioning, migration, and derivation pipeline
- Upstream backup — push-after-local-success replication
- Content addressing, session attribution, and canonical thought identity
- Ambient context capture (cwd, git remote, branch)

## Who cares

Everyone. CORE is the foundation that every surface and read mode depends on. If CORE breaks, nothing works.

## What success looks like

- Capture remains sub-second on a warm path.
- Raw entries are immutable after write.
- Local save never depends on network.
- Graph migrations are additive and safe to rerun.
- Provenance is honest and inspectable.

## How you know

- Acceptance tests cover the capture contract, upstream backup, graph migration, and entry immutability.
- Latency benchmarks detect regressions.
- No Git terminology leaks into user-facing output.

## Historical milestones

- M1: Capture core and upstream backup
- M4: Graph-native browse/read refactor, v3 read-edge substrate
