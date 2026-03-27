import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

import { repoRoot, baseEnv } from '../fixtures/runtime.js';
import { createTempDir } from '../fixtures/tmp.js';

const benchmarkEntrypoint = path.join(repoRoot, 'benchmarks', 'browse-bootstrap.js');

test('browse benchmark emits a deterministic JSON report for a synthetic fixture graph', async () => {
  const result = runBrowseBenchmark(['--json', '--thoughts=12', '--sessions=3', '--warmup=0', '--runs=2']);

  assert.equal(result.status, 0, formatResult(result));
  assert.equal((result.stderr || '').trim(), '', 'Expected JSON benchmark run to keep stderr quiet.');

  const report = JSON.parse(result.stdout);

  assert.equal(report.benchmark, 'browse-bootstrap', 'Expected benchmark name to stay explicit.');
  assert.equal(report.fixture.captureCount, 12, 'Expected fixture report to preserve the requested capture count.');
  assert.equal(report.fixture.sessionCount, 3, 'Expected fixture report to preserve the requested session count.');
  assert.equal(report.measurement.metric, 'browseBootstrapMs', 'Expected benchmark report to name the measured metric.');
  assert.equal(report.measurement.warmupCount, 0, 'Expected benchmark report to preserve the requested warmup count.');
  assert.equal(report.measurement.runCount, 2, 'Expected benchmark report to preserve the requested run count.');
  assert.equal(report.measurement.samplesMs.length, 2, 'Expected benchmark report to emit one sample per measured run.');
  assert.ok(report.measurement.samplesMs.every((sample) => typeof sample === 'number' && sample >= 0),
    'Expected benchmark samples to be non-negative numbers.');
  assert.equal(typeof report.summary.meanMs, 'number', 'Expected benchmark report to expose summary stats.');
  assert.equal(typeof report.summary.medianMs, 'number', 'Expected benchmark report to expose summary stats.');
});

test('browse benchmark can persist a baseline report to disk', async () => {
  const tempDir = await createTempDir('browse-benchmark-');
  const outPath = path.join(tempDir, 'browse-bootstrap-before.json');

  const result = runBrowseBenchmark([
    '--json',
    '--thoughts=8',
    '--sessions=2',
    '--warmup=0',
    '--runs=1',
    `--out=${outPath}`,
  ]);

  assert.equal(result.status, 0, formatResult(result));
  assert.ok(existsSync(outPath), `Expected benchmark to persist a report at ${outPath}.`);

  const report = JSON.parse(readFileSync(outPath, 'utf8'));
  assert.equal(report.fixture.captureCount, 8, 'Expected persisted report to preserve fixture shape.');
  assert.equal(report.fixture.sessionCount, 2, 'Expected persisted report to preserve fixture shape.');
  assert.equal(report.measurement.runCount, 1, 'Expected persisted report to preserve measurement config.');
});

function runBrowseBenchmark(args) {
  return spawnSync(process.execPath, [benchmarkEntrypoint, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      ...baseEnv,
      NO_COLOR: '1',
    },
  });
}

function formatResult(result) {
  return [
    `exit status: ${result.status}`,
    `signal: ${result.signal ?? 'none'}`,
    'stdout:',
    result.stdout || '(empty)',
    'stderr:',
    result.stderr || '(empty)',
  ].join('\n');
}
