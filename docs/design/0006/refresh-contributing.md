# 0006: Refresh CONTRIBUTING for METHOD

The contributor guide should describe the repo that exists now, not the process shape we already retired.

## Sponsors

- **Human:** James
- **Agent:** Codex

## Hill

A contributor can read `CONTRIBUTING.md` and understand Think's current METHOD workflow, contributor entry points, verification commands, release discipline, and capture-path guardrails without reconstructing obsolete milestone-era process from scattered docs.

## Playback questions

### Agent perspective

1. Does `CONTRIBUTING.md` point to the current backlog, design, and retro locations?
2. Does it describe the current METHOD cycle loop instead of the retired milestone-development loop?
3. Does it remove the IBM Design Thinking framing while preserving the design-note expectations actually used in current cycles?
4. Are the verification and release instructions aligned with `CLAUDE.md`, `docs/method/process.md`, and `docs/method/release.md`?

### Human perspective

5. Can a new contributor skim one document and understand how work moves through the repo now?
6. Does the guide still make the capture doctrine and anti-slop boundaries obvious?

## Scope

### In scope

- Rewrite `CONTRIBUTING.md` to match METHOD and current repo references
- Point contributors at the current core docs instead of stale process framing
- Refresh verification and release instructions to match repo reality
- Update `BEARING.md` and `CHANGELOG.md` as part of cycle closeout

### Out of scope

- Changing repo process itself
- Rewriting `README.md`, `GUIDE.md`, or architecture docs beyond references
- Adding markdown linting or docs automation
- Any product or code behavior change

## Accessibility / assistive reading posture

The refreshed guide should be shorter, more direct, and easier to scan than the stale version.

## Localization / directionality posture

Not applicable.

## Agent inspectability / explainability posture

The contributor guide should point directly at the canonical docs for process, architecture, and coding style so an agent can discover the current rules without spelunking historical milestone material first.

## Non-goals

- Introducing new contributor policy beyond what the repo already follows
- Re-documenting every historical milestone
- Turning `CONTRIBUTING.md` into a second architecture document
