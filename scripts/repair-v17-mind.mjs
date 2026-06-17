#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

import { createThinkPlumbing } from '../src/git.js';

const GRAPH_DEFAULT = 'think';
const NULL_OID = '0000000000000000000000000000000000000000';
const CONTENT_ANCHOR_RE = /^(?<mode>100644|040000) (?<kind>blob|tree) (?<oid>[0-9a-f]{40,64})\t_content_(?<anchorOid>[0-9a-f]{40,64})$/u;
const requireFromScript = createRequire(import.meta.url);

export class RepairV17MindError extends Error {
  constructor(message, { code = 'repair_v17_mind.error', details = {} } = {}) {
    super(message);
    this.name = 'RepairV17MindError';
    this.code = code;
    this.details = details;
  }
}

export function usage() {
  return [
    'Usage:',
    '  node scripts/repair-v17-mind.mjs --mind <name> [--graph think] [--dry-run] [--json]',
    '  node scripts/repair-v17-mind.mjs --repo <path> [--graph think] [--dry-run] [--json]',
    '',
    'Options:',
    '  --mind <name>  Resolve a local mind under ~/.think/<name>. The special name "default" maps to ~/.think/repo.',
    '  --repo <path>  Explicit Think mind Git repository path.',
    '  --graph <name> Graph to repair. Defaults to think.',
    '  --dry-run      Inspect and report without changing refs or checkpoints.',
    '  --json         Emit machine-readable JSON.',
    '  --help, -h     Show this help.',
  ].join('\n');
}

export function parseRepairArgs(argv) {
  const args = {
    dryRun: false,
    graph: GRAPH_DEFAULT,
    help: false,
    json: false,
    mind: null,
    repo: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--mind') {
      args.mind = requireValue(argv, index, '--mind');
      index += 1;
      continue;
    }
    if (arg === '--repo') {
      args.repo = requireValue(argv, index, '--repo');
      index += 1;
      continue;
    }
    if (arg === '--graph') {
      args.graph = requireValue(argv, index, '--graph');
      index += 1;
      continue;
    }
    if (arg === '--dry-run') {
      args.dryRun = true;
      continue;
    }
    if (arg === '--json') {
      args.json = true;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      args.help = true;
      continue;
    }
    throw new RepairV17MindError(`Unknown argument: ${arg ?? ''}`, {
      code: 'repair_v17_mind.usage',
    });
  }

  return Object.freeze(args);
}

function requireValue(argv, index, flag) {
  const value = argv[index + 1];
  if (value === undefined || value.startsWith('--')) {
    throw new RepairV17MindError(`${flag} requires a value`, {
      code: 'repair_v17_mind.usage',
    });
  }
  return value;
}

export function resolveRepairTarget(args, {
  cwd = process.cwd(),
  homeDir = process.env.HOME || os.homedir(),
} = {}) {
  if (args.mind !== null && args.repo !== null) {
    throw new RepairV17MindError('Use either --mind or --repo, not both', {
      code: 'repair_v17_mind.usage',
    });
  }

  if (args.mind === null && args.repo === null) {
    throw new RepairV17MindError('Repair target required: pass --mind <name> or --repo <path>', {
      code: 'repair_v17_mind.usage',
    });
  }

  const graph = normalizeGraphName(args.graph);
  if (args.repo !== null) {
    return Object.freeze({
      graph,
      mind: null,
      repoDir: path.resolve(cwd, args.repo),
    });
  }

  const mind = normalizeMindName(args.mind);
  const mindDirName = mind === 'default' ? 'repo' : mind;
  return Object.freeze({
    graph,
    mind,
    repoDir: path.join(homeDir, '.think', mindDirName),
  });
}

function normalizeGraphName(graph) {
  const value = String(graph ?? '').trim();
  if (value.length === 0) {
    throw new RepairV17MindError('--graph must not be empty', {
      code: 'repair_v17_mind.usage',
    });
  }
  if (value.includes('/') || value.includes('\\')) {
    throw new RepairV17MindError('--graph must be a graph name, not a path', {
      code: 'repair_v17_mind.usage',
    });
  }
  return value;
}

function normalizeMindName(mind) {
  const value = String(mind ?? '').trim();
  if (value.length === 0) {
    throw new RepairV17MindError('--mind must not be empty', {
      code: 'repair_v17_mind.usage',
    });
  }
  if (value.includes('/') || value.includes('\\') || value === '.' || value === '..') {
    throw new RepairV17MindError('--mind must be one local mind name, not a path', {
      code: 'repair_v17_mind.usage',
    });
  }
  return value;
}

export async function repairV17Mind(options, deps = {}) {
  const target = resolveRepairTarget(options, deps);
  const runner = deps.runner ?? runCommand;
  const now = deps.now ?? new Date();
  const runUpgrade = deps.runUpgrade ?? runGitWarpUpgrade;
  const materialize = deps.materialize ?? materializeGraph;
  const runCheck = deps.runCheck ?? checkGraph;
  const runDoctor = deps.runDoctor ?? doctorGraph;

  assertGitRepo(target.repoDir, runner);

  const checkpointRef = buildCheckpointRef(target.graph);
  const beforeCheckpoint = readCheckpointSha(target.repoDir, checkpointRef, runner);
  const upgradeBefore = await runUpgrade({
    graph: target.graph,
    repoDir: target.repoDir,
    dryRun: true,
    runner,
  });

  if (options.dryRun) {
    return Object.freeze({
      ok: true,
      dryRun: true,
      repo: target.repoDir,
      graph: target.graph,
      checkpointRef,
      beforeCheckpoint,
      backupRef: null,
      changed: false,
      upgrade: {
        before: normalizeUpgradeStatus(upgradeBefore),
        after: null,
        rawBefore: upgradeBefore,
        rawAfter: null,
      },
      wouldRepair: upgradeBefore.status === 'would-upgrade',
    });
  }

  if (upgradeBefore.status !== 'would-upgrade') {
    return Object.freeze({
      ok: true,
      dryRun: false,
      repo: target.repoDir,
      graph: target.graph,
      checkpointRef,
      beforeCheckpoint,
      backupRef: null,
      changed: false,
      upgrade: {
        before: normalizeUpgradeStatus(upgradeBefore),
        after: normalizeUpgradeStatus(upgradeBefore),
        rawBefore: upgradeBefore,
        rawAfter: upgradeBefore,
      },
      materialize: null,
      check: null,
      doctor: null,
    });
  }

  if (beforeCheckpoint === null) {
    throw new RepairV17MindError('Upgrade dry-run reported work, but no checkpoint ref exists to back up', {
      code: 'repair_v17_mind.inconsistent_checkpoint',
      details: { checkpointRef, repo: target.repoDir },
    });
  }

  const backupRef = createBackupRef({
    checkpointSha: beforeCheckpoint,
    graph: target.graph,
    now,
    repoDir: target.repoDir,
    runner,
  });

  const upgradeActual = await runUpgrade({
    graph: target.graph,
    repoDir: target.repoDir,
    dryRun: false,
    runner,
  });
  const materializeResult = await materialize({
    graph: target.graph,
    repoDir: target.repoDir,
    runner,
  });
  const upgradeAfter = await runUpgrade({
    graph: target.graph,
    repoDir: target.repoDir,
    dryRun: true,
    runner,
  });
  const checkResult = await runCheck({
    graph: target.graph,
    repoDir: target.repoDir,
    runner,
  });
  const doctorResult = await runDoctor({
    graph: target.graph,
    repoDir: target.repoDir,
    runner,
  });

  validatePostRepair({
    checkResult,
    doctorResult,
    upgradeAfter,
  });

  return Object.freeze({
    ok: true,
    dryRun: false,
    repo: target.repoDir,
    graph: target.graph,
    checkpointRef,
    backupRef,
    beforeCheckpoint,
    afterCheckpoint: resolveAfterCheckpoint({
      checkResult,
      materializeResult,
      upgradeActual,
    }),
    changed: true,
    upgrade: {
      before: normalizeUpgradeStatus(upgradeBefore),
      after: normalizeUpgradeStatus(upgradeAfter),
      rawBefore: upgradeBefore,
      rawActual: upgradeActual,
      rawAfter: upgradeAfter,
    },
    materialize: materializeResult,
    check: {
      patchesSinceCheckpoint: checkResult.status?.patchesSinceCheckpoint ?? null,
      raw: checkResult,
    },
    doctor: {
      failures: doctorResult.summary?.fail ?? null,
      warnings: collectDoctorWarnings(doctorResult),
      raw: doctorResult,
    },
  });
}

function assertGitRepo(repoDir, runner) {
  const result = runGit(repoDir, ['rev-parse', '--git-dir'], runner, { allowExitCodes: [0, 128] });
  if (result.status === 0) {
    return;
  }

  throw new RepairV17MindError(`Repair target is not a Git repository: ${repoDir}`, {
    code: 'repair_v17_mind.repo_not_found',
    details: { repo: repoDir },
  });
}

export function buildCheckpointRef(graph) {
  return `refs/warp/${graph}/checkpoints/head`;
}

function readCheckpointSha(repoDir, checkpointRef, runner) {
  const result = runGit(repoDir, ['rev-parse', '--verify', '--quiet', checkpointRef], runner, {
    allowExitCodes: [0, 1],
  });
  if (result.status === 0) {
    return result.stdout.trim();
  }
  return null;
}

export function createBackupRef({ checkpointSha, graph, now, repoDir, runner = runCommand }) {
  for (let index = 0; index < 100; index += 1) {
    const backupRef = buildBackupRef(graph, now, index);
    if (refExists(repoDir, backupRef, runner)) {
      continue;
    }

    runGit(repoDir, ['update-ref', '--create-reflog', backupRef, checkpointSha, NULL_OID], runner);
    return backupRef;
  }

  throw new RepairV17MindError('Could not allocate a unique pre-v17 checkpoint backup ref', {
    code: 'repair_v17_mind.backup_ref_exhausted',
    details: { graph, repo: repoDir },
  });
}

function buildBackupRef(graph, now, index) {
  const suffix = index === 0 ? '' : `-${String(index + 1).padStart(2, '0')}`;
  return `refs/warp/${graph}/checkpoints/pre-v17-upgrade-${formatBackupTimestamp(now)}${suffix}`;
}

function refExists(repoDir, ref, runner) {
  const result = runGit(repoDir, ['show-ref', '--verify', '--quiet', ref], runner, {
    allowExitCodes: [0, 1],
  });
  return result.status === 0;
}

export function formatBackupTimestamp(date) {
  const parts = [
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds(),
  ];
  const [year, month, day, hour, minute, second] = parts.map(part => String(part).padStart(2, '0'));
  return `${year}${month}${day}-${hour}${minute}${second}`;
}

export async function runGitWarpUpgrade({ repoDir, graph, dryRun, runner = runCommand }) {
  const packageRoot = resolveGitWarpPackageRoot();
  const upgradeModule = await importGitWarpUpgradeModule(packageRoot);
  const persistence = await createV17Persistence({ repoDir, runner });
  const cryptoAdapter = await createV17Crypto(packageRoot);

  return await upgradeModule.upgradeCheckpointSchema({
    persistence,
    graphName: graph,
    dryRun,
    crypto: cryptoAdapter,
  });
}

async function importGitWarpUpgradeModule(packageRoot) {
  const upgradePath = path.join(
    packageRoot,
    'dist',
    'scripts',
    'migrations',
    'v17.0.0',
    'checkpoint-schema-upgrade.js'
  );
  if (!existsSync(upgradePath)) {
    throw new RepairV17MindError('Installed @git-stunts/git-warp does not expose the v17 checkpoint migration script', {
      code: 'repair_v17_mind.v17_upgrade_unavailable',
      details: { upgradePath },
    });
  }

  return await import(pathToFileURL(upgradePath).href);
}

async function createV17Crypto(packageRoot) {
  const cryptoPath = path.join(
    packageRoot,
    'dist',
    'src',
    'infrastructure',
    'adapters',
    'NodeCryptoAdapter.js'
  );
  if (!existsSync(cryptoPath)) {
    return undefined;
  }

  const cryptoModule = await import(pathToFileURL(cryptoPath).href);
  const NodeCryptoAdapter = cryptoModule.default ?? cryptoModule.NodeCryptoAdapter;
  if (typeof NodeCryptoAdapter !== 'function') {
    return undefined;
  }
  return new NodeCryptoAdapter();
}

async function createV17Persistence({ repoDir, runner }) {
  const gitWarp = await import('@git-stunts/git-warp');
  const { GitGraphAdapter } = gitWarp;
  const persistence = new GitGraphAdapter({
    plumbing: createThinkPlumbing(repoDir),
  });

  return createContentAnchorAwarePersistence(
    persistence,
    createGitObjectTypeReader({ repoDir, runner })
  );
}

export async function materializeGraph({ repoDir, graph, runner = runCommand }) {
  const gitWarp = await import('@git-stunts/git-warp');
  const { default: DefaultWarpApp, GitGraphAdapter, WarpApp: NamedWarpApp } = gitWarp;
  const WarpApp = DefaultWarpApp ?? NamedWarpApp;
  const persistence = createContentAnchorAwarePersistence(
    new GitGraphAdapter({
      plumbing: createThinkPlumbing(repoDir),
    }),
    createGitObjectTypeReader({ repoDir, runner })
  );
  const app = await WarpApp.open({
    persistence,
    graphName: graph,
    writerId: 'think-repair-v17',
    checkpointPolicy: { every: 100 },
  });
  const state = await app.core().materialize();
  const checkpoint = await app.core().createCheckpoint();

  return Object.freeze({
    graph,
    checkpoint,
    edges: sizeOf(state?.edgeAlive),
    nodes: sizeOf(state?.nodeAlive),
    properties: sizeOf(state?.prop),
  });
}

function sizeOf(value) {
  if (typeof value?.size === 'number') {
    return value.size;
  }
  if (typeof value?.count === 'number') {
    return value.count;
  }
  return null;
}

export function checkGraph({ repoDir, graph, runner = runCommand }) {
  return runGitWarpJsonCommand({
    command: 'check',
    graph,
    repoDir,
    runner,
  });
}

export function doctorGraph({ repoDir, graph, runner = runCommand }) {
  return runGitWarpJsonCommand({
    command: 'doctor',
    graph,
    repoDir,
    runner,
    allowExitCodes: [0, 3],
  });
}

function runGitWarpJsonCommand({
  allowExitCodes = [0],
  command,
  graph,
  repoDir,
  runner,
}) {
  const gitWarp = resolveGitWarpBinCommand();
  const result = runner(gitWarp.command, [
    ...gitWarp.args,
    '--repo',
    repoDir,
    '--graph',
    graph,
    '--json',
    command,
  ], {
    allowExitCodes,
  });
  return parseJsonCommandOutput(result.stdout, command);
}

export function createContentAnchorAwarePersistence(persistence, readObjectType) {
  return new Proxy(persistence, {
    get(target, property, receiver) {
      if (property === 'writeTree') {
        return async (entries) => {
          const normalized = await normalizeContentAnchorTreeEntries(entries, readObjectType);
          return await target.writeTree(normalized);
        };
      }

      const value = Reflect.get(target, property, receiver);
      if (typeof value === 'function') {
        return value.bind(target);
      }
      return value;
    },
  });
}

export async function normalizeContentAnchorTreeEntries(entries, readObjectType) {
  return await Promise.all(entries.map(async (entry) => {
    const parsed = parseContentAnchorEntry(entry);
    if (parsed === null) {
      return entry;
    }

    const objectType = await readObjectType(parsed.oid);
    if (objectType === 'blob') {
      return `100644 blob ${parsed.oid}\t_content_${parsed.oid}`;
    }
    if (objectType === 'tree') {
      return `040000 tree ${parsed.oid}\t_content_${parsed.oid}`;
    }

    throw new RepairV17MindError(`Unsupported content anchor object type: ${objectType}`, {
      code: 'repair_v17_mind.unsupported_content_anchor_type',
      details: { objectType, oid: parsed.oid },
    });
  }));
}

function parseContentAnchorEntry(entry) {
  const match = CONTENT_ANCHOR_RE.exec(entry);
  if (match === null) {
    return null;
  }

  const groups = match.groups ?? {};
  if (groups.oid !== groups.anchorOid) {
    return null;
  }

  return Object.freeze({
    kind: groups.kind,
    mode: groups.mode,
    oid: groups.oid,
  });
}

function createGitObjectTypeReader({ repoDir, runner }) {
  return (oid) => {
    const result = runGit(repoDir, ['cat-file', '-t', oid], runner);
    return result.stdout.trim();
  };
}

export function resolveGitWarpPackageRoot(packageName = '@git-stunts/git-warp') {
  const packageEntry = requireFromScript.resolve(packageName);
  let dir = path.dirname(packageEntry);
  while (dir !== path.dirname(dir)) {
    const packageJsonPath = path.join(dir, 'package.json');
    if (existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
      if (packageJson.name === packageName) {
        return dir;
      }
    }
    dir = path.dirname(dir);
  }

  throw new RepairV17MindError(`Could not resolve ${packageName} package root`, {
    code: 'repair_v17_mind.package_root_unavailable',
    details: { packageName },
  });
}

function resolveGitWarpBinCommand() {
  const packageRoot = resolveGitWarpPackageRoot();
  const packageJson = JSON.parse(readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));
  const bin = typeof packageJson.bin === 'string'
    ? packageJson.bin
    : packageJson.bin?.['git-warp'];
  const relativeBin = bin ?? 'bin/git-warp';
  const binPath = path.join(packageRoot, relativeBin);
  if (!existsSync(binPath)) {
    throw new RepairV17MindError('Installed @git-stunts/git-warp does not expose a git-warp binary', {
      code: 'repair_v17_mind.git_warp_bin_unavailable',
      details: { binPath },
    });
  }

  return Object.freeze({
    command: process.execPath,
    args: [binPath],
  });
}

function runGit(repoDir, args, runner, { allowExitCodes = [0] } = {}) {
  return runner('git', ['-C', repoDir, ...args], {
    allowExitCodes,
  });
}

export function runCommand(command, args, {
  allowExitCodes = [0],
  cwd = process.cwd(),
  env = {},
} = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      NO_COLOR: '1',
      ...env,
    },
  });
  if (result.error) {
    throw new RepairV17MindError(result.error.message, {
      code: 'repair_v17_mind.command_error',
      details: { args, command },
    });
  }

  const status = result.status ?? 1;
  if (!allowExitCodes.includes(status)) {
    throw new RepairV17MindError(`Command failed: ${command} ${args.join(' ')}`, {
      code: 'repair_v17_mind.command_failed',
      details: {
        args,
        command,
        status,
        stderr: result.stderr ?? '',
        stdout: result.stdout ?? '',
      },
    });
  }

  return Object.freeze({
    args,
    command,
    status,
    stderr: result.stderr ?? '',
    stdout: result.stdout ?? '',
  });
}

function parseJsonCommandOutput(stdout, label) {
  try {
    return JSON.parse(stdout);
  } catch (error) {
    throw new RepairV17MindError(`Could not parse JSON output from ${label}`, {
      code: 'repair_v17_mind.invalid_json',
      details: {
        cause: error instanceof Error ? error.message : String(error),
        stdout,
      },
    });
  }
}

function normalizeUpgradeStatus(result) {
  if (result.status === 'would-upgrade') {
    return 'needed';
  }
  return result.status;
}

function validatePostRepair({ checkResult, doctorResult, upgradeAfter }) {
  if (upgradeAfter.status !== 'already-current') {
    throw new RepairV17MindError('Post-repair upgrade dry-run did not report already-current', {
      code: 'repair_v17_mind.upgrade_not_current',
      details: { upgradeAfter },
    });
  }

  const patchesSinceCheckpoint = checkResult.status?.patchesSinceCheckpoint;
  if (patchesSinceCheckpoint !== 0) {
    throw new RepairV17MindError('Post-repair git-warp check reported patches since checkpoint', {
      code: 'repair_v17_mind.check_not_fresh',
      details: { patchesSinceCheckpoint },
    });
  }

  const failures = doctorResult.summary?.fail;
  if (failures !== 0) {
    throw new RepairV17MindError('Post-repair git-warp doctor reported failures', {
      code: 'repair_v17_mind.doctor_failures',
      details: { failures, doctorResult },
    });
  }
}

function resolveAfterCheckpoint({ checkResult, materializeResult, upgradeActual }) {
  return checkResult.checkpoint?.sha
    ?? materializeResult.checkpoint
    ?? upgradeActual.upgradedCheckpointSha
    ?? null;
}

function collectDoctorWarnings(doctorResult) {
  const findings = Array.isArray(doctorResult.findings) ? doctorResult.findings : [];
  return findings.filter(finding => finding?.status === 'warn');
}

function formatHumanResult(result) {
  if (result.dryRun) {
    return [
      `Repo: ${result.repo}`,
      `Graph: ${result.graph}`,
      `Checkpoint: ${result.beforeCheckpoint ?? '(missing)'}`,
      `Upgrade: ${result.upgrade.before}`,
      `Would repair: ${String(result.wouldRepair)}`,
    ].join('\n');
  }

  if (!result.changed) {
    return [
      `Repo: ${result.repo}`,
      `Graph: ${result.graph}`,
      `No repair needed: ${result.upgrade.before}`,
    ].join('\n');
  }

  return [
    `Repaired ${result.repo} graph ${result.graph}.`,
    `Backup: ${result.backupRef}`,
    `Before: ${result.beforeCheckpoint}`,
    `After:  ${result.afterCheckpoint ?? '(unknown)'}`,
    `Patches since checkpoint: ${String(result.check.patchesSinceCheckpoint)}`,
    `Doctor failures: ${String(result.doctor.failures)}`,
    `Doctor warnings: ${String(result.doctor.warnings.length)}`,
  ].join('\n');
}

async function main() {
  const args = parseRepairArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }

  const result = await repairV17Mind(args);
  if (args.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  process.stdout.write(`${formatHumanResult(result)}\n`);
}

function isMainModule() {
  const invokedPath = process.argv[1];
  if (invokedPath === undefined) {
    return false;
  }

  return path.resolve(invokedPath) === fileURLToPath(import.meta.url);
}

if (isMainModule()) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    const code = error instanceof RepairV17MindError ? error.code : 'repair_v17_mind.internal';
    const details = error instanceof RepairV17MindError ? error.details : {};
    if (process.argv.includes('--json')) {
      process.stdout.write(`${JSON.stringify({
        ok: false,
        error: {
          code,
          message,
          details,
        },
      }, null, 2)}\n`);
    } else {
      process.stderr.write(`${message}\n\n${usage()}\n`);
    }
    process.exitCode = 1;
  });
}
