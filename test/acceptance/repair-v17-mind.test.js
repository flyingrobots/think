import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import {
  resolveGitWarpPackageRoot,
} from '../../scripts/repair-v17-mind.mjs';
import { baseEnv, formatResult, repoRoot } from '../fixtures/runtime.js';
import { createTempDir } from '../fixtures/tmp.js';
import { assertSuccess } from '../support/assertions.js';

const FIXTURE_METADATA_PATH = path.join(repoRoot, 'test', 'fixtures', 'cas', 'gemini-pre-v17-mind.json');
const GIT_CAS_ENTRYPOINT = path.join(repoRoot, 'node_modules', '@git-stunts', 'git-cas', 'bin', 'git-cas.js');
const REPAIR_ENTRYPOINT = path.join(repoRoot, 'scripts', 'repair-v17-mind.mjs');
const RESTORE_TIMEOUT_MS = 120_000;
const GRAPH = 'think';

test('git-cas fixture restores an archived pre-v17 Gemini mind tarball', async () => {
  const fixture = await readGeminiFixtureMetadata();
  const { mindDir, tarballPath } = await restoreGeminiFixture(fixture);

  assert.ok(existsSync(tarballPath), 'Expected git-cas restore to recreate the fixture tarball.');
  assert.ok(existsSync(path.join(mindDir, '.git')), 'Expected tar extraction to recreate a Git repository.');

  const checkpoint = runGit(mindDir, ['rev-parse', '--verify', `refs/warp/${GRAPH}/checkpoints/head`]);
  assertSuccess(checkpoint, 'Expected restored fixture to expose the old git-warp checkpoint ref.');
  assert.equal(checkpoint.stdout.trim(), fixture.source.checkpoint);

  const checkpointLog = runGit(mindDir, ['log', '-1', '--format=%B', fixture.source.checkpoint]);
  assertSuccess(checkpointLog, 'Expected restored checkpoint to be readable as a Git commit.');
  assert.match(
    checkpointLog.stdout,
    new RegExp(`^eg-schema: ${fixture.source.schema}$`, 'm'),
    'Expected the restored fixture checkpoint to preserve schema 4.'
  );
});

test('repair-v17 mind repairs the restored git-cas fixture when v17 migration is installed', {
  timeout: RESTORE_TIMEOUT_MS,
}, async (t) => {
  if (!hasV17GitWarpMigration()) {
    t.skip('Installed @git-stunts/git-warp package does not expose the v17 checkpoint migration.');
    return;
  }

  const fixture = await readGeminiFixtureMetadata();
  const { mindDir } = await restoreGeminiFixture(fixture);

  const before = parseRepairJson(
    runRepair(mindDir, ['--dry-run']),
    'Expected dry-run repair to inspect the restored fixture.'
  );
  assert.equal(before.ok, true);
  assert.equal(before.wouldRepair, true);
  assert.equal(before.beforeCheckpoint, fixture.source.checkpoint);
  assert.equal(before.upgrade.before, 'needed');
  assert.equal(before.upgrade.rawBefore.previousSchema, fixture.source.schema);
  assert.equal(before.upgrade.rawBefore.currentSchema, fixture.expected.upgradedSchema);

  const repaired = parseRepairJson(
    runRepair(mindDir),
    'Expected repair to upgrade and materialize the restored fixture.'
  );
  assert.equal(repaired.ok, true);
  assert.equal(repaired.changed, true);
  assert.equal(repaired.beforeCheckpoint, fixture.source.checkpoint);
  assert.notEqual(repaired.afterCheckpoint, fixture.source.checkpoint);
  assert.match(
    repaired.backupRef,
    /^refs\/warp\/think\/checkpoints\/pre-v17-upgrade-\d{8}-\d{6}(?:-\d{2})?$/u
  );
  assert.equal(repaired.upgrade.before, 'needed');
  assert.equal(repaired.upgrade.after, 'already-current');
  assert.equal(repaired.check.patchesSinceCheckpoint, 0);
  assert.equal(repaired.doctor.failures, 0);

  const after = parseRepairJson(
    runRepair(mindDir, ['--dry-run']),
    'Expected repaired fixture to be current on a follow-up dry run.'
  );
  assert.equal(after.ok, true);
  assert.equal(after.wouldRepair, false);
  assert.equal(after.upgrade.before, 'already-current');
});

async function readGeminiFixtureMetadata() {
  const contents = await readFile(FIXTURE_METADATA_PATH, 'utf8');
  return JSON.parse(contents);
}

async function restoreGeminiFixture(fixture) {
  const parentDir = await createTempDir('think-gemini-pre-v17-fixture-');
  const mindDir = path.join(parentDir, 'mind');
  const tarballPath = path.join(parentDir, fixture.tarball.name);

  assert.ok(
    existsSync(GIT_CAS_ENTRYPOINT),
    `Expected git-cas test dependency to exist at ${GIT_CAS_ENTRYPOINT}`
  );

  const restore = spawnSync(process.execPath, [
    GIT_CAS_ENTRYPOINT,
    '--json',
    'restore',
    '--oid',
    fixture.treeOid,
    '--out',
    tarballPath,
    '--cwd',
    repoRoot,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: fixtureEnv(),
  });
  assertSuccess(restore, 'Expected git-cas to restore the archived Gemini fixture tarball.');
  await assertRestoredTarball(tarballPath, fixture);

  await mkdir(mindDir, { recursive: true });
  const extract = spawnSync('tar', ['-xzf', tarballPath, '-C', mindDir], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: fixtureEnv(),
  });
  assertSuccess(extract, 'Expected tar to extract the git-cas restored Gemini fixture.');

  return Object.freeze({
    mindDir,
    parentDir,
    tarballPath,
  });
}

function runRepair(mindDir, extraArgs = []) {
  return spawnSync(process.execPath, [
    REPAIR_ENTRYPOINT,
    '--repo',
    mindDir,
    '--graph',
    GRAPH,
    '--json',
    ...extraArgs,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: fixtureEnv(),
  });
}

function runGit(repoDir, args) {
  return spawnSync('git', ['-C', repoDir, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: fixtureEnv(),
  });
}

function parseRepairJson(result, message) {
  assertSuccess(result, message);
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    throw new assert.AssertionError({
      message: `${message}\nCould not parse repair JSON: ${String(error)}\n${formatResult(result)}`,
    });
  }
}

async function assertRestoredTarball(tarballPath, fixture) {
  const contents = await readFile(tarballPath);
  assert.equal(contents.byteLength, fixture.tarball.bytes);
  assert.equal(
    createHash('sha256').update(contents).digest('hex'),
    fixture.tarball.sha256
  );
}

function hasV17GitWarpMigration() {
  try {
    const packageRoot = resolveGitWarpPackageRoot();
    return existsSync(path.join(
      packageRoot,
      'dist',
      'scripts',
      'migrations',
      'v17.0.0',
      'checkpoint-schema-upgrade.js'
    ));
  } catch {
    return false;
  }
}

function fixtureEnv() {
  return {
    ...process.env,
    ...baseEnv,
    COPYFILE_DISABLE: '1',
  };
}
