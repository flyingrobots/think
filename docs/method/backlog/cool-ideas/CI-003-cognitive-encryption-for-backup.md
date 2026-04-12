# CI-003 — Cognitive Encryption for Backup

Legend: [CORE — Core Bedrock](../../legends/CORE.md)

## Idea

Think optionally backs up to an upstream Git remote (`THINK_UPSTREAM_URL`). Currently, these backups are plain text. If the remote (e.g., GitHub) is compromised, the user's entire private cognitive history is exposed.

Implement client-side encryption for WARP content-attachments. Encrypt raw thoughts locally using a user-provided passphrase or machine-specific key before they are committed and pushed. Only the authorized local machine(s) should be able to decrypt and browse the worldline.

## Why

1. **Sovereignty**: Ensures the "Local-First Bedrock" tenet is preserved even when using third-party infrastructure for backup.
2. **Trust**: Allows users to record sensitive ideas without fear of cloud exposure.
3. **Product Differentiation**: Positions Think as a genuinely private alternative to hosted, data-mining note-taking services.

## Effort

Medium-Large — requires a crypto-adapter port and a way to manage encryption keys/passphrases during capture and re-entry.
