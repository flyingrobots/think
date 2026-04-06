import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';

import { repoRoot } from '../fixtures/runtime.js';

const benchmarkScript = path.join(repoRoot, 'benchmarks', 'capture-latency.js');

test('capture latency benchmark with --profile produces phase-level timing breakdown', () => {
  const result = spawnSync(process.execPath, [benchmarkScript, '--json', '--profile', '--runs=2', '--warmup=1'], {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: 30_000,
  });

  assert.equal(result.status, 0, `Benchmark exited with status ${result.status}:\n${result.stderr}`);

  const report = JSON.parse(result.stdout);

  assert.equal(report.benchmark, 'capture-latency', 'Expected benchmark name.');
  assert.ok(report.profile, 'Expected a profile section in the report.');

  const expectedPhases = ['nodeStartup', 'moduleLoad', 'repoEnsure', 'rawSave', 'finalization'];
  for (const phase of expectedPhases) {
    assert.ok(report.profile[phase], `Expected profile to include phase: ${phase}`);
    assert.equal(typeof report.profile[phase].medianMs, 'number', `Expected medianMs for ${phase}.`);
    assert.ok(report.profile[phase].medianMs >= 0, `Expected non-negative medianMs for ${phase}.`);
  }
});

test('capture latency profile phases sum to approximately the total end-to-end time', () => {
  const result = spawnSync(process.execPath, [benchmarkScript, '--json', '--profile', '--runs=3', '--warmup=1'], {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: 30_000,
  });

  assert.equal(result.status, 0);

  const report = JSON.parse(result.stdout);
  const phaseSum = Object.values(report.profile).reduce((sum, phase) => sum + phase.medianMs, 0);
  const totalMedian = report.summary.medianMs;

  // Phases should account for at least 70% of total time (some overhead from process spawn bookkeeping)
  assert.ok(
    phaseSum >= totalMedian * 0.7,
    `Phase sum (${phaseSum.toFixed(0)}ms) should be at least 70% of total (${totalMedian.toFixed(0)}ms).`
  );
});

test('capture latency --profile human output shows phase breakdown', () => {
  const result = spawnSync(process.execPath, [benchmarkScript, '--profile', '--runs=2', '--warmup=0'], {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: 30_000,
  });

  assert.equal(result.status, 0, `Benchmark exited with status ${result.status}:\n${result.stderr}`);
  assert.match(result.stdout, /Phase Breakdown/, 'Expected phase breakdown header.');
  assert.match(result.stdout, /Node startup/, 'Expected Node startup phase.');
  assert.match(result.stdout, /Module load/, 'Expected Module load phase.');
  assert.match(result.stdout, /Raw save/, 'Expected raw save phase.');
  assert.match(result.stdout, /Finalization/, 'Expected finalization phase.');
});
