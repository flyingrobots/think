# Echo reading envelope inspector

Add a developer-facing inspection surface for Echo-backed Think proof outputs.

The first useful shape could be a script or CLI subcommand that renders:

- observer plan id
- lane or mind id
- coordinate/frame
- reading posture
- witness or receipt refs
- payload digest
- decoded Think payload summary

## Why

The Think-on-Echo path will introduce evidence-bearing reads. If those reads
are only visible as raw JSON fixtures, developers will either ignore the
evidence posture or build ad hoc inspection snippets during every debugging
session.

## Guardrails

- This is not a user-facing browse replacement.
- It should not imply the reading is canonical full history.
- It should stay tied to the proof harness until Echo-backed read observers
  are real.
