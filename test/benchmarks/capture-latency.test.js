import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';

import { repoRoot } from '../fixtures/runtime.js';

const benchmarkScript = path.join(repoRoot, 'benchmarks', 'capture-latency.js');

test('capture latency benchmark runs and produces valid JSON output', () => {
  const result = spawnSync(process.execPath, [benchmarkScript, '--json', '--runs=3', '--warmup=1'], {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: 30_000,
  });

  assert.equal(result.status, 0, `Benchmark exited with status ${result.status}:\n${result.stderr}`);

  const report = JSON.parse(result.stdout);

  assert.equal(report.benchmark, 'capture-latency', 'Expected benchmark name to be capture-latency.');
  assert.equal(typeof report.capturedAt, 'string', 'Expected capturedAt to be an ISO timestamp.');
  assert.equal(typeof report.commitSha, 'string', 'Expected commitSha to be present.');

  assert.equal(report.measurement.runCount, 3, 'Expected 3 measured runs.');
  assert.equal(report.measurement.warmupCount, 1, 'Expected 1 warmup run.');
  assert.equal(report.measurement.samplesMs.length, 3, 'Expected 3 sample timings.');
  assert.ok(report.measurement.samplesMs.every((s) => typeof s === 'number' && s > 0), 'Expected all samples to be positive numbers.');

  assert.equal(typeof report.summary.minMs, 'number', 'Expected minMs in summary.');
  assert.equal(typeof report.summary.maxMs, 'number', 'Expected maxMs in summary.');
  assert.equal(typeof report.summary.meanMs, 'number', 'Expected meanMs in summary.');
  assert.equal(typeof report.summary.medianMs, 'number', 'Expected medianMs in summary.');
  assert.equal(typeof report.summary.p95Ms, 'number', 'Expected p95Ms in summary.');

  assert.ok(report.summary.minMs > 0, 'Expected minMs to be positive.');
  assert.ok(report.summary.minMs <= report.summary.medianMs, 'Expected minMs <= medianMs.');
  assert.ok(report.summary.medianMs <= report.summary.maxMs, 'Expected medianMs <= maxMs.');
});

test('capture latency benchmark produces readable human output by default', () => {
  const result = spawnSync(process.execPath, [benchmarkScript, '--runs=2', '--warmup=0'], {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: 30_000,
  });

  assert.equal(result.status, 0, `Benchmark exited with status ${result.status}:\n${result.stderr}`);
  assert.match(result.stdout, /Capture Latency Benchmark/, 'Expected human-readable header.');
  assert.match(result.stdout, /Median:/, 'Expected median in human output.');
  assert.match(result.stdout, /P95:/, 'Expected p95 in human output.');
});

test('capture latency benchmark uses an isolated temp repo', () => {
  const result = spawnSync(process.execPath, [benchmarkScript, '--json', '--runs=2', '--warmup=0'], {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: 30_000,
  });

  assert.equal(result.status, 0);

  const report = JSON.parse(result.stdout);
  assert.ok(report.fixture.repoDir.includes('think-capture-benchmark'), 'Expected temp repo path to indicate isolation.');
});
