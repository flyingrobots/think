# Runtime Truth Infrastructure Doctrine

This is the authoritative engineering doctrine for Think. It applies to
all long-lived infrastructure code: capture, storage, graph repair,
replication, codecs, migrations, CLI/MCP surfaces, and macOS adapters.

Existing violations are debt, not precedent. New code must move the repo
toward this standard.

## Rule 0: Runtime Truth Wins

When the program is running, only one question matters:

**What is actually true right now, in memory, under execution?**

Types, tests, docs, comments, schemas, and generated artifacts are
secondary documentation. If they disagree with runtime behavior, they are
lying. Fix the runtime first, then update every layer that describes it.

Truth hierarchy:

1. Runtime model: constructors, invariants, methods, errors, live state.
2. Boundary parsers, schemas, and codecs.
3. Tests as executable specification.
4. Static types and IDE analysis.
5. Design docs, comments, and diagrams.

## Core Philosophy

- Truth-seeking over cleverness.
- Explicit, boring, and robust.
- Immutability by default.
- Hexagonal architecture and dependency injection are mandatory.
- Portability is a first-class feature.
- Code should stay small, focused, and human-scale.

Infrastructure should feel like a well-engineered, inspectable,
long-lived machine, not clever glue code.

## Mandatory Architecture Rules

### 1. Hexagonal Architecture: Ports And Adapters

Core domain logic must not depend on host APIs, external libraries with
side effects, protocol transports, concrete storage engines, process
state, environment variables, clocks, random number generators, or UI
frameworks.

All external capabilities enter through ports. Adapters implement those
ports for specific environments.

Examples of capabilities that require ports:

- Time.
- Randomness.
- Hostname and process metadata.
- Filesystem access.
- Git and WARP access.
- Network or upstream backup.
- CLI, MCP, macOS, and browser I/O.
- Encoding, decoding, and content storage.

### 2. Dependency Injection

Dependencies are injected through constructors or semantically named
options objects. Core code must not instantiate concrete adapters, import
adapter modules, read globals, or use service locators.

Allowed:

```typescript
const service = new CaptureService({
  clock,
  ids,
  thoughtStore,
  backupPort,
});
```

Forbidden in core:

```typescript
const store = new GitWarpStore(process.env.THINK_REPO_DIR);
const now = new Date();
const id = crypto.randomUUID();
```

Composition roots are the exception. Binaries, CLI entrypoints, MCP
servers, app delegates, and test fixtures may construct concrete
adapters and inject them inward.

### 3. Encoding And Decoding Only At Boundaries

Serialization, deserialization, and codec work happen only in adapters or
dedicated boundary codec ports. Core works with validated runtime domain
objects.

Allowed boundary pattern:

```typescript
function parsePatchFromWire(bytes: Uint8Array): Patch {
  const decoded = patchCodec.decode(bytes);
  return Patch.fromDecoded(decoded);
}

function applyPatch(patch: Patch): PatchOutcome {
  return patch.applyTo(state);
}
```

Forbidden in core:

```typescript
const decoded = JSON.parse(value);
const text = Buffer.from(payload, 'base64').toString('utf8');
```

## Object Model And Modeling Rules

Prefer classes with constructors for domain concepts.

Value objects, entities, outcomes, and domain errors should normally be
runtime-backed classes. This gives Think:

- Invariant enforcement at construction time.
- Natural `instanceof` dispatch inside one realm.
- RAII-style initialization.
- Better protection through private fields, readonly fields, and
  `Object.freeze()`.

The lighter "interface plus factory plus brand" pattern is discouraged
for domain modeling. It is allowed only for:

- Pure wire or DTO types.
- Extremely hot-path primitives where allocation measurably matters.
- Deliberate structural typing at external boundaries.

Preferred style:

```typescript
export class EventId {
  readonly writerId: WriterId;
  readonly lamport: Lamport;

  constructor(writerId: string, lamport: number) {
    this.writerId = WriterId.from(writerId);
    this.lamport = Lamport.from(lamport);
    Object.freeze(this);
  }

  static from(writerId: string, lamport: number): EventId {
    return new EventId(writerId, lamport);
  }

  static is(value: unknown): value is EventId {
    return value instanceof EventId;
  }

  equals(other: EventId): boolean {
    return this.writerId.equals(other.writerId)
      && this.lamport.equals(other.lamport);
  }
}
```

For cross-realm values, normalize through adapters and construct
validated domain objects before entering core.

## Strict Code Limits

These limits are mandatory for new and touched infrastructure code. The
current codebase has legacy violations; those must be tracked and reduced
with a ratchet until the limits are hard CI gates everywhere.

| Limit | Maximum |
| --- | ---: |
| File size | 1000 lines, aim below 600 |
| Function or method size | 35 non-blank, non-comment lines |
| Nesting depth | 4 |
| Cyclomatic complexity | 8 |
| Parameters | 5, otherwise use a named options class or object |
| Class size | 400 lines |
| Public methods per class | 15 |
| Imports per file | 12 |

Each file should have one primary domain concept. If a file needs more
than one primary concept, it is probably hiding a boundary or ownership
problem.

## Language Policy

Banned without exception:

- `any`.
- Unvalidated `unknown` escaping a boundary.
- Type assertions with `as`.
- `enum`.
- Generic `throw new Error("string")`.
- Magic numbers and strings.
- Boolean trap parameters.
- Anonymous option bags in public APIs.

`unknown` is allowed at external boundaries and parsers only. It must be
validated and normalized before entering core.

Encouraged:

- Constructor-based validation.
- Domain-specific error classes.
- `readonly`, `private`, and `Object.freeze()`.
- Polymorphism over type-tag switching.
- Web-standard primitives where possible: `Uint8Array`, `TextEncoder`,
  `TextDecoder`, `URL`, and `crypto.subtle`.

## flyingrobots Principles

P1. Domain concepts with invariants or behavior deserve runtime-backed
classes.

P2. Validation happens at construction and system boundaries.

P3. Behavior belongs on the type that owns it.

P4. Schemas such as Zod are boundary guards only.

P5. Encoding and decoding are codec or adapter territory.

P6. Immutability is the default.

P7. Determinism and replayability require ports for time, randomness,
side effects, and host state.

P8. The runtime model is the single source of truth.

P9. Use `instanceof` for same-realm dispatch. For cross-realm values,
normalize at the boundary before constructing domain types.

## Review Checklist

Every PR must answer these questions:

- Does it follow hexagonal architecture?
- Are dependencies injected rather than discovered from globals?
- Is encoding and decoding limited to boundaries?
- Are files, functions, nesting, complexity, and parameter counts within
  limits?
- Are important domain concepts modeled as classes with constructor
  validation?
- Are invariants protected at runtime?
- Are `any`, unsafe assertions, and unvalidated `unknown` absent?
- Could the core run in a browser or worker?
- Are time, randomness, and side effects abstracted?
- Is runtime behavior the source of truth when docs or types disagree?

## ESLint Direction

When TypeScript enforcement is available, use the following shape as the
baseline. JavaScript and Swift code must meet the same design standard
even when the exact linter differs.

```json
{
  "rules": {
    "max-lines": ["error", 1000],
    "max-lines-per-function": ["error", { "max": 35, "skipBlankLines": true, "skipComments": true }],
    "max-depth": ["error", 4],
    "max-params": ["error", 5],
    "complexity": ["error", 8],
    "max-statements": ["error", 25],

    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unsafe-assignment": "error",
    "@typescript-eslint/no-unsafe-member-access": "error",
    "@typescript-eslint/no-unsafe-return": "error",
    "@typescript-eslint/no-unsafe-call": "error",
    "@typescript-eslint/only-throw-error": "error",
    "@typescript-eslint/switch-exhaustiveness-check": "error",
    "no-floating-promises": "error"
  }
}
```

## Exceptions

An exception must be explicit, local, and temporary:

- State the runtime reason.
- Link the backlog item that removes it.
- Add regression coverage for the behavior being protected.
- Do not use a legacy violation as precedent for new code.

The standard exists because this code is meant to last.
