# AUDIT: Runtime Truth Code Standard Baseline (2026-05-13)

## Scope

This audit applies the updated `docs/INFRASTRUCTURE_DOCTRINE.md` to the
current Think codebase after PR #14 was merged to `main`.

The audit used the Git index as the repository manifest, not an ad hoc
filesystem walk.

Code inventory from `git ls-files`:

| Area | Count |
| --- | ---: |
| JavaScript files | 116 |
| MJS scripts | 2 |
| Swift files | 36 |
| TypeScript files | 0 |
| Source and scripts | 94 |
| Tests | 55 |
| Benchmarks | 3 |

## Commands Used

```sh
git ls-files '*.js' '*.mjs' '*.cjs' '*.ts' '*.tsx' '*.swift'
git ls-files '*.[jt]s' '*.mjs' '*.cjs' '*.ts' '*.tsx' '*.swift' | xargs wc -l
npx eslint . \
  --rule 'max-lines:["error",1000]' \
  --rule 'max-lines-per-function:["error",{"max":35,"skipBlankLines":true,"skipComments":true}]' \
  --rule 'max-depth:["error",4]' \
  --rule 'max-params:["error",5]' \
  --rule 'complexity:["error",8]' \
  --rule 'max-statements:["error",25]' \
  --format json
rg -n 'throw new Error\(' src bin scripts --glob '*.{js,mjs}'
rg -n "from 'node:(fs|fs/promises|child_process|os|path|url)'|from '@git-stunts|from '@modelcontextprotocol|from 'zod'" src bin scripts --glob '*.{js,mjs}'
swift test --package-path macos --list-tests
```

`swift test --package-path macos --list-tests` built the Swift package and
listed the macOS tests successfully.

## Executive Summary

Think already has strong runtime-truth instincts: explicit domain error
classes, immutable model objects in important paths, focused test
coverage, and real port seams in parts of the macOS adapter and store.

The repo does not yet meet the updated doctrine as a hard standard. The
highest-risk gaps are architectural, not cosmetic:

- Core-ish store modules still import concrete WARP/Git/Node adapters.
- CLI and MCP services discover process state directly instead of
  receiving dependencies from composition roots.
- Codec and serialization work is mixed into store/domain modules.
- Large command and TUI functions exceed the strict complexity limits by
  large margins.
- The linter does not yet enforce the new doctrine; a ratchet is needed
  before the limits can become a hard CI gate.

This audit is a baseline. It should drive backlog work, not normalize the
violations.

## Mechanical Limit Results

Applying the proposed strict JavaScript ESLint size and complexity rules
without committing them produced:

| Metric | Count |
| --- | ---: |
| Files with violations | 47 |
| Total violations | 195 |
| Source/script/benchmark files with violations | 36 |
| Source/script/benchmark violations | 150 |
| Test files with violations | 11 |
| Test violations | 45 |

Violations by rule:

| Rule | Total |
| --- | ---: |
| `max-lines-per-function` | 93 |
| `complexity` | 59 |
| `max-statements` | 28 |
| `max-depth` | 11 |
| `max-params` | 3 |
| `max-lines` | 1 |

Largest files:

| Lines | File | Status |
| ---: | --- | --- |
| 1537 | `test/acceptance/read-modes.test.js` | Violates hard 1000-line limit |
| 934 | `src/cli/commands/read.js` | Below hard limit, above 600-line target |
| 813 | `scripts/repair-v17-mind.mjs` | Below hard limit, above 600-line target |
| 679 | `test/acceptance/graph-migration.test.js` | Below hard limit, above 600-line target |
| 567 | `src/store/runtime.js` | Near 600-line target |

Highest-density strict-rule hotspots:

| Violations | File | Main issue |
| ---: | --- | --- |
| 17 | `src/cli/commands/read.js` | Command orchestration, TUI launch, browse script handling |
| 17 | `src/splash-shader.js` | Rendering math and frame composition in one module |
| 15 | `test/acceptance/read-modes.test.js` | Oversized acceptance fixture suite |
| 9 | `src/store/queries.js` | Read/query branching and traversal complexity |
| 8 | `scripts/repair-v17-mind.mjs` | Repair workflow orchestration in one script |
| 8 | `src/cli/options.js` | Parsing and validation complexity |
| 8 | `src/store/runtime.js` | Concrete WARP runtime orchestration |
| 5 | `src/store/enrichment/runner.js` | Multi-artifact enrichment pipeline |
| 4 | `src/store/migrations.js` | Graph migration orchestration |

## Findings

### F1. Doctrine is documented, but enforcement is not active

Severity: High

Evidence:

- `eslint.config.js` currently enforces many safety rules, but not the
  new size/complexity limits.
- The TypeScript-specific rules in the doctrine cannot run because the
  repository currently has no TypeScript source or `@typescript-eslint`
  setup.
- The strict JavaScript profile reports 195 current violations.

Impact:

The standard is now normative, but CI will not stop new drift unless the
repo adds a ratchet. Without a ratchet, new work can add more violations
while old debt remains invisible.

Required direction:

- Add a ratcheted strict-limits report.
- Fail new or worsened violations first.
- Convert ratchet to full hard gate after the hotspots are split.

Backlog:

- `CORE_runtime-truth-standard-ratchet`

### F2. Store modules are not clean hexagonal core

Severity: High

Evidence:

- `src/store/runtime.js` imports `@git-stunts/plumbing` and
  `@git-stunts/git-warp` directly.
- `src/store/checkpoint-state.js` imports concrete WARP/Git adapters
  directly.
- `src/store/model.js` imports `node:crypto`, `node:os`, reads
  `process.env.THINK_TEST_NOW`, and uses `crypto.randomUUID()` through a
  default global port object.
- `src/store/queries.js` defaults `cwd = process.cwd()`.
- `src/store/prompt-metrics.js` imports `node:fs/promises`.

Impact:

The current store layer is partly domain and partly adapter. It works,
but it cannot honestly claim browser-portable core semantics. Runtime
truth is anchored to Node and WARP concrete implementations too early.

Required direction:

- Define explicit ports for WARP graph access, content storage, clocks,
  random IDs, host metadata, prompt metrics storage, and ambient project
  context.
- Move concrete WARP/Git/Node adapters into composition roots.
- Keep store/domain functions operating on injected ports and runtime
  domain objects.

Backlog:

- `CORE_hexagonal-store-boundary`

### F3. MCP service uses globals and direct imports instead of DI

Severity: High

Evidence:

- `src/mcp/service.js` imports `paths`, `git`, `policies`,
  `project-context`, and the store facade directly.
- `captureThought()` reads `process.cwd()` during capture and follow-up.
- `rememberThoughtsForMcp()` defaults `cwd = process.cwd()`.
- `src/mcp/server.js` constructs `McpServer` directly and wires service
  functions by import instead of receiving a service object.

Impact:

MCP behavior is hard to instantiate with alternate storage, alternate
project context, or browser/worker-style boundaries. The Zod schemas are
correctly boundary-shaped, but the service itself is still a composition
root and domain workflow mixed together.

Required direction:

- Introduce a `ThinkMcpService` or equivalent class whose constructor
  receives the capture, read, health, migration, path, and backup ports.
- Keep Zod schemas in `server.js`.
- Let `server.js` map validated wire input to domain service calls.

Backlog:

- `CORE_mcp-service-dependency-injection`

### F4. Encoding and decoding still leak past boundaries

Severity: Medium

Evidence:

- `src/store/content.js` encodes text with `Buffer.from()`.
- `src/store/model.js` includes `parseJsonArray()`.
- `src/store/derivation.js` writes and reads prompt-family lists as JSON
  strings in graph properties.
- `src/store/checkpoint-read.js` decodes content bytes into text while
  also presenting read-model behavior.
- Swift adapter code such as `ThinkCLIAdapter` correctly decodes JSONL at
  the boundary, but the JavaScript store has not achieved the same split.

Impact:

Codec choices are embedded in store logic. That makes future browser
support and alternate storage harder, and it weakens the rule that core
works only with validated runtime objects.

Required direction:

- Introduce codec ports for text content, graph property payloads, and
  checkpoint content reads.
- Keep JSON/Buffer/TextDecoder work in adapters.
- Pass rich domain objects into store workflows.

Backlog:

- `CORE_boundary-codec-cutover`

### F5. Domain modeling is partially class-backed but still shape-heavy

Severity: Medium

Evidence:

- Good class-backed anchors exist: `Entry`, `ReflectSession`,
  `CaptureProvenance`, `ThinkError` subclasses, runtime read entries, MCP
  outcome classes, and Swift value structs/protocols.
- Many store/query functions still return plain frozen objects with
  implicit contracts.
- MCP and browse workflows frequently move broad object shapes across
  layers rather than named domain outcomes.
- Graph property records are used as untyped shape maps until late in the
  flow.

Impact:

Runtime truth is present but uneven. Important state often exists as
shape conventions rather than constructor-validated domain objects.

Required direction:

- Promote capture results, graph status, remember scopes, browse windows,
  migration outcomes, and prompt metrics into runtime-backed classes or
  equivalent Swift value types.
- Keep DTOs at boundaries only.

Backlog:

- `CORE_runtime-domain-model-cutover`

### F6. Generic errors still appear in source

Severity: Medium

Evidence:

`rg -n 'throw new Error\(' src bin scripts --glob '*.{js,mjs}'` finds
nine source occurrences, including:

- `src/minds.js`
- `src/store/content-reader.js`
- `src/store/model.js`
- `src/store/ports.js`
- `src/store/checkpoint-product-read.js`
- `src/store/checkpoint-state.js`

Impact:

Generic errors make runtime dispatch depend on message text or broad
`instanceof Error` checks. That is weaker than domain-specific error
classes with stable codes.

Required direction:

- Replace generic source errors with domain-specific error classes.
- Port base classes should throw typed `PortNotImplementedError` or avoid
  callable abstract methods in JavaScript.

Backlog:

- `CORE_runtime-domain-model-cutover`

### F7. Browse/TUI code has the largest human-scale violations

Severity: Medium

Evidence:

- `src/cli/commands/read.js` is 934 lines and has 17 strict-rule
  violations.
- `src/browse-tui/actions.js` has `applyBrowseAction()` at 284 lines
  with complexity 58.
- `src/browse-tui/app.js` still owns terminal I/O and animation
  orchestration.
- Existing backlog already identifies `SURFACE_splash-monolith` and
  `SURFACE_mind-switch-loop-in-command`.

Impact:

The browse surface is functionally covered but hard to inspect and
extend. It is the most obvious place where "human-scale code" is not yet
true.

Required direction:

- Split command orchestration from pure browse state transitions.
- Keep terminal I/O in adapters.
- Move action handling into small command objects or state-machine
  reducers.

Backlog:

- `SURFACE_browse-tui-strict-limits`
- Existing: `SURFACE_splash-monolith`
- Existing: `SURFACE_mind-switch-loop-in-command`

### F8. Swift adapter is closer to hexagonal shape, but app state is a
composition hotspot

Severity: Medium

Evidence:

- Positive: `ThinkCLIAdapter` receives `ProcessRunning` and
  `ThinkCLICommand`; `ThinkMCPAdapter` receives `MCPTransport`;
  command resolvers receive path-search dependencies.
- Positive: many Swift domain-ish values are `struct`, `Equatable`, and
  `Sendable`.
- Gap: `CaptureAppState.makeClient()` constructs concrete MCP/CLI
  adapters directly.
- Gap: `CaptureAppState.restartToLoadLatestBuild()` constructs
  `Process()` directly.
- Gap: `CaptureAppState` is 353 lines and coordinates UI state,
  notifications, metrics, retry behavior, update polling, and process
  restart.

Impact:

The macOS surface has good adapter seams but still centralizes too much
runtime orchestration in one app-state class.

Required direction:

- Introduce explicit app composition root/factory objects.
- Inject process restart and build update ports.
- Split capture retry orchestration from menu-bar app state.

Backlog:

- `SURFACE_macos-appstate-composition-root`

## Positive Compliance Anchors

- `docs/INFRASTRUCTURE_DOCTRINE.md` is already referenced by
  `AGENTS.md` as mandatory.
- `src/store/ports.js` establishes Clock, Host, and Random port names,
  even though the implementation needs stronger boundaries.
- `src/store/model.js`, `src/capture-provenance.js`, `src/errors.js`,
  and `src/mcp/result.js` show class-backed runtime modeling.
- `Object.freeze()` appears heavily in store and MCP paths.
- Swift adapters already use protocols for process and MCP transport.
- Existing tests exercise runtime behavior across CLI, MCP, store, and
  macOS adapters.

## Ratchet Plan

Phase 1: Documentation and measurement.

- Completed in this audit.
- Keep the strict ESLint profile as a reproducible command until it
  becomes a committed ratchet.

Phase 2: Enforcement ratchet.

- Add a strict-limits report to CI.
- Fail only new or worsened violations at first.
- Track full violation count in a committed baseline.

Phase 3: Boundary cleanup.

- Move concrete WARP/Git/Node dependencies out of store core.
- Inject environment, cwd, path, time, randomness, and storage ports.
- Keep schemas and codecs at CLI/MCP/storage boundaries.

Phase 4: Runtime model hardening.

- Replace major plain-object contracts with domain classes or Swift value
  types.
- Replace generic errors with typed domain errors.

Phase 5: Full gate.

- Turn strict code limits into hard CI failures.
- Add TypeScript-specific unsafe-type rules when the repo has TypeScript
  source.
- Add Swift lint or a Swift-native equivalent for size and complexity
  gates.

## Bottom Line

Think is directionally aligned with Runtime Truth, but it is not yet
structurally compliant with the stricter doctrine. The next real quality
cut is not cosmetic linting. It is moving store/MCP boundaries behind
ports, injecting dependencies from composition roots, and converting
shape-heavy workflows into constructor-validated runtime domain models.
