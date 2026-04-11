import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';

import { createTempDir } from '../fixtures/tmp.js';
import { runDiagnostics } from '../../src/doctor.js';

test('runDiagnostics reports ok for a healthy repo with entries', async () => {
  const context = await createDoctorContext({ withRepo: true, withEntries: true });
  const result = await runDiagnostics({ thinkDir: context.thinkDir, repoDir: context.repoDir });

  assert.ok(Array.isArray(result.checks), 'Expected checks to be an array.');

  const thinkDirCheck = findCheck(result, 'think_dir');
  assert.equal(thinkDirCheck.status, 'ok', 'Expected think_dir check to pass.');

  const repoCheck = findCheck(result, 'local_repo');
  assert.equal(repoCheck.status, 'ok', 'Expected local_repo check to pass.');
});

test('runDiagnostics reports fail when think directory does not exist', async () => {
  const result = await runDiagnostics({
    thinkDir: `/tmp/nonexistent-think-${Date.now()}`,
    repoDir: `/tmp/nonexistent-repo-${Date.now()}`,
  });

  const thinkDirCheck = findCheck(result, 'think_dir');
  assert.equal(thinkDirCheck.status, 'fail', 'Expected think_dir check to fail.');
});

test('runDiagnostics reports fail when local repo has no git init', async () => {
  const thinkDir = await createTempDir('think-doctor-');
  const repoDir = path.join(thinkDir, 'repo');
  mkdirSync(repoDir, { recursive: true });

  const result = await runDiagnostics({ thinkDir, repoDir });

  const repoCheck = findCheck(result, 'local_repo');
  assert.equal(repoCheck.status, 'fail', 'Expected local_repo to fail when no git repo.');
});

test('runDiagnostics reports ok for upstream when reachable', async () => {
  const context = await createDoctorContext({ withRepo: true });
  const result = await runDiagnostics({
    thinkDir: context.thinkDir,
    repoDir: context.repoDir,
    upstreamUrl: 'git@github.com:example/backup.git',
    checkUpstreamReachable: () => true,
  });

  const upstreamCheck = findCheck(result, 'upstream');
  assert.equal(upstreamCheck.status, 'ok', 'Expected upstream to be ok when reachable.');
});

test('runDiagnostics reports warn for upstream when unreachable', async () => {
  const context = await createDoctorContext({ withRepo: true });
  const result = await runDiagnostics({
    thinkDir: context.thinkDir,
    repoDir: context.repoDir,
    upstreamUrl: 'git@github.com:example/backup.git',
    checkUpstreamReachable: () => false,
  });

  const upstreamCheck = findCheck(result, 'upstream');
  assert.equal(upstreamCheck.status, 'warn', 'Expected upstream to warn when unreachable.');
});

test('runDiagnostics reports skip for upstream when not configured', async () => {
  const context = await createDoctorContext({ withRepo: true });
  const result = await runDiagnostics({
    thinkDir: context.thinkDir,
    repoDir: context.repoDir,
    upstreamUrl: '',
  });

  const upstreamCheck = findCheck(result, 'upstream');
  assert.equal(upstreamCheck.status, 'skip', 'Expected upstream check to be skipped when not configured.');
});

test('runDiagnostics reports ok for upstream when configured', async () => {
  const context = await createDoctorContext({ withRepo: true });
  const result = await runDiagnostics({
    thinkDir: context.thinkDir,
    repoDir: context.repoDir,
    upstreamUrl: 'git@github.com:example/think-backup.git',
  });

  const upstreamCheck = findCheck(result, 'upstream');
  assert.equal(upstreamCheck.status, 'ok', 'Expected upstream check to report ok when URL is set.');
});

test('runDiagnostics includes all expected check names', async () => {
  const context = await createDoctorContext({ withRepo: true });
  const result = await runDiagnostics({ thinkDir: context.thinkDir, repoDir: context.repoDir });

  const names = result.checks.map((c) => c.name);
  assert.ok(names.includes('think_dir'), 'Expected think_dir check.');
  assert.ok(names.includes('local_repo'), 'Expected local_repo check.');
  assert.ok(names.includes('graph_model'), 'Expected graph_model check.');
  assert.ok(names.includes('entry_count'), 'Expected entry_count check.');
  assert.ok(names.includes('upstream'), 'Expected upstream check.');
});

test('runDiagnostics reports graph model version when available', async () => {
  const context = await createDoctorContext({ withRepo: true });
  const result = await runDiagnostics({
    thinkDir: context.thinkDir,
    repoDir: context.repoDir,
    getGraphModelStatus: () => ({
      currentGraphModelVersion: 3,
      requiredGraphModelVersion: 3,
      migrationRequired: false,
    }),
  });

  const graphCheck = findCheck(result, 'graph_model');
  assert.equal(graphCheck.status, 'ok', 'Expected graph_model to be ok when current.');
  assert.match(graphCheck.message, /v3/, 'Expected version number in message.');
});

test('runDiagnostics warns when graph model needs migration', async () => {
  const context = await createDoctorContext({ withRepo: true });
  const result = await runDiagnostics({
    thinkDir: context.thinkDir,
    repoDir: context.repoDir,
    getGraphModelStatus: () => ({
      currentGraphModelVersion: 1,
      requiredGraphModelVersion: 3,
      migrationRequired: true,
    }),
  });

  const graphCheck = findCheck(result, 'graph_model');
  assert.equal(graphCheck.status, 'warn', 'Expected graph_model to warn when migration needed.');
});

test('runDiagnostics reports entry count when available', async () => {
  const context = await createDoctorContext({ withRepo: true });
  const result = await runDiagnostics({
    thinkDir: context.thinkDir,
    repoDir: context.repoDir,
    getEntryCount: () => 42,
  });

  const countCheck = findCheck(result, 'entry_count');
  assert.equal(countCheck.status, 'ok', 'Expected entry_count to be ok with entries.');
  assert.match(countCheck.message, /42/, 'Expected count in message.');
});

test('runDiagnostics warns when entry count is zero', async () => {
  const context = await createDoctorContext({ withRepo: true });
  const result = await runDiagnostics({
    thinkDir: context.thinkDir,
    repoDir: context.repoDir,
    getEntryCount: () => 0,
  });

  const countCheck = findCheck(result, 'entry_count');
  assert.equal(countCheck.status, 'warn', 'Expected entry_count to warn when zero.');
});

test('runDiagnostics skips graph and entry checks when no repo exists', async () => {
  const result = await runDiagnostics({
    thinkDir: `/tmp/nonexistent-think-${Date.now()}`,
    repoDir: `/tmp/nonexistent-repo-${Date.now()}`,
  });

  const graphCheck = findCheck(result, 'graph_model');
  assert.equal(graphCheck.status, 'skip', 'Expected graph_model to skip without repo.');

  const countCheck = findCheck(result, 'entry_count');
  assert.equal(countCheck.status, 'skip', 'Expected entry_count to skip without repo.');
});

// --- Helpers ---

function findCheck(result, name) {
  const check = result.checks.find((c) => c.name === name);
  assert.ok(check, `Expected to find check "${name}" in result.`);
  return check;
}

async function createDoctorContext({ withRepo = false } = {}) {
  const thinkDir = await createTempDir('think-doctor-');
  const repoDir = path.join(thinkDir, 'repo');

  if (withRepo) {
    mkdirSync(repoDir, { recursive: true });
    execSync('git init', { cwd: repoDir, stdio: 'ignore' });
  }

  return { thinkDir, repoDir };
}
