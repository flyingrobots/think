# Think git-warp v19 Cutover

This runbook migrates one retained Think mind without opening its authoritative
repository through mixed application or substrate versions.

The two migrations are distinct:

1. `prepare-v19-mind.mjs` uses an isolated git-warp v18 installation to encode
   Think-owned properties, text, and adjacency into `think.record.v1`.
2. The official git-warp v19.0.1 `git-warp-v18-to-v19` command translates the
   retained substrate, proves the result on scratch storage, and promotes refs
   through a compare-and-swap transaction.

Never point the v19 Think application at a non-empty v18 repository. Never run
the v18 bridge after the substrate marker has been promoted.

## Per-mind sequence

1. Stop every Think writer and record the authoritative WARP refs outside the
   repository.
2. Create and verify an independent mirror:

   ```bash
   git clone --mirror --no-hardlinks "$SOURCE" "$BACKUP"
   git -C "$BACKUP" fsck --full
   ```

3. Build a non-bare candidate from the mirror without sharing object files.
   The candidate must contain every `refs/*` namespace, not only branch refs.
4. If Codex still has the preserved mixed-format capture, replay it on the
   candidate before application preparation:

   ```bash
   npm run migrate:v19-replay-capture -- \
     --repo "$CANDIDATE" \
     --commit "$MIXED_FORMAT_COMMIT" \
     --v18-package-root "$V18_PACKAGE_ROOT" \
     --json
   ```

5. Prepare and verify the application records:

   ```bash
   npm run migrate:v19-prepare -- \
     --repo "$CANDIDATE" \
     --v18-package-root "$V18_PACKAGE_ROOT" \
     --json
   ```

6. Run the official v19.0.1 migrator against the candidate. Keep its recovery
   refs and report:

   ```bash
   npm exec --package=@git-stunts/git-warp@19.0.1 -- \
     git-warp-v18-to-v19 \
     --repo "$CANDIDATE" \
     --graph think \
     --yes \
     --json \
     --scratch-root "$SCRATCH_ROOT"
   ```

7. Rerun the same migrator. It must report `already-current` without moving
   promoted refs.
8. Through Think v19, verify a bounded read, an application write, its Receipt,
   cache closure and reopen, and a post-migration mirror backup.
9. Re-read the authoritative ref snapshot. Abort if any ref moved after the
   maintenance window began.
10. Compile `scripts/atomic-swap-paths.swift` and atomically swap the candidate
    directory with the authoritative directory. The swapped-out v18 directory
    remains at the candidate path as the immediate rollback source.
11. Repeat the bounded application and backup checks through the authoritative
    path.

Do not run Git garbage collection during this campaign. The pre-v19 mirror,
the swapped-out repository, the official recovery refs, ref snapshots, and
migration reports remain separate rollback boundaries.

## Rollback

If post-swap verification fails, stop writers and run the same atomic directory
swap again. This restores the exact pre-cutover directory. Do not try to
reconstruct rollback by moving individual refs, deleting recovery refs, or
copying object files into a live repository.
