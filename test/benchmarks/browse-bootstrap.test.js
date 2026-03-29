import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

import {
  createSyntheticBrowseFixture,
  loadBrowseChronologyEntriesForBenchmark,
  prepareBrowseBootstrap,
} from '../../src/browse-benchmark.js';
import { repoRoot, baseEnv } from '../fixtures/runtime.js';
import { createTempDir } from '../fixtures/tmp.js';

const benchmarkEntrypoint = path.join(repoRoot, 'benchmarks', 'browse-bootstrap.js');

test('prepareBrowseBootstrap returns the latest capture window from graph-native browse edges', async () => {
  const tempDir = await createTempDir('browse-bootstrap-fixture-');
  const repoDir = path.join(tempDir, 'repo');

  await createSyntheticBrowseFixture({
    repoDir,
    captureCount: 12,
    sessionCount: 3,
  });

  const bootstrap = await prepareBrowseBootstrap(repoDir);

  assert.equal(bootstrap.ok, true, 'Expected graph-native browse bootstrap to succeed on a populated fixture.');
  assert.equal('entries' in bootstrap, false,
    'Expected browse bootstrap to return only the first-paint window, not a preloaded chronology corpus.');
  assert.equal(bootstrap.current.id, 'entry:1774023930000-bench-0012', 'Expected bootstrap to start from the latest capture anchor.');
  assert.match(bootstrap.current.text, /Benchmark thought 12\./, 'Expected bootstrap to load the current thought text.');
  assert.equal(bootstrap.older?.id, 'entry:1774023900000-bench-0011', 'Expected bootstrap to expose the immediate older chronology neighbor.');
  assert.equal(bootstrap.newer, null, 'Expected the latest capture not to have a newer chronology neighbor.');
  assert.equal(bootstrap.sessionContext?.sessionId, 'session:1774023840000-bench-0009', 'Expected bootstrap to surface the current session identity.');
  assert.equal(bootstrap.sessionContext?.sessionPosition, 4, 'Expected bootstrap to expose the current position within the session.');
  assert.equal(bootstrap.sessionContext?.sessionCount, 4, 'Expected bootstrap to expose the current session size.');
});

test('loadBrowseChronologyEntries follows graph-native older edges newest-first', async () => {
  const tempDir = await createTempDir('browse-chronology-fixture-');
  const repoDir = path.join(tempDir, 'repo');

  await createSyntheticBrowseFixture({
    repoDir,
    captureCount: 8,
    sessionCount: 2,
  });

  const entries = await loadBrowseChronologyEntriesForBenchmark(repoDir);

  assert.equal(entries.length, 8, 'Expected chronology traversal to return every capture.');
  assert.equal(entries[0].id, 'entry:1774023210000-bench-0008', 'Expected chronology traversal to start from the latest capture anchor.');
  assert.equal(entries.at(-1)?.id, 'entry:1774022400000-bench-0001', 'Expected chronology traversal to end at the oldest capture.');
  assert.match(entries[0].text, /Benchmark thought 8\./, 'Expected chronology traversal to preserve the newest capture text.');
  assert.match(entries.at(-1)?.text ?? '', /Benchmark thought 1\./, 'Expected chronology traversal to preserve the oldest capture text.');
});

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
