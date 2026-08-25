import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

import { Runtime } from '@git-stunts/git-warp';
import * as advanced from '@git-stunts/git-warp/advanced';

import {
  CaptureAdmission,
  CaptureEnumerationUnavailableError,
  CaptureReplayProvenance,
} from '../../src/history/capture-occurrence.js';
import {
  GitWarpCaptureOccurrenceStore,
} from '../../src/history/git-warp-capture-occurrence.js';

const execFileAsync = promisify(execFile);
const nodeRequire = createRequire(import.meta.url);
const GIT_WARP_VERSION = nodeRequire('@git-stunts/git-warp/package.json').version;
const ATOM_LANE = 'think-atoms-gate';
const ATOM_WRITER = 'think.atomic.gate';

test('atomic capture preview is pinned to exact git-warp 19.1.0', () => {
  const packageJson = nodeRequire('../../package.json');

  assert.equal(packageJson.dependencies['@git-stunts/git-warp'], '19.1.0');
  assert.equal(GIT_WARP_VERSION, '19.1.0');
});

test('capture admission rejects non-canonical application chronology', () => {
  assert.throws(
    () => new CaptureAdmission({
      ...captureFixture('entry:invalid-time', 'intent:invalid-time'),
      capturedAt: 'not-a-date',
    }),
    /capturedAt must be a canonical ISO timestamp/u
  );
});

test('Gate 1 admits one complete capture patch and recovers it after restart', {
  timeout: 60_000,
}, async (context) => {
  const fixture = await createAtomicFixture(context);
  const { repoDir } = fixture;
  const capture = captureFixture('entry:gate-one', 'intent:gate-one');
  const replay = replayFixture(0);
  const first = await fixture.openStore();
  const receipt = await first.admit({ capture, replay });
  await first.close();

  const writerRef = writerReference();
  const patchSha = await gitOutput(repoDir, ['rev-parse', writerRef]);
  assert.equal(await gitOutput(repoDir, ['rev-list', '--count', writerRef]), '1');
  assert.match(receipt.representationSubject, /^think-capture:/u);
  assert.match(receipt.occurrence, /^occurrence:/u);
  assert.equal(receipt.captureId, capture.captureId);
  assert.equal(receipt.captureIntentId, capture.captureIntentId);

  const reopened = await fixture.openStore();
  const occurrence = await reopened.read(receipt.representationSubject);
  await reopened.close();

  assert.ok(occurrence);
  assert.deepEqual(occurrence.capture.toPropertyValue(), capture.toPropertyValue());
  assert.deepEqual(occurrence.replay.toPropertyValue(), replay.toPropertyValue());
  assert.deepEqual(occurrence.basis.frontier, [{
    writerId: ATOM_WRITER,
    patchSha,
  }]);
  assert.equal(await gitOutput(repoDir, ['rev-list', '--count', writerRef]), '1');
});

test('Gate 2 blocks without a supported basis-bound entity enumerator', {
  timeout: 60_000,
}, async (context) => {
  const fixture = await createAtomicFixture(context);
  const { repoDir } = fixture;
  const store = await fixture.openStore();
  const firstReceipt = await store.admit({
    capture: captureFixture('entry:equal-one', 'intent:equal-one'),
    replay: replayFixture(0),
  });
  const secondReceipt = await store.admit({
    capture: captureFixture('entry:equal-two', 'intent:equal-two'),
    replay: replayFixture(1),
  });
  assert.notEqual(firstReceipt.representationSubject, secondReceipt.representationSubject);
  assert.notEqual(firstReceipt.occurrence, secondReceipt.occurrence);
  assert.equal(
    await gitOutput(repoDir, ['rev-list', '--count', writerReference()]),
    '2'
  );
  await store.close();

  const reopened = await fixture.openStore();
  await assert.rejects(
    reopened.enumerate(),
    error => enumerationIsHonestlyUnavailable(error)
  );
  await reopened.close();

  await assertPublicEnumerationSurfaceIsAbsent(repoDir);
});

function captureFixture(captureId, captureIntentId) {
  return new CaptureAdmission({
    captureId,
    captureIntentId,
    body: 'equal bodies remain distinct capture acts',
    capturedAt: '2026-08-25T00:00:00.000Z',
    source: 'migration-fixture',
    channel: 'test',
    sourceWriterId: 'legacy.writer',
    sourceSortKey: captureId,
    sessionId: null,
  });
}

function replayFixture(replayOrdinal) {
  return new CaptureReplayProvenance({
    migrationBatchId: 'migration:gate',
    sourceLane: 'think-pages-v1',
    sourceBasis: 'source-basis:gate',
    sourceDigest: 'a'.repeat(64),
    sourcePage: 'page:0',
    sourceOrdinal: replayOrdinal,
    replayOrdinal,
  });
}

async function createAtomicFixture(context) {
  const repoDir = await mkdtemp(path.join(os.tmpdir(), 'think-atomic-gate-'));
  const stores = [];
  context.after(async () => {
    try {
      await Promise.all(stores.map(async store => await store.close()));
    } finally {
      await rm(repoDir, { recursive: true, force: true });
    }
  });
  await execFileAsync('git', ['init', repoDir]);
  await execFileAsync('git', ['-C', repoDir, 'config', 'user.name', 'think-test']);
  await execFileAsync(
    'git',
    ['-C', repoDir, 'config', 'user.email', 'think-test@local.invalid']
  );
  return Object.freeze({
    repoDir,
    async openStore() {
      const store = await GitWarpCaptureOccurrenceStore.open({
        repoDir,
        laneName: ATOM_LANE,
        writerId: ATOM_WRITER,
      });
      stores.push(store);
      return store;
    },
  });
}

function writerReference() {
  return `refs/warp/${ATOM_LANE}/writers/${ATOM_WRITER}`;
}

async function gitOutput(repoDir, args) {
  const { stdout } = await execFileAsync('git', ['-C', repoDir, ...args]);
  return stdout.trim();
}

function enumerationIsHonestlyUnavailable(error) {
  assert.ok(error instanceof CaptureEnumerationUnavailableError);
  assert.equal(error.code, 'CAPTURE_ENUMERATION_UNAVAILABLE');
  assert.equal(error.basis.lane, ATOM_LANE);
  assert.equal(error.basis.frontier.length, 1);
  return true;
}

async function assertPublicEnumerationSurfaceIsAbsent(repoDir) {
  const runtime = await Runtime.open({ at: repoDir, writer: ATOM_WRITER });
  try {
    const lane = await runtime.lane(ATOM_LANE);
    const coordinate = await advanced.captureCoordinate(lane);
    assert.equal(typeof lane.getNodes, 'undefined');
    assert.equal(typeof coordinate.getNodes, 'undefined');
    assert.equal(typeof coordinate.optic().getNodes, 'undefined');
    assert.equal(typeof coordinate.source().getNodes, 'undefined');
    assert.deepEqual(
      Object.keys(advanced).filter(name => /enumerate|nodes/iu.test(name)),
      []
    );
  } finally {
    await runtime.close();
  }
}
