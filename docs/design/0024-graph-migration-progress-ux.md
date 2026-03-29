# 0024 Graph Migration Progress UX

Status: implemented and closed

## Sponsor

### Sponsor Human

A person using an interactive graph-native `think` command on an outdated repo who already agreed to upgrade, and now needs that upgrade to feel visibly in progress instead of abrupt or suspicious.

### Sponsor Agent

An agent using explicit `think` commands and JSON contracts that must not inherit human-only progress theatrics or ambiguous mutation behavior.

## Hill

If an interactive human flow upgrades an outdated thought graph, the user sees a clear in-progress upgrade moment with visible progress semantics, while agent and non-interactive flows remain explicit failures instead of hidden mutation.

## Playback Questions

### Human Playback

- After choosing `Upgrade now`, does the system feel like it is visibly doing real work rather than freezing or jumping abruptly?
- Does the progress affordance feel calm and factual instead of dramatic or “installer-y”?
- Does the command continue naturally into the requested surface after migration completes?

### Agent Playback

- Do non-interactive and `--json` callers still get `graph.migration_required` rather than inheriting a human-only progress flow?
- Does the progress UX avoid introducing new hidden mutation paths for agents?
- Does the implementation preserve the existing rule that capture remains exempt from blocking migration?

## Non-Goals

This note does not:

- change the migration gating policy from [`0021-graph-migration-gating.md`](./0021-graph-migration-gating.md)
- block raw capture on migration
- redesign browse, inspect, or reflect
- require exact patch-by-patch migration percentages if the substrate cannot provide them honestly
- turn migration into a background daemon workflow

## Problem

The current migration gate is functionally correct:

- interactive graph-native commands can prompt for upgrade
- capture remains safe
- non-interactive/agent callers fail explicitly

But the current human moment after choosing `Upgrade now` is too abrupt.

The user experience today is roughly:

1. user chooses upgrade
2. command appears to pause
3. requested surface eventually appears

That is honest enough for correctness, but weak for confidence.

When the graph upgrade takes long enough to notice, the user should not have to guess whether:

- the command is frozen
- the graph is doing work
- the requested surface is still coming

## Decision

Interactive human migration should gain a visible progress state.

## 1. Progress UX Applies Only After Explicit Human Consent

This progress UX begins only after:

- an interactive graph-native command detects an outdated repo
- the human chooses `Upgrade now`

It must not:

- appear during capture
- appear for `--json`
- appear for non-interactive shells
- silently trigger without the earlier upgrade gate

## 2. Prefer Honest Phase Progress Over Fake Precision

The progress affordance should be truthful.

If the migration implementation cannot provide a trustworthy exact percentage, the UI should not invent one.

The preferred shape is:

- a visible `Upgrading thought graph...` state
- a progress-bar-like affordance
- one current phase label
- optional completed-phase markers when they are cheap and honest

Recommended phase model:

1. `Opening graph`
2. `Reading current graph state`
3. `Applying graph migration`
4. `Writing checkpoint / finishing`
5. `Opening <requested command>`

These are product-facing phases, not promises about exact internal patch counts.

## 3. Use A Progress Bar-Like Affordance Even If It Is Indeterminate

The human feedback specifically asked for:

- `Upgrading`
- a progress bar that visibly fills

The right compromise is:

- use a progress bar-like visual affordance in interactive human flows
- allow it to be indeterminate or phase-based if exact percentages are unavailable

That means we should prefer:

- a calm bar with visible movement
- clear phase text

over:

- a frozen terminal
- raw log spam
- fake `73%` precision we cannot justify

## 4. Avoid Flashing The Progress UI For Trivially Fast Upgrades

If migration completes almost instantly, the progress surface should not flash distractingly.

Recommended rule:

- if migration completes under a short threshold, continue directly
- otherwise show the progress surface

The exact threshold is implementation detail, but the product goal is:

- no janky flash for very fast upgrades
- no silent pause for noticeably slow upgrades

## 5. Return To The Requested Flow Automatically

After successful migration:

- the requested command should continue automatically
- the user should not need to rerun the command manually

Examples:

- `think --browse` should continue into `browse`
- `think --inspect=<entryId>` should continue into `inspect`
- `think --remember` should continue into `remember`

The upgrade moment is maintenance in service of the requested task, not a separate destination.

## 6. Failure UX Should Stay Explicit But Calm

If migration fails after the user opted in:

- show a clear failure message
- do not pretend the requested command can continue
- keep the repo untouched except for whatever safe, partial migration semantics are already guaranteed by the migration implementation

Recommended posture:

- explain that the graph upgrade did not complete
- suggest `think --migrate-graph` for explicit retry if appropriate

This should remain calmer than a stack trace and more explicit than a silent return to the shell.

## 7. Agent And Non-Interactive Behavior Does Not Change

This note is human-UX only.

For:

- `--json`
- non-interactive shells
- agent callers

the contract remains:

- fail explicitly with `graph.migration_required`
- do not auto-upgrade
- do not emit progress theatrics

That separation is important.

## Surface Guidance

### Interactive CLI

Recommended shape:

- a blocking upgrade screen or inline progress region
- visible title: `Upgrading thought graph`
- progress bar-like affordance
- current phase label

### Bijou/TUI Flows

For TUI-triggered commands, prefer staying visually inside the shell idiom:

- modal or overlay
- progress bar-like affordance
- return to the requesting shell automatically on success

The user should not feel dumped back into a plain CLI maintenance path.

### macOS Capture Surface

Capture remains exempt.

If post-capture migration later becomes visible at all, it should happen outside the prompt moment and should not delay dismissal.

That follow-through is out of scope for this note.

## Relationship To 0021

This note does not replace [`0021-graph-migration-gating.md`](./0021-graph-migration-gating.md).

`0021` answers:

- when migration is required
- which commands may block
- why capture stays exempt

This note answers:

- what the human sees after choosing `Upgrade now`

## Success Criteria

This slice is successful when:

- interactive human graph-native commands no longer feel frozen after upgrade approval
- the progress affordance feels honest and calm
- agent and non-interactive callers still get explicit `graph.migration_required`
- capture remains unaffected

## Outcome

Human playback result:

- pass

Agent playback result:

- pass

Delivered implementation:

- interactive human graph-native commands now show a visible `Upgrading thought graph` state with a progress-bar-like affordance and phase text
- the requested command continues automatically after successful migration
- `--json` and non-interactive flows remain explicit `graph.migration_required` failures
- capture remains unaffected
