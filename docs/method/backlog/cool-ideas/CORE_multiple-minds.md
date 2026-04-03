# Multiple minds

Break the assumption that the thought store is always a single repo at `~/.think/repo`.

## Shape

- Support multiple named minds backed by separate thought repos.
- Allow an explicit active/default mind for normal capture.
- Make it possible for a human operator and one or more agents to have distinct minds.
- Allow deliberate shared minds later without making accidental cross-contamination easy.

## Constraints

- Do not make warm-path capture depend on choosing among many minds every time.
- Do not let an agent silently write into the human's default mind unless explicitly intended.
- Keep provenance explicit about which mind/repo an entry belongs to.
- Keep the current config-driven repo path as a low-level escape hatch, not the full multi-mind UX.

## Related ideas

- **Holding area and mind routing** — raw ingress may need a neutral local holding area before derivation or routing assigns a thought to a more specific mind.
- **Agent-owned minds** — agents may need their own thought repo rather than writing into the operator's personal mind. Preserves separate provenance and avoids polluting a human's private archive.
- **Shared minds and collective ownership** — jointly produced and jointly owned provenance rather than one subject per repo. Group-held keys or threshold access for sensitive shared traces.
