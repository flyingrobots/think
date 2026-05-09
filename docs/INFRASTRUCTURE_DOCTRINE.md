# How to write TypeScript infrastructure that *actually* lasts.

This is the authoritative doctrine for Think. It is a refined, battle-tested version of the original "Runtime Truth Wins" philosophy. Infrastructure code (persistence, replication, crypto, conflict resolution, migrations, audit logs) cannot afford weak assumptions. They create long-lived, expensive bugs.

---

### Rule 0: Runtime Truth Wins (Non-Negotiable)

When the program is running, only one question matters:

**What is actually true right now, in memory, under execution?**

Everything else — types, comments, tests, design docs — is secondary. If they disagree with runtime reality, they are lying. Fix the reality first, then update the documentation.

**Hierarchy of Truth**

```
1. Runtime (constructors, invariants, methods, errors)
2. Boundary parsers & schemas
3. Tests (executable specification)
4. TypeScript types (checked documentation)
5. IDE / static analysis
6. Design docs & comments
```

TypeScript is #4 — a powerful servant, never the master.

---

### Core Philosophy

- Prioritize **truth-seeking** over cleverness.
- Favor **boring, explicit, and robust**.
- Default to **immutability**.
- Treat **portability as a feature** (browser-first mindset).
- Make correctness cheap; performance comes after.

---

### Language Policy

**TypeScript is the primary language.** Strong IDE support and ecosystem make it the right default.

**Banned without mercy:**
- `any`
- `unknown` escaping boundaries
- Type assertions (`as`)
- `enum`
- `throw new Error("string")`
- Magic numbers & strings
- Boolean trap parameters
- Anonymous option bags in public APIs

**Encouraged:**
- Classes for domain concepts with invariants or behavior
- `readonly` + `private` fields + `Object.freeze()`
- Branded classes for cross-realm safety
- Rust → Wasm when TypeScript is insufficient (performance, memory safety, hostile parsing)

**Canonical Boundary Pattern**

```typescript
function parsePatchFromWire(bytes: Uint8Array): PatchV2 {
  const raw = cborDecode(bytes);           // untrusted
  return PatchV2.fromDecoded(raw);         // validates + constructs trusted domain object
}

function applyPatch(patch: PatchV2): Result { ... }
```

---

### Architecture

**Hexagonal (Ports & Adapters) — Mandatory**

Core domain logic must never depend on host-specific APIs (Node globals, `fs`, `Buffer`, `process`, etc.). All external concerns go behind clean ports.

**Browser-First Mindset**

Prefer web-standard primitives:
- `Uint8Array`, `TextEncoder`, `URL`, `crypto.subtle`
- Keep core logic portable across browsers, Node, Deno, and workers.

---

### Object Model – The Four Pillars

1. **Value Objects** — Invariant-rich, immutable, equality by value
2. **Entities** — Identity + lifecycle
3. **Outcomes / Results** — Rich classes (preferred over tagged unions when behavior differs)
4. **Domain Errors** — Typed, contextual, first-class

**Example: Value Object**

```typescript
class EventId {
  readonly writerId: WriterId;
  readonly lamport: Lamport;

  private readonly brand = Symbol.for('grok.EventId');

  constructor(writerId: string, lamport: number) {
    this.writerId = WriterId.from(writerId);
    this.lamport = Lamport.from(lamport);
    Object.freeze(this);
  }

  static is(value: unknown): value is EventId {
    return value instanceof EventId 
        || (value != null && (value as any)[EventId.prototype.brand] === true);
  }

  equals(other: EventId): boolean {
    return this.writerId.equals(other.writerId) && this.lamport === other.lamport;
  }
}
```

**Preferred Outcomes**

```typescript
class OpApplied { ... }
class OpSuperseded { ... }

// Clean polymorphic dispatch
if (outcome instanceof OpSuperseded) { ... }
```

---

### Principles

**P1: Domain Concepts Demand Runtime Forms**  
If it has invariants, identity, or behavior — give it a class.

**P2: Validation at Construction & Boundaries**  
Constructors are synchronous and establish invariants or throw. Raw data becomes trusted only here.

**P3: Behavior Belongs on the Owner**  
Prefer polymorphism over type-tag switching.

**P4: Schemas Are Boundary Guards Only**  
Use Zod (or similar) at system edges. Keep domain classes clean.

**P5: Serialization Is Codec Territory**  
Domain objects should not know about JSON, CBOR, protobuf, etc.

**P6: Immutability by Default**  
Trusted objects should be difficult to mutate after construction. Use `readonly`, `freeze`, and return new values for transformations.

**P7: Determinism & Replayability**  
- All time comes from `ClockPort`
- All randomness from `RandomPort`
- All side effects through ports  
Your core should be deterministic and replayable.

**P8: Single Source of Truth**  
The runtime model rules. Types, tests, and docs document it.

**P9: Runtime Dispatch When Appropriate**  
`instanceof` is excellent inside the same realm. Use branding + `static is()` for cross-realm (workers, iframes).

---

### Practices

- One meaningful class or export per file, named after the concept.
- Parameter objects must have semantic meaning.
- Branch on error types, never `err.message`.
- Prefer composition over deep inheritance.
- No floating promises.
- Raw plain objects are for transport/logging only — not for domain meaning.

---

### Anti-Patterns I Strongly Dislike

- Shape soup (giant unions + endless type guards)
- God classes
- Leaking host APIs into core
- Treating types as the source of truth
- Parsing error messages like a raccoon in a dumpster

---

### Review Checklist (Before Merging)

- Does every important domain concept have a runtime-backed class?
- Any `any`, `unknown`, or `as` sneaking in?
- Are invariants enforced at construction time?
- Does behavior live on the owning type?
- Could this core logic run in a browser?
- Are time, randomness, and side effects properly abstracted?
- Are we mutating trusted domain objects?

---

**This is infrastructure.** It should feel like building a reliable, inspectable machine — not gluing components together with hope.

**Runtime truth wins.** Types are there to help you stay honest, not to replace reality.
