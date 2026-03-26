# 0013 M4 Bijou Read Shell

Status: draft for review

## Purpose

Capture the design decision to adopt a Bijou TUI for the first explicit M4 human read shell.

This note is intentionally about the read shell, not the storage substrate and not the capture path.

It exists because M4 is the first milestone where on-screen navigation and inspection are part of the core value proposition rather than a side effect of CLI output.

## Problem Statement

The current read surfaces prove the contract, but they do not yet provide a satisfying human archive-navigation experience.

Today the user can:

- list recent captures
- browse a thought when they already know its `entryId`
- inspect exact stored metadata

That is sufficient for tests and plumbing.
It is not yet sufficient for deliberate reentry.

The next problem to solve is:

- how should a human move around the archive without turning `think` into a dashboard or a chat app?

Traditional terminal output is too thin for sustained navigation.
A full-screen app rewrite would be too broad and would threaten the capture-first doctrine.

The design question is narrower:

- should `think` adopt Bijou now as the explicit human read shell for `browse` and `inspect`?

## Sponsor User

Primary sponsor user:

- a terminal-native user with an existing archive of captures who wants to revisit, navigate, and inspect thoughts deliberately without memorizing opaque ids or losing sight of the raw text

## M4 Hill

### Hill: Reenter The Archive Without Losing The Plot

Who:

- a user returning to their thought archive from the terminal after capture has already become habitual

What:

- they open an explicit read shell, read one thought at a time with useful metadata already visible, move through chronology deliberately, summon the archive log or jump palette only when needed, inspect receipts on demand, and jump into `Reflect` when a thought deserves pressure, all without feeling like they entered a dashboard or a generic terminal app

Wow:

- it feels like walking through a personal thought archive rather than querying a tool or staring at raw ids

## Success Statement

This shell succeeds when:

- the user can navigate and inspect thoughts comfortably enough that they actually return to the archive more often

Everything else is secondary.

## Experience Principles

1. Explicit shell beats ambient takeover.
2. One thought at a time beats dashboard sprawl.
3. Navigation first, decoration second.
4. Raw text remains the center of gravity.
5. Inspectability beats cleverness.
6. Porcelain should remain downstream of the plumbing contract.
7. Archive overview stays hidden until summoned.

## Core Decision

Adopt Bijou now as the first explicit M4 human read shell.

In plain terms:

- yes to a Bijou TUI for `browse` and `inspect`
- no to turning capture into a TUI
- no to replacing the CLI/JSONL contract
- no to making the TUI the only way to use M4

The architectural split should be:

- plumbing:
  - `--recent`
  - `--browse`
  - `--inspect`
  - `--json`
- porcelain:
  - Bijou-based human browse/inspect shell

This implies a hard rule:

- no meaningful read behavior may exist only in the Bijou shell

If the shell reveals a useful action, an agent should also be able to reach that action through explicit CLI plumbing.

## Why Bijou, Why Now

Now is the right moment because:

- M1 and M2 already proved capture
- M3 clarified `Reflect`
- M4 is the first milestone whose core job is on-screen navigation and inspection

That means a TUI is finally serving the hill directly rather than existing as technical vanity.

Bijou is a fit because it can provide:

- explicit terminal UI structure
- strong typography and hierarchy for read-heavy surfaces
- a bounded shell rather than an always-on terminal dashboard
- a human-facing experience layered over existing command semantics

## What The Bijou Shell Is

The first Bijou shell should be:

- an explicit browse-and-inspect surface
- launched intentionally
- centered on one selected raw thought
- showing timestamp and identity metadata without requiring inspect mode
- navigable through older/newer movement
- capable of opening a hidden chronology drawer
- capable of opening a fuzzy jump surface
- capable of showing inspect receipts without leaving the shell
- capable of launching `Reflect` from the selected thought

The shell is for deliberate reentry.
It is not the primary capture path.

## What The Bijou Shell Is Not

The shell is not:

- a replacement for `think "..."` capture
- a terminal dashboard homepage
- a graph-map explorer
- a settings hub
- an LLM chat surface
- the only path to `browse` or `inspect`

If the shell starts trying to become “the whole product,” it is drifting.

## Entry And Contract Rules

The shell should remain downstream of the explicit CLI contract.

Recommended shape:

- `think --browse=<entryId>` remains a plain explicit read command
- `think --json --browse=<entryId>` remains the machine contract
- `think --browse` in a real TTY may open the Bijou shell
- `think --inspect=<entryId>` remains available outside the TUI

This keeps the hierarchy clean:

- capture remains unambiguous
- machine-facing consumers still depend on explicit read commands
- the human shell is convenience and clarity, not the source of truth

It also keeps human and agent capabilities aligned:

- human browse may be more pleasant in the shell
- agent browse may be more mechanical through JSONL
- both must rest on the same underlying read semantics

## First Shell Shape

The first shell should keep the scope brutally tight:

- main panel: one raw thought plus timestamp and identity metadata
- navigation: immediate older/newer movement
- hidden bottom drawer: chronology/log context when explicitly requested
- fuzzy jump palette: intentional movement through the archive without a permanent list rail
- inspect pane: raw metadata and derived receipts
- action: jump into `Reflect`

Nice-to-have later, not first:

- explicit linked-thought jumps
- graph neighborhood views
- multiple panes

The next slice after the first shell should likely be session-context browse driven by explicit `session_attribution` receipts rather than by inferred related-thought logic.

After that session-context slice, the next honest browse deepening is explicit session traversal rather than broader archive cleverness.

## Read-Shell Doctrine

### Raw Text First

The selected raw thought should stay visually primary.

No summary should displace it.

The archive log should not consume the screen by default.

### Receipts On Demand

If inspectable structure is shown, it must say:

- what it is
- whether it is raw or derived
- why it exists

### Explicit Entry

The user should know when they entered the shell.

This should not silently replace plain command output everywhere.

### Exit Cleanly

The shell should be easy to enter and easy to leave.

M4 is about making reentry better, not trapping the user in a terminal application.

## Relationship To Inspect

`Inspect` should be both:

- a standalone command for exact, scriptable, non-narrated inspection
- a pane or toggle within the Bijou browser for human use

That keeps inspect honest in both environments.

## Relationship To Reflect

The shell may provide a clean in-shell transition into `Reflect`.

That is useful because:

- browse finds the thought
- inspect explains the context
- reflect pushes the thought further

The shell must not collapse these into one ambient mode.

For the browse shell specifically, that means:

- invoking `Reflect` from inside the TUI should stay inside the TUI
- the user should not be dropped back into plain CLI prompts just because they started from the shell
- after a reflect response is saved or cancelled, the user should land back in browse with the current thought still in view

## Relationship To Agents

Agents should be able to perform the same core jobs as the human shell through explicit command contracts.

That means:

- `recent` remains available through explicit JSONL read commands
- `browse` remains available through explicit JSONL read commands
- `inspect` remains available through explicit JSONL read commands
- `Reflect` remains invokable without going through the Bijou shell

The shell may improve:

- presentation
- navigation ergonomics
- visual hierarchy

It must not become the exclusive place where:

- adjacency can be traversed
- receipts can be inspected
- a selected thought can be handed off into `Reflect`

If a useful behavior only exists in the TUI, the agent-native contract has drifted.

## IBM Design Thinking Playback Questions

- does the shell help the user return to the archive without first translating everything into ids and flags?
- does the shell feel like navigation rather than terminal theater?
- does the shell preserve trust by keeping raw text primary and receipts explicit?
- does it strengthen `browse` and `inspect` without stealing the job of capture?
- does it remain clearly downstream of the CLI plumbing contract?
- does every important read action in the shell still have an explicit agent-usable command path?

## Exit Criteria

- a Bijou read shell exists as a real human-facing M4 surface
- the shell can open without requiring an `entryId` from the user
- the selected raw thought remains visually primary
- inspect receipts are available without fake narration
- `Reflect` can be launched deliberately from the selected thought
- plain CLI and `--json` read commands remain first-class and unchanged in meaning
- no core browse/inspect/reflect action is exclusive to the shell
