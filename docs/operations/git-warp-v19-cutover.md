# Think Native git-warp v19 Cutover

This runbook replaces one authoritative Think mind with a repository written
only through Think's native git-warp v19 SDK.

The production runtime has no v18 reader and no compatibility representation.
It stores schema-versioned Think aggregate pages and their bounded indexes in
fixed byte-valued v19 properties. User object identity, chronology, sessions,
annotations, and reflection relationships are facts inside those immutable
page documents; they are not duplicated into one v19 commit per object and
edge. The rejected `think.record.v1` representation is readable only by the
one-time `convert-v19-mind.mjs` source converter.

## Preconditions

- Install Think's locked official `@git-stunts/git-warp` package.
- Stop every process that can write to the mind.
- Keep the maintenance window closed until post-swap verification passes.
- Use independent copies. A normal clone fetches branch refs only and is not a
  faithful Think copy unless every `refs/*` namespace is fetched explicitly.
- Do not run Git garbage collection during the campaign.

## Per-mind sequence

Set paths explicitly for one mind:

```bash
SOURCE="$HOME/.think/codex"
BACKUP="$HOME/.think-v19-cutover/<run>/backups/codex.pre-native-v19.git"
LEGACY_COPY="$HOME/.think-v19-cutover/<run>/sources/codex"
NATIVE_CANDIDATE="$HOME/.think-v19-cutover/<run>/candidates/codex"
REPORTS="$HOME/.think-v19-cutover/<run>/reports"
INVENTORY="$REPORTS/codex.native-v19.inventory.json"
```

1. Record every authoritative ref outside the repository:

   ```bash
   git -C "$SOURCE" for-each-ref \
     --format='%(refname) %(objectname)' \
     > "$REPORTS/codex.refs.before.txt"
   ```

2. Create and verify an independent mirror backup:

   ```bash
   git clone --mirror --no-hardlinks "$SOURCE" "$BACKUP"
   git -C "$BACKUP" fsck --full
   ```

3. Create a non-hardlinked normal source copy, then fetch all refs without a
   force refspec:

   ```bash
   git clone --no-hardlinks "$SOURCE" "$LEGACY_COPY"
   git -C "$LEGACY_COPY" fetch --no-tags "$SOURCE" 'refs/*:refs/*'
   git -C "$LEGACY_COPY" fsck --full
   ```

4. Prove the source copy is exact at the ref level:

   ```bash
   git -C "$SOURCE" for-each-ref \
     --format='%(refname) %(objectname)' |
     LC_ALL=C sort | shasum -a 256

   git -C "$LEGACY_COPY" for-each-ref \
     --format='%(refname) %(objectname)' |
     LC_ALL=C sort | shasum -a 256
   ```

   The two digests must match. Dangling objects reported by `git fsck` are not
   corruption; missing or corrupt objects are.

5. Read the legacy application representation exactly once through one public
   v19 observer plan and persist a checksummed inventory:

   ```bash
   npm run migrate:v19-native -- \
     --source "$LEGACY_COPY" \
     --inventory-out "$INVENTORY" \
     --json
   ```

   The converter snapshots all source refs before and after the read, aborts if
   they moved, and creates the inventory with exclusive-create semantics. It
   never overwrites an existing inventory. Record the reported source-ref and
   manifest SHA-256 values.

6. Independently validate the persisted inventory without reopening the legacy
   repository:

   ```bash
   npm run migrate:v19-native -- \
     --inventory-in "$INVENTORY" \
     --dry-run \
     --json \
     > "$REPORTS/codex.native-inventory-verification.json"
   ```

7. Initialize an empty normal Git repository for the native candidate:

   ```bash
   mkdir -p "$NATIVE_CANDIDATE"
   git init "$NATIVE_CANDIDATE"
   git -C "$NATIVE_CANDIDATE" config core.fsmonitor false
   git -C "$NATIVE_CANDIDATE" config user.name think
   git -C "$NATIVE_CANDIDATE" config user.email think@local.invalid
   ```

8. Import the immutable inventory into the empty native candidate. This phase
   does not open or read the legacy repository:

   ```bash
   npm run migrate:v19-native -- \
     --inventory-in "$INVENTORY" \
     --target "$NATIVE_CANDIDATE" \
     --json \
     > "$REPORTS/codex.native-conversion.json"
   ```

   The report must say `converted` and `verified: true`. The converter refuses
   a target that already contains refs and rejects an inventory whose manifest,
   counts, or per-kind totals do not match its content.

   The inventory is lossless, but the native projection deliberately does not
   reproduce implementation artifacts. It retains user-authored entries,
   sessions, annotations, unmatched historical thoughts, and their relationship
   facts inside bounded aggregate pages. It drops:

   - `read_model:*` cached indexes;
   - `artifact:*` derived receipts and projections;
   - generated keyword, topic, and classification nodes;
   - pipeline-run records;
   - graph metadata initialized by the native runtime; and
   - thought documents duplicated by a retained capture's `thoughtId`; and
   - legacy graph edges whose meaning is already present in retained document
     facts or bounded index order.

   The conversion report includes the full source summary plus imported and
   dropped document/edge counts. Review those counts before continuing. The
   complete inventory, source mirror, and pre-cutover backup remain the
   evidence and recovery boundary for everything omitted from the new
   authority.

9. Verify candidate integrity and native runtime behavior:

   - `git fsck --full` succeeds.
   - A bounded recent read returns the expected latest captures and count.
   - Exact document samples match the conversion report.
   - `think.record.v1` is absent from the candidate's admitted application
     properties.
   - Exact document samples resolve from the same bounded aggregate pages used
     by list reads; there is no duplicate per-document property.
   - A separate disposable clone of the candidate accepts a capture, returns
     its Receipt, closes, reopens, and returns that capture.

10. Create and verify a second independent mirror of the finished candidate.
   Re-read the authoritative ref snapshot. Abort if any authoritative ref
   moved after the maintenance window began.

11. Atomically replace an existing authoritative directory with the compiled
    `scripts/atomic-swap-paths.swift` helper. The old authoritative directory
    lands at the candidate path and remains an immediate rollback source.

12. If the requested authoritative path does not exist, publish with the
    compiled `scripts/atomic-publish-path.swift` helper. It uses
    `RENAME_EXCL`, atomically creates the target, and refuses to overwrite a
    path created by another process.

13. Through the authoritative path, repeat integrity, bounded-read, close,
    reopen, and backup verification. Start writers only after all checks pass.

## James source

`~/.think/repo` is the retained James source and must remain unchanged.
Prepare and migrate a disposable copy with the official v19.0.1 substrate
migrator before using it as `--source`. Publish the native result to the absent
`~/.think/james` path. Never rename or overwrite `~/.think/repo`.

## Required order

Complete the entire backup, convert, verify, atomic replacement, and
post-replacement verification cycle in this order:

1. `~/.think/codex`
2. `~/.think/claude`
3. `~/.think/gemini`
4. `~/.think/james`

Do not begin the next authority while the previous one is unverified.

## Rollback

Stop writers before rollback.

For an existing path, run the same atomic directory swap again. This restores
the exact pre-cutover repository as one filesystem operation. Do not rebuild a
rollback by moving individual refs or copying object files into a live
repository.

For a newly published target, atomically move the failed publication back to
its absent candidate path. The original retained source remains unchanged.

Keep the pre-cutover mirror, swapped-out directory, ref snapshots, conversion
reports, and post-conversion mirror until retention is reviewed separately.
