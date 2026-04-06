# Durability and stress tests

Three test ideas that validate Think's reliability claims beyond the deterministic acceptance suite.

## Golden transcript test

Keep a canonical end-to-end "thinking trace" fixture: capture A, capture B, capture C, verify replay order and exact content. A high-value regression artifact.

## Stress capture test

Simulate a burst of rapid captures and verify all captures succeed, no silent corruption appears, and ordering remains coherent.

## Offline-first torture test

Exercise a harsher durability path: capture with unreachable upstream, interrupt or restart the process, verify local entries still exist afterward.

## Note

These should stay out of the deterministic acceptance suite unless they can remain stable.
