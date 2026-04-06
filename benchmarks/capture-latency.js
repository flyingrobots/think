#!/usr/bin/env node

import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_WARMUP_COUNT = 2;
const DEFAULT_RUN_COUNT = 10;
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cliEntrypoint = path.join(repoRoot, 'bin', 'think.js');
const noopScript = path.join(repoRoot, 'benchmarks', 'noop.js');

async function main(argv) {
  const options = parseArgs(argv);
  validateOptions(options);

  const homeDir = await mkdtemp(path.join(os.tmpdir(), 'think-capture-benchmark-'));
  const thinkDir = path.join(homeDir, '.think');
  const repoDir = path.join(thinkDir, 'repo');

  try {
    await mkdir(thinkDir, { recursive: true });

    // Bootstrap the repo with one capture so warmup/run samples hit the warm path
    capture(homeDir, 'benchmark bootstrap capture');

    const warmupSamples = [];
    for (let index = 0; index < options.warmupCount; index += 1) {
      warmupSamples.push(measureCapture(homeDir, `warmup thought ${index}`));
    }

    const samples = [];
    for (let index = 0; index < options.runCount; index += 1) {
      samples.push(measureCapture(homeDir, `benchmark thought ${index}`));
    }

    const report = {
      benchmark: 'capture-latency',
      capturedAt: new Date().toISOString(),
      commitSha: readCommitSha(),
      fixture: {
        repoDir,
      },
      measurement: {
        metric: 'captureLatencyMs',
        runCount: options.runCount,
        samplesMs: samples,
        warmupCount: options.warmupCount,
        warmupSamplesMs: warmupSamples,
      },
      nodeVersion: process.version,
      platform: `${process.platform}-${process.arch}`,
      summary: summarizeSamples(samples),
    };

    if (options.profile) {
      report.profile = collectProfile(homeDir, options);
    }

    if (options.json) {
      process.stdout.write(JSON.stringify(report));
    } else {
      process.stdout.write(formatHumanReport(report));
    }
  } finally {
    await rm(homeDir, { recursive: true, force: true });
  }
}

function collectProfile(homeDir, options) {
  // Phase 1: Measure Node startup cost (spawn a no-op script)
  const startupSamples = [];
  for (let index = 0; index < options.runCount; index += 1) {
    const started = process.hrtime.bigint();
    spawnSync(process.execPath, [noopScript], { encoding: 'utf8' });
    const ended = process.hrtime.bigint();
    startupSamples.push(Number(ended - started) / 1_000_000);
  }

  // Phase 2: Run verbose captures and parse stderr events for phase timings
  const phaseSamples = {
    finalization: [],
    moduleLoad: [],
    rawSave: [],
    repoEnsure: [],
  };

  for (let index = 0; index < options.runCount; index += 1) {
    const phases = measureCapturePhases(homeDir, `profile thought ${index}`);
    phaseSamples.finalization.push(phases.finalization);
    phaseSamples.moduleLoad.push(phases.moduleLoad);
    phaseSamples.rawSave.push(phases.rawSave);
    phaseSamples.repoEnsure.push(phases.repoEnsure);
  }

  return {
    finalization: summarizeSamples(phaseSamples.finalization),
    moduleLoad: summarizeSamples(phaseSamples.moduleLoad),
    nodeStartup: summarizeSamples(startupSamples),
    rawSave: summarizeSamples(phaseSamples.rawSave),
    repoEnsure: summarizeSamples(phaseSamples.repoEnsure),
  };
}

function measureCapturePhases(homeDir, text) {
  const wallStart = process.hrtime.bigint();
  const result = spawnSync(process.execPath, [cliEntrypoint, '--json', '--verbose', text], {
    encoding: 'utf8',
    env: {
      ...process.env,
      HOME: homeDir,
      THINK_UPSTREAM_URL: '',
      NO_COLOR: '1',
    },
  });
  const wallEnd = process.hrtime.bigint();

  if (result.status !== 0) {
    throw new Error(`Profile capture failed: ${result.stderr}`);
  }

  const wallMs = Number(wallEnd - wallStart) / 1_000_000;

  const events = result.stderr
    .split('\n')
    .filter((line) => line.trim().startsWith('{'))
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  const tsOf = (eventName) => {
    const event = events.find((e) => e.event === eventName);
    return event ? new Date(event.ts).getTime() : null;
  };

  const cliStart = tsOf('cli.start');
  const repoEnsureStart = tsOf('repo.ensure.start');
  const repoEnsureDone = tsOf('repo.ensure.done') ?? tsOf('repo.bootstrap.done');
  const localSaveStart = tsOf('capture.local_save.start');
  const localSaveDone = tsOf('capture.local_save.done');
  const cliSuccess = tsOf('cli.success');

  // The gap between wall start and cli.start is module loading (Node startup + ESM import chain)
  // We approximate this as: wall total - (cli.success - cli.start)
  const cliDuration = cliSuccess !== null && cliStart !== null ? cliSuccess - cliStart : 0;
  const moduleLoad = wallMs - cliDuration;

  return {
    finalization: cliSuccess !== null && localSaveDone !== null ? cliSuccess - localSaveDone : 0,
    moduleLoad,
    rawSave: localSaveDone !== null && localSaveStart !== null ? localSaveDone - localSaveStart : 0,
    repoEnsure: repoEnsureDone !== null && repoEnsureStart !== null ? repoEnsureDone - repoEnsureStart : 0,
  };
}

function capture(homeDir, text) {
  const result = spawnSync(process.execPath, [cliEntrypoint, '--json', text], {
    encoding: 'utf8',
    env: {
      ...process.env,
      HOME: homeDir,
      THINK_UPSTREAM_URL: '',
      NO_COLOR: '1',
    },
  });

  if (result.status !== 0) {
    throw new Error(`Capture failed: ${result.stderr}`);
  }

  return result;
}

function measureCapture(homeDir, text) {
  const started = process.hrtime.bigint();
  capture(homeDir, text);
  const ended = process.hrtime.bigint();
  return Number(ended - started) / 1_000_000;
}

function summarizeSamples(samples) {
  const sorted = [...samples].sort((left, right) => left - right);
  const total = samples.reduce((sum, value) => sum + value, 0);
  return {
    maxMs: sorted.at(-1) ?? 0,
    meanMs: samples.length > 0 ? total / samples.length : 0,
    medianMs: percentile(sorted, 0.5),
    minMs: sorted[0] ?? 0,
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

function formatHumanReport(report) {
  const lines = [
    'Capture Latency Benchmark',
    `Commit: ${report.commitSha}`,
    `Captured at: ${report.capturedAt}`,
    `Runs: ${report.measurement.runCount} (${report.measurement.warmupCount} warmup)`,
    `Min: ${report.summary.minMs.toFixed(3)} ms`,
    `Median: ${report.summary.medianMs.toFixed(3)} ms`,
    `Mean: ${report.summary.meanMs.toFixed(3)} ms`,
    `P95: ${report.summary.p95Ms.toFixed(3)} ms`,
    `Max: ${report.summary.maxMs.toFixed(3)} ms`,
  ];

  if (report.profile) {
    lines.push('');
    lines.push('Phase Breakdown (median)');
    lines.push(`  Node startup:   ${report.profile.nodeStartup.medianMs.toFixed(3)} ms`);
    lines.push(`  Module load:    ${report.profile.moduleLoad.medianMs.toFixed(3)} ms`);
    lines.push(`  Repo ensure:    ${report.profile.repoEnsure.medianMs.toFixed(3)} ms`);
    lines.push(`  Raw save:       ${report.profile.rawSave.medianMs.toFixed(3)} ms`);
    lines.push(`  Finalization:   ${report.profile.finalization.medianMs.toFixed(3)} ms`);
  }

  lines.push('');
  return lines.join('\n');
}

function parseArgs(argv) {
  const options = {
    json: false,
    profile: false,
    runCount: DEFAULT_RUN_COUNT,
    warmupCount: DEFAULT_WARMUP_COUNT,
  };

  for (const arg of argv.slice(2)) {
    if (arg === '--json') {
      options.json = true;
    } else if (arg === '--profile') {
      options.profile = true;
    } else if (arg.startsWith('--runs=')) {
      options.runCount = parseIntegerArg(arg, '--runs=');
    } else if (arg.startsWith('--warmup=')) {
      options.warmupCount = parseIntegerArg(arg, '--warmup=');
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
  if (!Number.isInteger(options.runCount) || options.runCount <= 0) {
    throw new Error('Run count must be a positive integer.');
  }
  if (!Number.isInteger(options.warmupCount) || options.warmupCount < 0) {
    throw new Error('Warmup count must be a non-negative integer.');
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
