import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';

import {
  createBackupRef,
  formatBackupTimestamp,
  normalizeContentAnchorTreeEntries,
  parseRepairArgs,
  repairV17Mind,
  resolveRepairTarget,
} from '../../scripts/repair-v17-mind.mjs';

const OLD_CHECKPOINT = '1111111111111111111111111111111111111111';
const UPGRADED_CHECKPOINT = '2222222222222222222222222222222222222222';
const FRESH_CHECKPOINT = '3333333333333333333333333333333333333333';
const ZERO_OID = '0000000000000000000000000000000000000000';

test('repair args resolve a named mind under ~/.think', () => {
  const args = parseRepairArgs(['--mind', 'claude', '--dry-run', '--json']);
  const target = resolveRepairTarget(args, {
    homeDir: '/Users/example',
  });

  assert.equal(target.graph, 'think');
  assert.equal(target.mind, 'claude');
  assert.equal(target.repoDir, path.join('/Users/example', '.think', 'claude'));
});

test('repair args map the default mind to ~/.think/repo', () => {
  const args = parseRepairArgs(['--mind', 'default']);
  const target = resolveRepairTarget(args, {
    homeDir: '/Users/example',
  });

  assert.equal(target.mind, 'default');
  assert.equal(target.repoDir, path.join('/Users/example', '.think', 'repo'));
});

test('repair args reject ambiguous mind and repo targets', () => {
  const args = parseRepairArgs(['--mind', 'claude', '--repo', '/tmp/mind']);

  assert.throws(
    () => resolveRepairTarget(args),
    /Use either --mind or --repo/
  );
});

test('content anchor normalization preserves blob anchors as blob entries', async () => {
  const blobOid = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const treeOid = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  const frontierOid = 'cccccccccccccccccccccccccccccccccccccccc';
  const objectTypes = new Map([
    [blobOid, 'blob'],
    [treeOid, 'tree'],
  ]);

  const normalized = await normalizeContentAnchorTreeEntries([
    `040000 tree ${blobOid}\t_content_${blobOid}`,
    `040000 tree ${treeOid}\t_content_${treeOid}`,
    `100644 blob ${frontierOid}\tfrontier.cbor`,
  ], oid => objectTypes.get(oid));

  assert.deepEqual(normalized, [
    `100644 blob ${blobOid}\t_content_${blobOid}`,
    `040000 tree ${treeOid}\t_content_${treeOid}`,
    `100644 blob ${frontierOid}\tfrontier.cbor`,
  ]);
});

test('createBackupRef creates a dated pre-v17 ref without overwriting an existing ref', () => {
  const now = new Date('2026-05-12T16:25:00.000Z');
  const firstRef = 'refs/warp/think/checkpoints/pre-v17-upgrade-20260512-162500';
  const existingRefs = new Set([firstRef]);
  const updates = [];
  const runner = createGitRunner({
    existingRefs,
    updates,
  });

  const backupRef = createBackupRef({
    checkpointSha: OLD_CHECKPOINT,
    graph: 'think',
    now,
    repoDir: '/tmp/think-mind',
    runner,
  });

  assert.equal(formatBackupTimestamp(now), '20260512-162500');
  assert.equal(backupRef, 'refs/warp/think/checkpoints/pre-v17-upgrade-20260512-162500-02');
  assert.deepEqual(updates, [{
    newValue: OLD_CHECKPOINT,
    oldValue: ZERO_OID,
    ref: backupRef,
  }]);
});

test('repairV17Mind dry-run reports needed repair without mutating refs', async () => {
  const events = [];
  const runner = createGitRunner({ events });
  let dryRunCount = 0;

  const result = await repairV17Mind({
    dryRun: true,
    graph: 'think',
    help: false,
    json: true,
    mind: null,
    repo: '/tmp/think-mind',
  }, {
    runner,
    runUpgrade: ({ dryRun }) => {
      assert.equal(dryRun, true);
      dryRunCount += 1;
      return upgradeWouldRun();
    },
    materialize: () => {
      throw new Error('dry-run must not materialize');
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.dryRun, true);
  assert.equal(result.wouldRepair, true);
  assert.equal(result.backupRef, null);
  assert.equal(dryRunCount, 1);
  assert.ok(!events.includes('backup'), 'dry-run must not create backup refs');
});

test('repairV17Mind backs up before upgrade and verifies the repaired graph', async () => {
  const events = [];
  const updates = [];
  const runner = createGitRunner({
    events,
    updates,
  });
  let dryRunCount = 0;

  const result = await repairV17Mind({
    dryRun: false,
    graph: 'think',
    help: false,
    json: true,
    mind: null,
    repo: '/tmp/think-mind',
  }, {
    now: new Date('2026-05-12T16:25:00.000Z'),
    runner,
    runCheck: () => ({
      checkpoint: {
        sha: FRESH_CHECKPOINT,
      },
      status: {
        patchesSinceCheckpoint: 0,
      },
    }),
    runDoctor: () => ({
      findings: [
        { id: 'repo-accessible', status: 'ok' },
        { id: 'hooks-installed', status: 'warn' },
      ],
      summary: {
        fail: 0,
        warn: 1,
      },
    }),
    runUpgrade: ({ dryRun }) => {
      if (dryRun) {
        dryRunCount += 1;
        return dryRunCount === 1 ? upgradeWouldRun() : upgradeAlreadyCurrent();
      }

      events.push('upgrade');
      return {
        checkpointRef: 'refs/warp/think/checkpoints/head',
        currentSchema: 5,
        graphName: 'think',
        previousCheckpointSha: OLD_CHECKPOINT,
        previousSchema: 4,
        status: 'upgraded',
        upgradedCheckpointSha: UPGRADED_CHECKPOINT,
      };
    },
    materialize: () => {
      events.push('materialize');
      return {
        checkpoint: FRESH_CHECKPOINT,
        graph: 'think',
      };
    },
  });

  const backupRef = 'refs/warp/think/checkpoints/pre-v17-upgrade-20260512-162500';

  assert.equal(result.ok, true);
  assert.equal(result.changed, true);
  assert.equal(result.beforeCheckpoint, OLD_CHECKPOINT);
  assert.equal(result.afterCheckpoint, FRESH_CHECKPOINT);
  assert.equal(result.backupRef, backupRef);
  assert.equal(result.upgrade.before, 'needed');
  assert.equal(result.upgrade.after, 'already-current');
  assert.equal(result.check.patchesSinceCheckpoint, 0);
  assert.equal(result.doctor.failures, 0);
  assert.equal(result.doctor.warnings.length, 1);
  assert.deepEqual(updates, [{
    newValue: OLD_CHECKPOINT,
    oldValue: ZERO_OID,
    ref: backupRef,
  }]);
  assert.deepEqual(events, ['backup', 'upgrade', 'materialize']);
});

function upgradeWouldRun() {
  return {
    checkpointRef: 'refs/warp/think/checkpoints/head',
    currentSchema: 5,
    graphName: 'think',
    previousCheckpointSha: OLD_CHECKPOINT,
    previousSchema: 4,
    status: 'would-upgrade',
    upgradedCheckpointSha: null,
  };
}

function upgradeAlreadyCurrent() {
  return {
    checkpointRef: 'refs/warp/think/checkpoints/head',
    currentSchema: 5,
    graphName: 'think',
    previousCheckpointSha: FRESH_CHECKPOINT,
    previousSchema: 5,
    status: 'already-current',
    upgradedCheckpointSha: FRESH_CHECKPOINT,
  };
}

function createGitRunner({
  events = [],
  existingRefs = new Set(),
  updates = [],
} = {}) {
  return (_command, args, _options = {}) => {
    const gitArgs = args.slice(2);
    const subcommand = gitArgs[0];

    if (subcommand === 'rev-parse' && gitArgs.includes('--git-dir')) {
      return commandResult({ stdout: '.git\n' });
    }

    if (subcommand === 'rev-parse' && gitArgs.includes('--verify')) {
      return commandResult({ stdout: `${OLD_CHECKPOINT}\n` });
    }

    if (subcommand === 'show-ref') {
      const ref = gitArgs.at(-1);
      return commandResult({
        status: existingRefs.has(ref) ? 0 : 1,
      });
    }

    if (subcommand === 'update-ref') {
      const ref = gitArgs[2];
      const newValue = gitArgs[3];
      const oldValue = gitArgs[4];
      events.push('backup');
      updates.push({ newValue, oldValue, ref });
      existingRefs.add(ref);
      return commandResult();
    }

    if (subcommand === 'cat-file') {
      return commandResult({ stdout: 'blob\n' });
    }

    throw new Error(`Unexpected git command: ${gitArgs.join(' ')}`);
  };
}

function commandResult({
  status = 0,
  stdout = '',
  stderr = '',
} = {}) {
  return Object.freeze({
    args: [],
    command: 'git',
    status,
    stderr,
    stdout,
  });
}
