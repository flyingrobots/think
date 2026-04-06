# Cryptographic protection

If multiple minds or sensitive private archives exist, the storage and backup model will probably need stronger cryptographic protection than plain local Git plus private remote.

## Shape

- Per-mind encryption or key-wrapping.
- Encrypted backup to remote.
- Explicit unlock model for local and agent access.
- Boring, auditable key custody.

## Constraint

Do not add crypto in a way that breaks the cheap, habitual capture path unless the unlock model is already solved cleanly.
