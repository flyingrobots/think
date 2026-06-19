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

test('runDiagnostics reports skip for upstream when URL is set but no checker provided', async () => {
  const context = await createDoctorContext({ withRepo: true });
  const result = await runDiagnostics({
    thinkDir: context.thinkDir,
    repoDir: context.repoDir,
    upstreamUrl: 'git@github.com:example/backup.git',
    // no checkUpstreamReachable provided
  });

  const upstreamCheck = findCheck(result, 'upstream');
  assert.equal(upstreamCheck.status, 'skip', 'Expected upstream to skip when checker is not provided, even if URL is set.');
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

test('runDiagnostics reports skip for upstream when configured without checker', async () => {
  const context = await createDoctorContext({ withRepo: true });
  const result = await runDiagnostics({
    thinkDir: context.thinkDir,
    repoDir: context.repoDir,
    upstreamUrl: 'git@github.com:example/think-backup.git',
  });

  const upstreamCheck = findCheck(result, 'upstream');
  assert.equal(upstreamCheck.status, 'skip', 'Expected upstream to skip when configured but no checker provided.');
});

test('runDiagnostics includes all expected check names', async () => {
  const context = await createDoctorContext({ withRepo: true });
  const result = await runDiagnostics({ thinkDir: context.thinkDir, repoDir: context.repoDir });

  const names = result.checks.map((c) => c.name);
  assert.ok(names.includes('think_dir'), 'Expected think_dir check.');
  assert.ok(names.includes('local_repo'), 'Expected local_repo check.');
  assert.ok(names.includes('checkpoint'), 'Expected checkpoint check.');
  assert.ok(names.includes('git_fsmonitor'), 'Expected git_fsmonitor check.');
  assert.ok(names.includes('graph_model'), 'Expected graph_model check.');
  assert.ok(names.includes('entry_count'), 'Expected entry_count check.');
  assert.ok(names.includes('upstream'), 'Expected upstream check.');
});

test('runDiagnostics skips graph and entry checks when no fast checker is provided', async () => {
  const context = await createDoctorContext({ withRepo: true });
  const result = await runDiagnostics({ thinkDir: context.thinkDir, repoDir: context.repoDir });

  const graphCheck = findCheck(result, 'graph_model');
  assert.equal(graphCheck.status, 'skip', 'Expected graph_model to skip without a checker.');
  assert.match(graphCheck.message, /no fast checker/, 'Expected graph skip reason to mention missing checker.');

  const countCheck = findCheck(result, 'entry_count');
  assert.equal(countCheck.status, 'skip', 'Expected entry_count to skip without a checker.');
  assert.match(countCheck.message, /no fast checker/, 'Expected count skip reason to mention missing checker.');
});

test('runDiagnostics reports History model version when available', async () => {
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

test('runDiagnostics warns when History model needs migration', async () => {
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

test('runDiagnostics reports ok when fsmonitor is disabled locally', async () => {
  const context = await createDoctorContext({ withRepo: true });
  const result = await runDiagnostics({
    thinkDir: context.thinkDir,
    repoDir: context.repoDir,
    getFsmonitorStatus: () => ({
      effectiveValue: 'false',
      effectiveSource: 'file:.git/config',
      localValue: 'false',
      globalValue: 'true',
    }),
  });

  const fsmonitorCheck = findCheck(result, 'git_fsmonitor');
  assert.equal(fsmonitorCheck.status, 'ok', 'Expected fsmonitor to pass when local config disables it.');
  assert.match(fsmonitorCheck.message, /disabled locally/, 'Expected local override to be mentioned.');
});

test('runDiagnostics fails when checkpoint cache schema is unsupported', async () => {
  const context = await createDoctorContext({ withRepo: true });
  const result = await runDiagnostics({
    thinkDir: context.thinkDir,
    repoDir: context.repoDir,
    getCheckpointStatus: () => ({
      exists: true,
      ref: 'refs/warp/think/checkpoints/head',
      checkpointSha: 'abc123',
      schema: 4,
      supportedSchema: 5,
      supported: false,
    }),
  });

  const checkpointCheck = findCheck(result, 'checkpoint');
  assert.equal(checkpointCheck.status, 'fail', 'Expected unsupported checkpoint schema to fail.');
  assert.match(checkpointCheck.message, /schema 4/, 'Expected current checkpoint schema in message.');
  assert.match(checkpointCheck.message, /update-ref -d/, 'Expected remediation command.');
});

test('runDiagnostics fixes unsupported checkpoint cache when requested', async () => {
  const context = await createDoctorContext({ withRepo: true });
  let fixed = false;

  const result = await runDiagnostics({
    thinkDir: context.thinkDir,
    repoDir: context.repoDir,
    fix: true,
    getCheckpointStatus: () => fixed
      ? {
          exists: false,
          ref: 'refs/warp/think/checkpoints/head',
          checkpointSha: null,
          schema: null,
          supportedSchema: 5,
          supported: true,
        }
      : {
          exists: true,
          ref: 'refs/warp/think/checkpoints/head',
          checkpointSha: 'abc123',
          schema: 4,
          supportedSchema: 5,
          supported: false,
        },
    fixCheckpoint: () => {
      fixed = true;
    },
  });

  assert.equal(fixed, true, 'Expected checkpoint fixer to run.');

  const fix = result.fixes.find((candidate) => candidate.name === 'checkpoint');
  assert.ok(fix, 'Expected checkpoint fix result.');
  assert.equal(fix.status, 'ok', 'Expected checkpoint fix to pass.');

  const checkpointCheck = findCheck(result, 'checkpoint');
  assert.equal(checkpointCheck.status, 'warn', 'Expected final checkpoint check to warn when cache is absent.');
});

test('runDiagnostics fails when fsmonitor is effectively enabled', async () => {
  const context = await createDoctorContext({ withRepo: true });
  const result = await runDiagnostics({
    thinkDir: context.thinkDir,
    repoDir: context.repoDir,
    getFsmonitorStatus: () => ({
      effectiveValue: 'true',
      effectiveSource: 'file:/Users/example/.gitconfig',
      localValue: null,
      globalValue: 'true',
    }),
  });

  const fsmonitorCheck = findCheck(result, 'git_fsmonitor');
  assert.equal(fsmonitorCheck.status, 'fail', 'Expected fsmonitor to fail when effective config enables it.');
  assert.match(fsmonitorCheck.message, /core\.fsmonitor=true/, 'Expected enabled config value in message.');
  assert.match(fsmonitorCheck.message, /git -C .* config core\.fsmonitor false/, 'Expected remediation command.');
});

test('runDiagnostics fixes enabled fsmonitor when requested', async () => {
  const context = await createDoctorContext({ withRepo: true });
  let fixed = false;

  const result = await runDiagnostics({
    thinkDir: context.thinkDir,
    repoDir: context.repoDir,
    fix: true,
    getFsmonitorStatus: () => fixed
      ? {
          effectiveValue: 'false',
          effectiveSource: 'file:.git/config',
          localValue: 'false',
          globalValue: 'true',
        }
      : {
          effectiveValue: 'true',
          effectiveSource: 'file:/Users/example/.gitconfig',
          localValue: null,
          globalValue: 'true',
        },
    fixFsmonitor: () => {
      fixed = true;
    },
  });

  assert.equal(fixed, true, 'Expected fsmonitor fixer to run.');

  const fix = result.fixes.find((candidate) => candidate.name === 'git_fsmonitor');
  assert.ok(fix, 'Expected fsmonitor fix result.');
  assert.equal(fix.status, 'ok', 'Expected fsmonitor fix to pass.');

  const fsmonitorCheck = findCheck(result, 'git_fsmonitor');
  assert.equal(fsmonitorCheck.status, 'ok', 'Expected final fsmonitor check to pass after fix.');
});

test('runDiagnostics reports skipped fsmonitor fix when no fixer is available', async () => {
  const context = await createDoctorContext({ withRepo: true });
  const result = await runDiagnostics({
    thinkDir: context.thinkDir,
    repoDir: context.repoDir,
    fix: true,
    getFsmonitorStatus: () => ({
      effectiveValue: 'true',
      effectiveSource: 'file:/Users/example/.gitconfig',
      localValue: null,
      globalValue: 'true',
    }),
  });

  const fix = result.fixes.find((candidate) => candidate.name === 'git_fsmonitor');
  assert.ok(fix, 'Expected fsmonitor fix result.');
  assert.equal(fix.status, 'skip', 'Expected fsmonitor fix to skip when no fixer is provided.');

  const fsmonitorCheck = findCheck(result, 'git_fsmonitor');
  assert.equal(fsmonitorCheck.status, 'fail', 'Expected final fsmonitor check to remain failed.');
});

test('runDiagnostics reports ok when fsmonitor is not configured', async () => {
  const context = await createDoctorContext({ withRepo: true });
  const result = await runDiagnostics({
    thinkDir: context.thinkDir,
    repoDir: context.repoDir,
    getFsmonitorStatus: () => ({
      effectiveValue: null,
      effectiveSource: null,
      localValue: null,
      globalValue: null,
    }),
  });

  const fsmonitorCheck = findCheck(result, 'git_fsmonitor');
  assert.equal(fsmonitorCheck.status, 'ok', 'Expected fsmonitor to pass when unset.');
  assert.match(fsmonitorCheck.message, /not configured/, 'Expected unset config to be mentioned.');
});

test('runDiagnostics warns when fsmonitor inspection fails', async () => {
  const context = await createDoctorContext({ withRepo: true });
  const result = await runDiagnostics({
    thinkDir: context.thinkDir,
    repoDir: context.repoDir,
    getFsmonitorStatus: () => {
      throw new Error('config read failed');
    },
  });

  const fsmonitorCheck = findCheck(result, 'git_fsmonitor');
  assert.equal(fsmonitorCheck.status, 'warn', 'Expected fsmonitor inspection failures to warn.');
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
