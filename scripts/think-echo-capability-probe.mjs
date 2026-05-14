#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultEchoRepo = path.resolve(repoRoot, '..', 'echo');
const contractPath = path.join(repoRoot, 'contracts', 'think-memory.graphql');
const generatorMarkers = Object.freeze([
  'pub const OP_CAPTURE_THOUGHT',
  'pub const OP_INSPECT_THOUGHT',
  'pub struct CaptureThoughtInput',
  'pub struct ThoughtEntry',
  'pub fn pack_capture_thought_intent',
  'pub fn inspect_thought_observation_request',
]);
const status = Object.freeze({
  contractUnavailable: 'contract_unavailable',
  generatorUnavailable: 'generator_unavailable',
  generatedTargetUnsupported: 'generated_target_unsupported',
  ready: 'ready_enough_for_phase_2',
  runtimeUnavailable: 'echo_runtime_unavailable',
});

class ThinkEchoProbeError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ThinkEchoProbeError';
    Object.freeze(this);
  }
}

function parseArgs(argv) {
  const parsed = { echoRepo: process.env.THINK_ECHO_REPO ?? defaultEchoRepo, json: false };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--json') {
      parsed.json = true;
      continue;
    }
    if (arg === '--echo-repo') {
      index = readEchoRepoArg(argv, index, parsed);
      continue;
    }
    throw new ThinkEchoProbeError(`Unknown argument: ${arg}`);
  }

  return Object.freeze({
    echoRepo: path.resolve(parsed.echoRepo),
    json: parsed.json,
  });
}

function readEchoRepoArg(argv, index, parsed) {
  const value = argv[index + 1];
  if (typeof value === 'string' && value.length > 0) {
    parsed.echoRepo = value;
    return index + 1;
  }
  throw new ThinkEchoProbeError('--echo-repo requires a path');
}

function createPaths(echoRepo) {
  return Object.freeze({
    contract: contractPath,
    echoRepo,
    generatorManifest: path.join(echoRepo, 'crates', 'echo-wesley-gen', 'Cargo.toml'),
    kernelPort: path.join(echoRepo, 'crates', 'echo-wasm-abi', 'src', 'kernel_port.rs'),
    runtimeManifest: path.join(echoRepo, 'crates', 'warp-wasm', 'Cargo.toml'),
    wasmAbiManifest: path.join(echoRepo, 'crates', 'echo-wasm-abi', 'Cargo.toml'),
  });
}

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
    timeout: options.timeoutMs ?? 30_000,
  });

  return Object.freeze({
    error: result.error?.message ?? null,
    signal: result.signal,
    status: result.status,
    stderr: trimOutput(result.stderr),
    stdout: trimOutput(result.stdout),
  });
}

function trimOutput(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim().slice(0, 4_000);
}

function checkCargo() {
  const result = runCommand('cargo', ['--version']);
  return Object.freeze({
    ok: result.status === 0,
    result,
    version: result.stdout,
  });
}

function checkGenerator(paths, cargo) {
  const echoRepoExists = existsSync(paths.echoRepo);
  const manifestExists = existsSync(paths.generatorManifest);
  return Object.freeze({
    echoRepoExists,
    manifestExists,
    ok: echoRepoExists && manifestExists && cargo.ok,
  });
}

function checkRuntime(paths) {
  const manifests = Object.freeze({
    kernelPort: existsSync(paths.kernelPort),
    runtime: existsSync(paths.runtimeManifest),
    wasmAbi: existsSync(paths.wasmAbiManifest),
  });
  return Object.freeze({
    manifests,
    ok: manifests.kernelPort && manifests.runtime && manifests.wasmAbi,
  });
}

function runGenerator(paths, generator) {
  if (generator.ok === true && existsSync(paths.contract)) {
    return runGeneratorUnchecked(paths);
  }
  return Object.freeze({
    markers: [],
    ok: false,
    result: null,
    skipped: true,
  });
}

function runGeneratorUnchecked(paths) {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'think-echo-probe-'));
  const generatedPath = path.join(tempDir, 'think_memory.generated.rs');
  const result = runCommand('cargo', generatorArgs(paths.contract, generatedPath), {
    cwd: paths.echoRepo,
    timeoutMs: 180_000,
  });
  const markers = readGeneratedMarkers(generatedPath);
  rmSync(tempDir, { force: true, recursive: true });

  return Object.freeze({
    markers,
    ok: result.status === 0 && markers.length === generatorMarkers.length,
    result,
    skipped: false,
  });
}

function generatorArgs(schemaPath, outputPath) {
  return Object.freeze([
    'run',
    '-q',
    '-p',
    'echo-wesley-gen',
    '--',
    '--schema',
    schemaPath,
    '--out',
    outputPath,
  ]);
}

function readGeneratedMarkers(generatedPath) {
  if (existsSync(generatedPath) !== true) {
    return [];
  }
  const source = readFileSync(generatedPath, 'utf8');
  return generatorMarkers.filter(marker => source.includes(marker));
}

function createReport(config) {
  const paths = createPaths(config.echoRepo);
  const contract = Object.freeze({ ok: existsSync(paths.contract), path: paths.contract });
  const cargo = checkCargo();
  const generator = checkGenerator(paths, cargo);
  const runtime = checkRuntime(paths);
  const generated = runGenerator(paths, generator);
  const reportStatus = statusFromChecks({ contract, generated, generator, runtime });

  return Object.freeze({
    ok: reportStatus === status.ready,
    paths,
    status: reportStatus,
    checks: Object.freeze({ cargo, contract, generated, generator, runtime }),
  });
}

function statusFromChecks(checks) {
  if (checks.contract.ok !== true) {
    return status.contractUnavailable;
  }
  if (checks.generator.ok !== true) {
    return status.generatorUnavailable;
  }
  if (checks.runtime.ok !== true) {
    return status.runtimeUnavailable;
  }
  if (checks.generated.ok === true) {
    return status.ready;
  }
  return status.generatedTargetUnsupported;
}

function printHuman(report) {
  process.stdout.write([
    `Think Echo capability: ${report.status}`,
    `Echo repo: ${report.paths.echoRepo}`,
    `Contract: ${report.paths.contract}`,
    `Cargo: ${report.checks.cargo.version || report.checks.cargo.result.error}`,
    `Generated markers: ${report.checks.generated.markers.length}/${generatorMarkers.length}`,
  ].join('\n'));
  process.stdout.write('\n');
}

function main() {
  const config = parseArgs(process.argv.slice(2));
  const report = createReport(config);
  if (config.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    printHuman(report);
  }
  if (report.ok !== true) {
    process.exitCode = 1;
  }
}

main();
