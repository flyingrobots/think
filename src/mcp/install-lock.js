import { mkdirSync, readdirSync, renameSync, rmdirSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * A lock for the installer's read-modify-write of a client config.
 *
 * A directory create is atomic on every supported filesystem, so the directory
 * itself is the mutex. Two installers registering different server names would
 * otherwise each merge against their own snapshot, and the later rename would
 * discard whatever landed in between — 30 parallel registrations against a fresh
 * config left 25 servers.
 */

export const LOCK_STALE_MS = 60_000;

/**
 * Is this path an installer lock abandoned by a killed process?
 *
 * Two conditions, and both matter. It must be old enough that no live installer
 * plausibly owns it, and it must be EMPTY — the installer's own lock never has
 * contents, so anything else at that path belongs to someone else. An earlier
 * version recursively deleted whatever it found there, which silently destroyed a
 * tracked file in a project checkout while reporting success.
 */
export function isReclaimableLock(lockPath) {
  let stats;
  try {
    stats = statSync(lockPath);
  } catch {
    return false;
  }

  if (!stats.isDirectory() || Date.now() - stats.mtimeMs < LOCK_STALE_MS) {
    return false;
  }

  try {
    return readdirSync(lockPath).length === 0;
  } catch {
    return false;
  }
}

/**
 * Try once to take the lock.
 *
 * Returns `{ acquired, release }`. Reclamation of an abandoned lock is atomic:
 * the stale directory is *renamed* out of the way first, and only the process
 * whose rename succeeded goes on to create the lock. Checking the age and then
 * deleting in place let two reclaimers both conclude they owned it.
 */
export function claimConfigLock(lockPath) {
  const claimed = tryCreateLock(lockPath);
  if (claimed) {
    return { acquired: true, release: () => releaseLock(lockPath) };
  }

  if (!isReclaimableLock(lockPath) || !reclaimAbandonedLock(lockPath)) {
    return { acquired: false, release: () => {} };
  }

  return { acquired: true, release: () => releaseLock(lockPath) };
}

function tryCreateLock(lockPath) {
  try {
    mkdirSync(lockPath);
    return true;
  } catch (error) {
    if (error.code === 'EEXIST') {
      return false;
    }
    throw error;
  }
}

function reclaimAbandonedLock(lockPath) {
  // Rename is atomic, so exactly one racing reclaimer can move the stale lock
  // aside. Whoever loses finds the path already gone or already retaken.
  const asidePath = `${lockPath}.abandoned.${String(process.pid)}`;
  try {
    renameSync(lockPath, asidePath);
  } catch {
    return false;
  }

  try {
    rmdirSync(asidePath);
  } catch {
    // The directory was verified empty before the rename; a failure to remove it
    // is not a reason to abandon a lock we have already won.
    rmSync(asidePath, { force: true });
  }

  return tryCreateLock(lockPath);
}

function releaseLock(lockPath) {
  try {
    rmdirSync(lockPath);
  } catch {
    // Already gone, or reclaimed by someone who judged us abandoned. Either way
    // there is nothing left for this process to release.
  }
}

export function buildConfigLockPath(file) {
  return path.join(path.dirname(file), `${path.basename(file)}.think-install.lock`);
}
