---
id: CORE_deferred-capture-corrupts-the-recent-read-model
blocks: []
blocked_by: []
---

# A deferred capture corrupts the recent/stats read model

When capture followthrough exceeds its budget the raw thought is committed and
stays readable through `inspect`, which is the trapdoor working as designed. The
read model does not survive it.

## Reproduction

```bash
M=$(mktemp -d); git -C "$M" init -q
for i in A B C; do
  THINK_REPO_DIR=$M THINK_CAPTURE_FOLLOWTHROUGH_TIMEOUT_MS=120000 \
    node bin/think.js "healthy $i"
done
# recent -> 3 entries, stats total -> 3   (correct)

THINK_REPO_DIR=$M THINK_CAPTURE_FOLLOWTHROUGH_TIMEOUT_MS=1 \
  node bin/think.js "DEFERRED D"
# recent -> 1 entry (only DEFERRED D), stats total -> 1
#   A, B and C have vanished from both surfaces

THINK_REPO_DIR=$M THINK_CAPTURE_FOLLOWTHROUGH_TIMEOUT_MS=120000 \
  node bin/think.js "healthy E"
# recent -> E, C, B, A   stats total -> 4
#   D is now gone permanently; the total should be 5

THINK_REPO_DIR=$M node bin/think.js --remember "DEFERRED D"
# 0 matches
```

So a single deferral does three things:

1. **Hides every older capture** while the deferred entry is newest — `recent` and
   `stats` report 1 instead of 4.
2. **Loses the deferred capture from both surfaces permanently** once a later
   healthy capture rebuilds the read model.
3. **Leaves it unreachable through `remember`**, so the only way back to it is
   `inspect` with the entry id, or raw Git.

## Not introduced by the followthrough-budget work

Confirmed on `origin/main` (24e2613) by temporarily forcing its hardcoded
`CAPTURE_FOLLOWTHROUGH_TIMEOUT_MS` to 1: same result, `recent=1 stats=1` after
the deferral. Exposing the budget as `THINK_CAPTURE_FOLLOWTHROUGH_TIMEOUT_MS`
only made the state easy to reach deliberately.

## Likely mechanism

`src/store/read-model.js` writes `fastCaptureRecordsJson` as a single-element
array during the raw save, and the full `recentCaptureRecordsJson` list is
reconciled during followthrough. Abandon the followthrough and the fast
single-record index is what `recent` and `stats` read. The later rebuild sources
from the graph, where the deferred capture was never linked —
`canonicalThought.stored` is `false` — so it is omitted.

## Why it matters

Deferral is reachable in normal use: a cold repository with Git fsmonitor
enabled can exceed 6 seconds on its first write, which is exactly what made the
MCP acceptance assertion flaky. An agent that captures a decision, receives the
documented "not a failure" warning, and moves on has silently dropped that
thought out of every surface it would later search.

## Suggested direction

Either write a complete fast index during the raw save so it is never a partial
view, or have the read model treat a single-record fast index as "unreconciled"
and fall back to a full scan rather than trusting it. The rebuild should also
include raw entries whose canonical thought was never stored.

Related: [[CORE_mcp-capture-warning-assertion-is-timing-dependent]] was the
symptom that first exposed how reachable deferral is.
