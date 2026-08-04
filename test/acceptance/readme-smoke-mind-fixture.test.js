import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import { createHermeticThinkEnv, repoRoot } from '../fixtures/runtime.js';
import { createTempDir } from '../fixtures/tmp.js';
import { assertSuccess } from '../support/assertions.js';

/**
 * The canonical Think mind, restored from git-cas by tree oid.
 *
 * This is a real archive from a real capture session rather than a mind seeded by
 * the test, so it exercises reads against history that already exists — including
 * one capture whose followthrough budget expired.
 *
 * That last part is why the fixture exists. The deferred state cannot be produced
 * on demand: the abandoned followthrough keeps running, and how far it gets before
 * the process exits varies per run, so `recent`, `stats` and `remember` disagree
 * about the capture from one attempt to the next. Frozen here it is deterministic,
 * which gives the defect in docs/method/backlog/bad-code/
 * CORE_deferred-capture-corrupts-the-recent-read-model.md a regression target.
 *
 * git-cas objects live under refs/cas/*, which the default push refspec does not
 * send to a remote, so a checkout without them skips rather than failing on an
 * unreachable object id.
 */

const MANIFEST_PATH = path.join(repoRoot, 'test', 'fixtures', 'cas', 'readme-smoke-mind.json');
const GIT_CAS = path.join(repoRoot, 'node_modules', '@git-stunts', 'git-cas', 'bin', 'git-cas.js');
const CLI = path.join(repoRoot, 'bin', 'think.js');
const RESTORE_TIMEOUT_MS = 120_000;

async function readManifest() {
  return JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
}

function hasRestorableAsset(manifest) {
  const probe = spawnSync('git', ['cat-file', '-t', manifest.treeOid], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  return probe.status === 0 && probe.stdout.trim() === 'tree';
}

async function restoreMind(manifest) {
  const parentDir = await createTempDir('think-readme-smoke-mind-');
  const mindDir = path.join(parentDir, 'mind');
  const tarballPath = path.join(parentDir, manifest.tarball.name);

  assert.ok(existsSync(GIT_CAS), `Expected the git-cas test dependency at ${GIT_CAS}`);

  const restore = spawnSync(process.execPath, [
    GIT_CAS, '--json', 'restore',
    '--oid', manifest.treeOid,
    '--out', tarballPath,
    '--cwd', repoRoot,
  ], { cwd: repoRoot, encoding: 'utf8' });
  assertSuccess(restore, 'Expected git-cas to restore the canonical mind tarball.');

  const bytes = await readFile(tarballPath);
  assert.equal(bytes.byteLength, manifest.tarball.bytes, 'Restored tarball size does not match the manifest.');
  assert.equal(
    createHash('sha256').update(bytes).digest('hex'),
    manifest.tarball.sha256,
    'Restored tarball digest does not match the manifest.'
  );

  await mkdir(mindDir, { recursive: true });
  const extract = spawnSync('tar', ['-xzf', tarballPath, '-C', mindDir], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  assertSuccess(extract, 'Expected tar to extract the restored mind.');

  return mindDir;
}

function think(mindDir, args) {
  const result = spawnSync(process.execPath, [CLI, ...args, '--json'], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: createHermeticThinkEnv({
      homeDir: mindDir,
      upstreamUrl: '',
      extraEnv: { THINK_REPO_DIR: mindDir },
    }),
  });
  assertSuccess(result, `Expected think ${args.join(' ')} to succeed against the restored mind.`);

  return result.stdout
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
}

test('git-cas restores the canonical mind as a readable Git repository', {
  timeout: RESTORE_TIMEOUT_MS,
}, async (t) => {
  const manifest = await readManifest();
  if (!hasRestorableAsset(manifest)) {
    t.skip(`git-cas object ${manifest.treeOid} is not present; refs/cas/* are not in this checkout.`);
    return;
  }

  const mindDir = await restoreMind(manifest);
  assert.ok(existsSync(path.join(mindDir, '.git')), 'Expected the restored mind to be a Git repository.');

  const revList = spawnSync('git', ['-C', mindDir, 'rev-list', '--count', '--all'], { encoding: 'utf8' });
  assertSuccess(revList, 'Expected the restored mind to be readable by Git.');
  assert.equal(
    Number.parseInt(revList.stdout.trim(), 10),
    manifest.expected.commitCount,
    'Restored mind carries a different amount of history than the manifest records.'
  );
});

test('the canonical mind reads back its exact captures', {
  timeout: RESTORE_TIMEOUT_MS,
}, async (t) => {
  const manifest = await readManifest();
  if (!hasRestorableAsset(manifest)) {
    t.skip(`git-cas object ${manifest.treeOid} is not present; refs/cas/* are not in this checkout.`);
    return;
  }

  const mindDir = await restoreMind(manifest);
  const entries = think(mindDir, ['--recent']).filter((event) => event.event === 'recent.entry');

  assert.equal(entries.length, manifest.expected.visibleEntryCount, 'Unexpected number of visible captures.');
  assert.deepEqual(
    entries.map((entry) => entry.text),
    manifest.expected.visibleTexts,
    'Restored mind surfaced different capture text than the manifest records.'
  );
  assert.deepEqual(
    entries.map((entry) => entry.entryId),
    manifest.expected.visibleEntryIds,
    'Restored mind surfaced different entry ids than the manifest records.'
  );

  const [stats] = think(mindDir, ['--stats']).filter((event) => event.event === 'stats.total');
  assert.equal(stats.total, manifest.expected.statsTotal, 'Restored mind reports a different capture total.');
});

test('explicit recall works against restored history', {
  timeout: RESTORE_TIMEOUT_MS,
}, async (t) => {
  const manifest = await readManifest();
  if (!hasRestorableAsset(manifest)) {
    t.skip(`git-cas object ${manifest.treeOid} is not present; refs/cas/* are not in this checkout.`);
    return;
  }

  const mindDir = await restoreMind(manifest);
  const matches = think(mindDir, ['--remember', 'burritos'])
    .filter((event) => event.event === 'remember.match');

  assert.ok(matches.length > 0, 'Expected an explicit query to match the archived capture about burritos.');
  assert.match(matches[0].text, /burritos/iu, 'Expected the match to carry the archived text.');
  assert.equal(matches[0].tier, 1, 'Expected an explicit query match to be tier 1.');
});

test('the deferred capture is durable in Git yet missing from the read surfaces', {
  timeout: RESTORE_TIMEOUT_MS,
}, async (t) => {
  const manifest = await readManifest();
  if (!hasRestorableAsset(manifest)) {
    t.skip(`git-cas object ${manifest.treeOid} is not present; refs/cas/* are not in this checkout.`);
    return;
  }

  const mindDir = await restoreMind(manifest);
  const { needle, gitObject } = manifest.expected.deferred;

  // Durable: the raw thought is in Git and readable.
  const object = spawnSync('git', ['-C', mindDir, 'cat-file', '-p', gitObject], { encoding: 'utf8' });
  assertSuccess(object, `Expected the archived Git object ${gitObject} to be readable.`);
  assert.match(object.stdout, new RegExp(needle, 'u'), 'Expected the deferred capture text to survive in Git.');

  // Missing: the read surfaces do not account for it. This is the defect the
  // fixture pins, not behaviour to preserve — when it is fixed, this assertion
  // should be inverted rather than deleted.
  const visible = think(mindDir, ['--recent'])
    .filter((event) => event.event === 'recent.entry')
    .map((event) => event.text);
  assert.ok(
    visible.every((text) => !text.includes(needle)),
    'Deferred capture is now visible in recent; if the read-model defect is fixed, invert this assertion.'
  );
  assert.equal(
    manifest.expected.statsTotal,
    manifest.expected.visibleEntryCount,
    'stats and recent should agree with each other even while both omit the deferred capture.'
  );

  // remember is pinned to what THIS artifact does, not to a contract. A separate
  // reproduction had it return zero for a deferred capture while this frozen mind
  // returns one — that disagreement is the defect, so the assertion records the
  // instance and the manifest says so.
  const matches = think(mindDir, ['--remember', needle])
    .filter((event) => event.event === 'remember.match');

  assert.equal(
    matches.length,
    manifest.expected.deferred.rememberMatchCount,
    'Restored mind disagrees with the recall behaviour recorded in its manifest.'
  );
});
