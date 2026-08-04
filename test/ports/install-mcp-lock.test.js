import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  LOCK_STALE_MS,
  claimConfigLock,
  isReclaimableLock,
} from '../../src/mcp/install-lock.js';

/**
 * The installer serialises its read-modify-write with a lock directory, because
 * a directory create is atomic everywhere. Reclaiming an abandoned lock is the
 * subtle part: it has to distinguish a lock left by a killed installer from a
 * directory that merely shares the name, and two racing reclaimers must not both
 * decide they own it.
 */

function makeTempDir() {
  return mkdtempSync(path.join(tmpdir(), 'think-lock-test-'));
}

function ageDirectory(target, ms) {
  const when = (Date.now() - ms) / 1000;
  utimesSync(target, when, when);
}

test('a fresh lock is not reclaimable', () => {
  const dir = makeTempDir();
  const lockPath = path.join(dir, 'config.json.lock');
  mkdirSync(lockPath);

  assert.equal(isReclaimableLock(lockPath), false, 'A lock created just now belongs to a live installer.');
  rmSync(dir, { recursive: true, force: true });
});

test('an aged empty lock is reclaimable', () => {
  const dir = makeTempDir();
  const lockPath = path.join(dir, 'config.json.lock');
  mkdirSync(lockPath);
  ageDirectory(lockPath, LOCK_STALE_MS + 60_000);

  assert.equal(isReclaimableLock(lockPath), true, 'An installer killed long ago should not wedge later runs.');
  rmSync(dir, { recursive: true, force: true });
});

test('a directory with contents is never reclaimable, however old', () => {
  // The installer's own lock is always empty. Anything else at that path belongs
  // to someone else, and recursively deleting it destroyed a user's file.
  const dir = makeTempDir();
  const lockPath = path.join(dir, 'config.json.lock');
  mkdirSync(lockPath);
  writeFileSync(path.join(lockPath, 'tracked'), 'important user data');
  ageDirectory(lockPath, LOCK_STALE_MS + 60_000);

  assert.equal(
    isReclaimableLock(lockPath),
    false,
    'A non-empty directory is not an abandoned installer lock and must not be deleted.'
  );
  rmSync(dir, { recursive: true, force: true });
});

test('claimConfigLock reclaims an abandoned lock by moving it aside, not deleting in place', () => {
  const dir = makeTempDir();
  const lockPath = path.join(dir, 'config.json.lock');
  mkdirSync(lockPath);
  ageDirectory(lockPath, LOCK_STALE_MS + 60_000);

  const claim = claimConfigLock(lockPath);

  assert.equal(claim.acquired, true, 'Expected the abandoned lock to be reclaimed.');
  assert.ok(statSync(lockPath).isDirectory(), 'Expected the caller to now hold the lock path.');
  claim.release();
  rmSync(dir, { recursive: true, force: true });
});

test('only one of two racing reclaimers wins an abandoned lock', () => {
  // Both see the same mtime. If both conclude they own it, they merge against
  // different snapshots and the later rename discards the earlier entry — the
  // exact loss this lock exists to prevent.
  const dir = makeTempDir();
  const lockPath = path.join(dir, 'config.json.lock');
  mkdirSync(lockPath);
  ageDirectory(lockPath, LOCK_STALE_MS + 60_000);

  const first = claimConfigLock(lockPath);
  const second = claimConfigLock(lockPath);

  assert.equal(first.acquired, true);
  assert.equal(second.acquired, false, 'The second reclaimer must not also believe it holds the lock.');

  first.release();
  rmSync(dir, { recursive: true, force: true });
});

test('claimConfigLock fails cleanly when a live lock is held', () => {
  const dir = makeTempDir();
  const lockPath = path.join(dir, 'config.json.lock');
  const held = claimConfigLock(lockPath);

  assert.equal(held.acquired, true);
  assert.equal(claimConfigLock(lockPath).acquired, false, 'A held lock is not available.');

  held.release();
  assert.equal(claimConfigLock(lockPath).acquired, true, 'Releasing makes it available again.');
  rmSync(dir, { recursive: true, force: true });
});
