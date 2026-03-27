#!/usr/bin/env node

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createSyntheticBrowseFixture, prepareBrowseBootstrap } from '../src/browse-benchmark.js';
import { getLocalRepoDir } from '../src/paths.js';

const DEFAULT_CAPTURE_COUNT = 100;
const DEFAULT_SESSION_COUNT = 10;
const DEFAULT_WARMUP_COUNT = 1;
const DEFAULT_RUN_COUNT = 5;
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function main(argv) {
  const options = parseArgs(argv);
  validateOptions(options);

  const homeDir = await mkdtemp(path.join(os.tmpdir(), 'think-browse-benchmark-'));
  process.env.HOME = homeDir;
  delete process.env.THINK_REPO_DIR;

  const repoDir = getLocalRepoDir();

  try {
    await mkdir(path.dirname(repoDir), { recursive: true });
    const fixture = await createSyntheticBrowseFixture({
      repoDir,
      captureCount: options.captureCount,
      sessionCount: options.sessionCount,
    });

    const warmupSamples = [];
    for (let index = 0; index < options.warmupCount; index += 1) {
      warmupSamples.push(await measureBrowseBootstrap(repoDir));
    }

    const samples = [];
    for (let index = 0; index < options.runCount; index += 1) {
      samples.push(await measureBrowseBootstrap(repoDir));
    }

    const report = {
      benchmark: 'browse-bootstrap',
      capturedAt: new Date().toISOString(),
      commitSha: readCommitSha(),
      nodeVersion: process.version,
      platform: `${process.platform}-${process.arch}`,
      fixture: {
        captureCount: fixture.captureCount,
        sessionCount: fixture.sessionCount,
        startTimeMs: fixture.startTimeMs,
        endTimeMs: fixture.endTimeMs,
        withinSessionGapMs: fixture.withinSessionGapMs,
        betweenSessionGapMs: fixture.betweenSessionGapMs,
      },
      measurement: {
        metric: 'browseBootstrapMs',
        warmupCount: options.warmupCount,
        runCount: options.runCount,
        warmupSamplesMs: warmupSamples,
        samplesMs: samples,
      },
      summary: summarizeSamples(samples),
    };

    if (options.outPath) {
      await mkdir(path.dirname(options.outPath), { recursive: true });
      await writeFile(options.outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    }

    if (options.json) {
      process.stdout.write(JSON.stringify(report));
    } else {
      process.stdout.write(formatHumanReport(report, options.outPath));
    }
  } finally {
    await rm(homeDir, { recursive: true, force: true });
  }
}

async function measureBrowseBootstrap(repoDir) {
  const started = process.hrtime.bigint();
  const bootstrap = await prepareBrowseBootstrap(repoDir);
  const ended = process.hrtime.bigint();

  if (!bootstrap.ok) {
    throw new Error(`Browse bootstrap failed during benchmark: ${bootstrap.reason ?? 'unknown reason'}`);
  }

  return Number(ended - started) / 1_000_000;
}

function summarizeSamples(samples) {
  const sorted = [...samples].sort((left, right) => left - right);
  const total = samples.reduce((sum, value) => sum + value, 0);
  return {
    minMs: sorted[0] ?? 0,
    maxMs: sorted.at(-1) ?? 0,
    meanMs: samples.length > 0 ? total / samples.length : 0,
    medianMs: percentile(sorted, 0.5),
    p95Ms: percentile(sorted, 0.95),
  };
}

function percentile(sorted, p) {
  if (sorted.length === 0) {
    return 0;
  }

  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * p) - 1));
  return sorted[index];
}

function formatHumanReport(report, outPath) {
  return [
    'Browse Bootstrap Benchmark',
    `Commit: ${report.commitSha}`,
    `Captured at: ${report.capturedAt}`,
    `Fixture: ${report.fixture.captureCount} captures across ${report.fixture.sessionCount} sessions`,
    `Runs: ${report.measurement.runCount} (${report.measurement.warmupCount} warmup)`,
    `Min: ${report.summary.minMs.toFixed(3)} ms`,
    `Median: ${report.summary.medianMs.toFixed(3)} ms`,
    `Mean: ${report.summary.meanMs.toFixed(3)} ms`,
    `P95: ${report.summary.p95Ms.toFixed(3)} ms`,
    `Max: ${report.summary.maxMs.toFixed(3)} ms`,
    ...(outPath ? [`Report: ${outPath}`] : []),
    '',
  ].join('\n');
}

function parseArgs(argv) {
  const options = {
    captureCount: DEFAULT_CAPTURE_COUNT,
    sessionCount: DEFAULT_SESSION_COUNT,
    warmupCount: DEFAULT_WARMUP_COUNT,
    runCount: DEFAULT_RUN_COUNT,
    json: false,
    outPath: null,
  };

  for (const arg of argv.slice(2)) {
    if (arg === '--json') {
      options.json = true;
    } else if (arg.startsWith('--thoughts=')) {
      options.captureCount = parseIntegerArg(arg, '--thoughts=');
    } else if (arg.startsWith('--sessions=')) {
      options.sessionCount = parseIntegerArg(arg, '--sessions=');
    } else if (arg.startsWith('--warmup=')) {
      options.warmupCount = parseIntegerArg(arg, '--warmup=');
    } else if (arg.startsWith('--runs=')) {
      options.runCount = parseIntegerArg(arg, '--runs=');
    } else if (arg.startsWith('--out=')) {
      options.outPath = path.resolve(arg.slice('--out='.length));
    } else {
      throw new Error(`Unknown benchmark option: ${arg}`);
    }
  }

  return options;
}

function parseIntegerArg(arg, prefix) {
  const value = Number.parseInt(arg.slice(prefix.length), 10);
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid integer option: ${arg}`);
  }
  return value;
}

function validateOptions(options) {
  if (!Number.isInteger(options.captureCount) || options.captureCount <= 0) {
    throw new Error('Capture count must be a positive integer.');
  }
  if (!Number.isInteger(options.sessionCount) || options.sessionCount <= 0) {
    throw new Error('Session count must be a positive integer.');
  }
  if (options.sessionCount > options.captureCount) {
    throw new Error('Session count cannot exceed capture count.');
  }
  if (!Number.isInteger(options.warmupCount) || options.warmupCount < 0) {
    throw new Error('Warmup count must be a non-negative integer.');
  }
  if (!Number.isInteger(options.runCount) || options.runCount <= 0) {
    throw new Error('Run count must be a positive integer.');
  }
}

function readCommitSha() {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    return 'unknown';
  }

  return result.stdout.trim() || 'unknown';
}

main(process.argv).catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
