# 0011 Pressure-Test And Spitball

Status: draft for review

## Purpose

Define the product distinction between:

- deterministic pressure-testing
- future LLM-assisted spitballing

This note exists because live usage exposed a real boundary:

- deterministic prompts can be useful for challenge, constraint, and sharpening
- they do not feel like genuinely bouncing ideas off something

That does not invalidate the current `M3` work.
It means the product needs a sharper conceptual split.

## Problem Statement

`think` currently has the beginnings of a seeded brainstorm mode.

What live usage showed is:

- the deterministic mode is useful as a pressure-test or reflection-like push
- it is not the same as free-associative or generative brainstorming

If the product treats those as the same thing, it will drift in one of two bad directions:

- deterministic pressure mode gets judged as failed brainstorming
- LLM-assisted spitballing gets bolted on and dissolves the careful boundaries around capture, provenance, and derived entries

This note locks the distinction before implementation drifts.

## Core Decision

The system should keep deterministic pressure-testing and treat future LLM-assisted spitballing as a separate, explicit layer.

In plain terms:

- keep the deterministic mode
- stop pretending it covers all brainstorming
- add any future LLM-assisted ideation as an explicit mode or submode
- keep both modes grounded in the same raw-capture and derivation doctrine

## Two Different Jobs

### Pressure-Test

Pressure-test mode is for:

- challenging a weak claim
- forcing a constraint
- sharpening a vague idea
- producing one better follow-on thought

It is good when the system should feel:

- sparse
- inspectable
- receipt-driven
- bounded

It does not need model fluency to succeed.

### Spitball

Spitball mode is for:

- associative leap-making
- generative branching
- surprising recombination
- the feeling of bouncing ideas off something responsive

This is where an LLM may be genuinely useful.

It is not the same job as pressure-testing.

## Why The Distinction Matters

Without this split, the product gets judged unfairly and built carelessly.

Bad outcomes:

- deterministic prompts get stretched past their useful limit
- LLM behavior gets added under the label of “just better brainstorm”
- the mode turns into chat instead of structured thinking support
- derived context leaks into raw capture semantics

The correct mental model is:

- pressure-test is a disciplined push
- spitball is a generative exchange

## Role Of Derivation

This discovery does not weaken the case for the derivation layer.
It clarifies the derivation layer's job.

Derivation is still useful for:

- seed filtering
- seed-quality assessment
- session and local-context attribution
- context packing for a later model call
- receipts describing what context was provided
- later reflection and x-ray modes

Derivation should not be expected to impersonate creativity.

## Pressure-Test Doctrine

The current deterministic `M3` path should remain:

- seeded
- explicit
- bounded
- non-ambient
- non-LLM by default

Useful prompt families:

- challenge
- constraint
- sharpen

The deterministic path should continue to optimize for:

- clear receipts
- sharp questions
- one useful follow-on entry

## Spitball Doctrine

If `think` later adds LLM-assisted ideation, it should follow these rules:

### Explicit Entry

The user must deliberately choose spitball mode.

No:

- automatic model follow-ups after capture
- ambient LLM suggestions in the menu bar
- silent escalation from pressure-test into chat

### Seed First

Spitball should still begin from a seed thought or seed capture.

The mode should not begin from a blank canvas or whole-archive “what should I think about?” posture.

### Bounded Context

The system should provide a small, inspectable context pack.

Good candidates:

- seed text
- seed-quality or classification receipts
- local session context
- explicitly linked prior brainstorm entries

Bad default:

- entire archive dump
- opaque retrieval
- model-only “related thoughts” with no receipts

### Derived Outputs Stay Separate

LLM-assisted outputs must be stored as derived entries, never as rewritten raw capture.

They should preserve:

- seed lineage
- session lineage
- model identity
- context-pack receipts

### Human Judgment Stays Central

Spitball mode may help generate possibilities, but it should not claim final understanding.

The system can suggest.
The user still decides what is useful.

## Recommended Product Shape

The cleanest shape is:

- `pressure-test` as the deterministic backbone
- `spitball` as the future explicit LLM-assisted ideation layer

In the user-facing product language, the deterministic backbone may simply be presented as `Reflect`.

That may appear in the UX either as:

- two named modes
- or one brainstorm entry point with explicit submodes

What should not happen is pretending those experiences are the same while secretly changing the implementation underneath.

## Relationship To M3

This note does not invalidate the current milestone.

It says:

- the current deterministic `M3` work is still useful
- it is best understood as pressure-testing
- future LLM-assisted spitballing should be additive, not a quiet rewrite of the current mode

## Decision Rule

If a future brainstorm design tries to use LLM fluency to paper over missing product boundaries, reject it.

If a future spitball design preserves explicit entry, seed-first context, separate derived outputs, and inspectable receipts, consider it.
