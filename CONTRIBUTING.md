# Contributing to `think`

`think` is a local-first tool for cheap, exact, replayable thought capture.

If you contribute here, the job is not just to make code pass. The job is to protect the product doctrine while making the system more capable.

## Product doctrine

- Raw capture is sacred.
- Capture must stay cheap, exact, and local-first.
- Capture first. Interpret later.
- CLI and MCP are two surfaces for one product, not two products.
- Every CLI command supports `--json`.

The highest-level rule is still simple:

If a change makes capture slower, smarter, noisier, or more demanding, it is probably the wrong change.

## First reads

If you are new to the repo, start here:

1. [README.md](./README.md)
2. [docs/GUIDE.md](./docs/GUIDE.md)
3. [docs/BEARING.md](./docs/BEARING.md)
4. [docs/VISION.md](./docs/VISION.md)
5. [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
6. [docs/method/process.md](./docs/method/process.md)
7. [docs/SYSTEMS_STYLE_JAVASCRIPT.md](./docs/SYSTEMS_STYLE_JAVASCRIPT.md)

## Workflow

Think follows [METHOD](https://github.com/flyingrobots/method).

The cycle loop is:

`pull -> design -> RED -> GREEN -> playback -> retro -> close`

Current repo locations:

- backlog lanes live in [`docs/method/backlog/`](./docs/method/backlog/)
- active cycle design docs live in `docs/design/<cycle>/`
- completed cycle retros live in `docs/method/retro/<cycle>/`
- legends live in [`docs/method/legends/`](./docs/method/legends/)

Historical milestones `M0` through `M5` predate METHOD. Their docs remain in `docs/design/` and `docs/retrospectives/` as archive, but new work should use the METHOD structure above.

At cycle kickoff, the design note should state:

- human sponsor
- agent sponsor
- hill
- playback questions
- scope
- non-goals

At cycle close:

- update [`CHANGELOG.md`](./CHANGELOG.md)
- update [`README.md`](./README.md) if the user-facing surface changed
- update [`docs/BEARING.md`](./docs/BEARING.md) when direction, tensions, or recently shipped work changed
- write the retrospective before calling the slice done

## Development rules

- Tests are the spec. Prefer failing tests before implementation when behavior changes.
- Do not weaken a failing test just to make the suite pass. If the test is wrong, stop and fix the misunderstanding first.
- Use isolated temp state for storage and Git tests. Do not rely on real home-directory state, ambient Git config, or live network services.
- Keep user-facing language free of Git and WARP jargon unless the surface is explicitly for operators.
- Preserve parity between CLI and MCP semantics; agents should not have to learn a second product.
- Keep changes narrow and explicit. Runtime truth beats shape soup.

## Build and verification

```bash
npm test
npm run test:m2
npm run test:local
npm run lint
npm run benchmark:capture
npm run benchmark:browse
```

- `npm test` is the default acceptance suite.
- `npm run test:m2` runs the macOS Swift tests and is Darwin-only.
- `npm run test:local` runs the default suite plus the macOS suite together.
- Only run one `swift test` at a time. SwiftPM locks the build directory.
- After changing Swift source, rebuild the macOS app with `npm run macos:bundle`.
- Install hooks with `npm run install-hooks`. `pre-commit` runs lint, and `pre-push` enforces the main-branch test gate.

## Coding standard

New JavaScript should follow [System-Style JavaScript](./docs/SYSTEMS_STYLE_JAVASCRIPT.md): runtime-backed domain concepts, boundary validation, explicit ownership of behavior, and narrow seams instead of object-shape soup.

Read [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) before making structural changes. Do not let storage concerns leak into normal UX, and do not let surface-specific concerns infect the capture core.

## Release discipline

Think starts versioning at `0.1.0`.

Release rules:

- releases happen when externally meaningful behavior changes, not automatically for every cycle
- milestone or cycle closeout produces the release-candidate state
- `package.json` is bumped on the release commit
- the Git tag is created on the commit that lands on `main`
- every cycle close updates the changelog and README, even if no release is cut

## Capture-path guardrails

Do not introduce any of the following into plain capture without explicit re-approval:

- embeddings
- clustering
- retrieval-before-write
- suggestions during capture
- tags, ontology prompts, or classification prompts
- dashboard-first capture UX
- proactive AI interruptions
- hosted collaborative thinking
- public sharing surfaces

The system may become more capable over time, but the capture moment must stay boring, fast, and exact.
