# Think Echo WARPspace constellation

Create a local WARPspace or constellation manifest for the Think-on-Echo proof
once Phase 0 has chosen the exact proof boundary.

Candidate shape:

```text
think-echo-dev
  pins Think
  pins Echo
  pins Wesley
  pins Continuum
  optionally pins warp-ttd
  pins git-warp only when sibling exchange is actually exercised
```

## Why

The proof will cross repository boundaries even if the app contract lives in
Think. A small constellation keeps those coordinates explicit and avoids
"whatever is checked out next door" becoming the hidden build system.

## Acceptance Criteria

- The manifest names exact repo coordinates or local override posture.
- It explains which repo owns each generated or consumed artifact.
- It does not require `git-warp` for the first capture/inspect proof.
- It can be verified or synced by the current Continuum `warp` tooling, or it
  records the missing tooling gap as follow-on work.
