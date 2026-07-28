#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { decode } from 'cbor-x';

import { createThinkPlumbing, GIT_BINARY, THINK_GIT_CONFIG_ARGS } from '../src/git.js';
import { GRAPH_NAME } from '../src/store/constants.js';

const PATCH_HANDLE_TRAILER = 'eg-patch-handle';
const CONTENT_PROPERTY_KEY = '_content';
const requireFromScript = createRequire(import.meta.url);

export class ReplayV19CaptureError extends Error {
  constructor(message, code = 'replay_v19_capture.error') {
    super(message);
    this.name = 'ReplayV19CaptureError';
    this.code = code;
  }
}

export function usage() {
  return [
    'Usage:',
    '  node scripts/replay-v19-capture-on-v18.mjs \\',
    '    --repo <disposable-copy> --commit <v19-commit> \\',
    '    --v18-package-root <path> [--json]',
    '',
    'Replays one mixed-format v19 capture as a native v18 patch. The command',
    'requires the named v19 commit to be the current writer head, retains it',
    'under its existing recovery ref, and uses compare-and-swap ref updates.',
  ].join('\n');
}

export function parseReplayArgs(argv) {
  const args = {
    commit: null,
    help: false,
    json: false,
    repo: null,
    v18PackageRoot: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--json') {
      args.json = true;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      args.help = true;
      continue;
    }
    const value = requireValue(argv, index, arg);
    if (applyValueFlag(args, arg, value)) {
      index += 1;
      continue;
    }
    throw new ReplayV19CaptureError(`Unknown argument: ${arg}`, 'replay_v19_capture.usage');
  }

  return Object.freeze(args);
}

function requireValue(argv, index, flag) {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new ReplayV19CaptureError(`${flag} requires a value`, 'replay_v19_capture.usage');
  }
  return value;
}

function applyValueFlag(args, flag, value) {
  if (flag === '--repo') {
    args.repo = value;
    return true;
  }
  if (flag === '--commit') {
    args.commit = value;
    return true;
  }
  if (flag === '--v18-package-root') {
    args.v18PackageRoot = value;
    return true;
  }
  return false;
}

export async function replayV19Capture(options) {
  const repoDir = requireRepository(options.repo);
  const sourceCommit = resolveCommit(repoDir, options.commit);
  const v18PackageRoot = requireV18Package(options.v18PackageRoot);
  const source = await readSourcePatch(repoDir, sourceCommit);
  requireReplayShape(source.patch);
  const contentByNode = await readSourceContent(repoDir, source.patch);
  const writerRef = `refs/warp/${GRAPH_NAME}/writers/${source.patch.writer}`;
  requireCurrentWriterHead(repoDir, writerRef, sourceCommit);
  requireRecoveryRef(repoDir, sourceCommit);

  const parentCommit = requireSingleParent(repoDir, sourceCommit);
  compareAndSwapRef(repoDir, writerRef, parentCommit, sourceCommit);
  try {
    const replay = await writeV18Replay({
      contentByNode,
      patch: source.patch,
      repoDir,
      v18PackageRoot,
    });
    return await verifyReplay({
      contentByNode,
      parentCommit,
      replay,
      repoDir,
      sourceCommit,
      writerRef,
    });
  } catch (error) {
    restoreSourceHeadWhenUnchanged(repoDir, writerRef, parentCommit, sourceCommit);
    throw error;
  }
}

function requireRepository(value) {
  if (!value) {
    throw new ReplayV19CaptureError('--repo is required', 'replay_v19_capture.usage');
  }
  const repoDir = path.resolve(value);
  if (!existsSync(path.join(repoDir, '.git'))) {
    throw new ReplayV19CaptureError(
      `Think repository not found: ${repoDir}`,
      'replay_v19_capture.repo_not_found'
    );
  }
  return repoDir;
}

function resolveCommit(repoDir, value) {
  if (!value) {
    throw new ReplayV19CaptureError('--commit is required', 'replay_v19_capture.usage');
  }
  return gitText(repoDir, ['rev-parse', '--verify', `${value}^{commit}`]).trim();
}

function requireV18Package(value) {
  if (!value) {
    throw new ReplayV19CaptureError(
      '--v18-package-root is required',
      'replay_v19_capture.usage'
    );
  }
  const packageRoot = path.resolve(value);
  const manifestPath = path.join(packageRoot, 'package.json');
  if (!existsSync(manifestPath)) {
    throw new ReplayV19CaptureError(
      `git-warp package not found: ${packageRoot}`,
      'replay_v19_capture.package_not_found'
    );
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (manifest.name !== '@git-stunts/git-warp' || !String(manifest.version).startsWith('18.')) {
    throw new ReplayV19CaptureError(
      `Expected @git-stunts/git-warp v18, found ${manifest.name}@${manifest.version}`,
      'replay_v19_capture.package_version'
    );
  }
  return packageRoot;
}

async function readSourcePatch(repoDir, commit) {
  const message = gitText(repoDir, ['show', '-s', '--format=%B', commit]);
  const handle = readTrailer(message, PATCH_HANDLE_TRAILER);
  if (!handle) {
    throw new ReplayV19CaptureError(
      `Missing ${PATCH_HANDLE_TRAILER} trailer: ${commit}`,
      'replay_v19_capture.patch_handle'
    );
  }
  const bytes = await readOfficialV19Asset(repoDir, handle);
  return Object.freeze({ handle, patch: decode(bytes) });
}

function readTrailer(message, key) {
  const prefix = `${key}:`;
  return message
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith(prefix))
    .map(line => line.slice(prefix.length).trim())
    .at(-1) ?? null;
}

async function readOfficialV19Asset(repoDir, handle) {
  const warpPackageRoot = path.dirname(
    requireFromScript.resolve('@git-stunts/git-warp/package.json')
  );
  const requireFromWarp = createRequire(path.join(warpPackageRoot, 'package.json'));
  const casEntry = requireFromWarp.resolve('@git-stunts/git-cas');
  const plumbingEntry = requireFromWarp.resolve('@git-stunts/plumbing');
  const [{ default: ContentAddressableStore, CborCodec }, { default: Plumbing }] = (
    await Promise.all([
      import(pathToFileURL(casEntry).href),
      import(pathToFileURL(plumbingEntry).href),
    ])
  );
  const plumbing = await Plumbing.createDefault({ cwd: repoDir });
  const cas = new ContentAddressableStore({
    plumbing,
    codec: new CborCodec(),
  });
  const chunks = [];
  for await (const chunk of cas.assets.open({ handle })) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function requireReplayShape(patch) {
  if (
    !patch
    || patch.schema !== 2
    || typeof patch.writer !== 'string'
    || !Array.isArray(patch.ops)
  ) {
    throw new ReplayV19CaptureError(
      'The retained patch is not a schema-2 WARP patch',
      'replay_v19_capture.patch_schema'
    );
  }
  const unsupported = patch.ops.filter(op => !['NodeAdd', 'PropSet'].includes(op.type));
  if (unsupported.length > 0) {
    throw new ReplayV19CaptureError(
      `Unsupported retained operations: ${unsupported.map(op => op.type).join(', ')}`,
      'replay_v19_capture.patch_shape'
    );
  }
}

async function readSourceContent(repoDir, patch) {
  const contentByNode = new Map();
  for (const op of patch.ops) {
    if (op.type !== 'PropSet' || op.key !== CONTENT_PROPERTY_KEY) {
      continue;
    }
    // eslint-disable-next-line no-await-in-loop -- each retained content asset is independently verified
    const bytes = await readOfficialV19Asset(repoDir, op.value);
    contentByNode.set(op.node, bytes);
  }
  return contentByNode;
}

function requireCurrentWriterHead(repoDir, writerRef, expected) {
  const actual = readRef(repoDir, writerRef);
  if (actual !== expected) {
    throw new ReplayV19CaptureError(
      `Writer head mismatch: ${writerRef} is ${actual ?? 'missing'}, expected ${expected}`,
      'replay_v19_capture.writer_moved'
    );
  }
}

function requireRecoveryRef(repoDir, sourceCommit) {
  const refs = gitText(repoDir, [
    'for-each-ref',
    '--format=%(objectname)',
    `refs/warp/${GRAPH_NAME}/recovery/`,
  ]).trim().split('\n').filter(Boolean);
  if (!refs.includes(sourceCommit)) {
    throw new ReplayV19CaptureError(
      `No recovery ref retains source commit ${sourceCommit}`,
      'replay_v19_capture.recovery_ref'
    );
  }
}

function requireSingleParent(repoDir, commit) {
  const parents = gitText(repoDir, ['show', '-s', '--format=%P', commit])
    .trim()
    .split(' ')
    .filter(Boolean);
  if (parents.length !== 1) {
    throw new ReplayV19CaptureError(
      `Expected one parent for ${commit}, found ${parents.length}`,
      'replay_v19_capture.parent'
    );
  }
  return parents[0];
}

async function writeV18Replay({ contentByNode, patch, repoDir, v18PackageRoot }) {
  const runtime = await import(pathToFileURL(path.join(v18PackageRoot, 'dist', 'index.js')).href);
  const persistence = new runtime.GitGraphAdapter({
    plumbing: createThinkPlumbing(repoDir),
  });
  const worldline = await runtime.openWarpWorldline({
    persistence,
    worldlineName: GRAPH_NAME,
    writerId: patch.writer,
  });
  const view = worldline.live();
  const missingNodeIds = await findMissingNodes(view, patch.ops);

  const replayCommit = await worldline.commit(async builder => {
    for (const nodeId of missingNodeIds) {
      builder.addNode(nodeId);
    }
    for (const op of patch.ops.filter(isReplayProperty)) {
      builder.setProperty(op.node, op.key, op.value);
    }
    for (const [nodeId, bytes] of contentByNode) {
      const metadata = contentMetadataForNode(patch.ops, nodeId);
      // eslint-disable-next-line no-await-in-loop -- the mutable v18 builder preserves attachment order
      await builder.attachContent(nodeId, bytes, metadata);
    }
  });
  return Object.freeze({
    blobStorage: await persistence.createRuntimeBlobStorage(),
    replayCommit,
    view: worldline.live(),
  });
}

async function findMissingNodes(view, ops) {
  const addedNodeIds = ops.filter(op => op.type === 'NodeAdd').map(op => op.node);
  const missingNodeIds = [];
  for (const nodeId of addedNodeIds) {
    // eslint-disable-next-line no-await-in-loop -- exact existence checks preserve replay semantics
    if (!await view.hasNode(nodeId)) {
      missingNodeIds.push(nodeId);
    }
  }
  return missingNodeIds;
}

function isReplayProperty(op) {
  return op.type === 'PropSet' && !op.key.startsWith(CONTENT_PROPERTY_KEY);
}

function contentMetadataForNode(ops, nodeId) {
  const mime = ops.find(op => (
    op.type === 'PropSet'
    && op.node === nodeId
    && op.key === `${CONTENT_PROPERTY_KEY}.mime`
  ))?.value;
  return typeof mime === 'string' ? { mime } : {};
}

async function verifyReplay({
  contentByNode,
  parentCommit,
  replay,
  repoDir,
  sourceCommit,
  writerRef,
}) {
  verifyReplayHead(repoDir, writerRef, replay.replayCommit, parentCommit);
  const content = await verifyReplayContent(replay, contentByNode);

  return Object.freeze({
    ok: true,
    repo: repoDir,
    writerRef,
    sourceCommit,
    parentCommit,
    replayCommit: replay.replayCommit,
    content: Object.freeze(content),
  });
}

function verifyReplayHead(repoDir, writerRef, replayCommit, parentCommit) {
  const current = readRef(repoDir, writerRef);
  if (current !== replayCommit) {
    throw new ReplayV19CaptureError(
      `Replay writer head mismatch: ${current ?? 'missing'}`,
      'replay_v19_capture.verify_head'
    );
  }
  const replayParent = requireSingleParent(repoDir, replayCommit);
  if (replayParent !== parentCommit) {
    throw new ReplayV19CaptureError(
      `Replay parent mismatch: ${replayParent}`,
      'replay_v19_capture.verify_parent'
    );
  }
}

async function verifyReplayContent(replay, contentByNode) {
  const content = [];
  for (const [nodeId, expectedBytes] of contentByNode) {
    // eslint-disable-next-line no-await-in-loop -- retained content hashes are verified independently
    const props = await replay.view.getNodeProps(nodeId);
    // eslint-disable-next-line no-await-in-loop -- retained content hashes are verified independently
    const actualBytes = await replay.blobStorage.retrieve(props?.[CONTENT_PROPERTY_KEY]);
    const expectedSha256 = sha256(expectedBytes);
    const actualSha256 = sha256(actualBytes);
    if (actualSha256 !== expectedSha256) {
      throw new ReplayV19CaptureError(
        `Replayed content mismatch: ${nodeId}`,
        'replay_v19_capture.verify_content'
      );
    }
    content.push(Object.freeze({ nodeId, sha256: actualSha256 }));
  }
  return content;
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function restoreSourceHeadWhenUnchanged(repoDir, writerRef, parentCommit, sourceCommit) {
  if (readRef(repoDir, writerRef) === parentCommit) {
    compareAndSwapRef(repoDir, writerRef, sourceCommit, parentCommit);
  }
}

function readRef(repoDir, refName) {
  try {
    return gitText(repoDir, ['rev-parse', '--verify', refName]).trim();
  } catch {
    return null;
  }
}

function compareAndSwapRef(repoDir, refName, newOid, expectedOid) {
  gitText(repoDir, ['update-ref', refName, newOid, expectedOid]);
}

function gitText(repoDir, args) {
  return execFileSync(
    GIT_BINARY,
    [...THINK_GIT_CONFIG_ARGS, '-C', repoDir, ...args],
    { encoding: 'utf8', env: process.env }
  );
}

function printReport(report, json) {
  if (json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }
  process.stdout.write([
    'Mixed-format v19 capture replayed as a native v18 patch.',
    `Source: ${report.sourceCommit}`,
    `Parent: ${report.parentCommit}`,
    `Replay: ${report.replayCommit}`,
    `Content assets: ${report.content.length}`,
  ].join('\n'));
  process.stdout.write('\n');
}

async function main() {
  const args = parseReplayArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  printReport(await replayV19Capture(args), args.json);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch(error => {
    const output = {
      ok: false,
      code: error.code ?? 'replay_v19_capture.unexpected',
      message: error instanceof Error ? error.message : String(error),
    };
    if (process.argv.includes('--json')) {
      process.stderr.write(`${JSON.stringify(output, null, 2)}\n`);
    } else {
      process.stderr.write(`replay-v19-capture-on-v18: ${output.message}\n`);
    }
    process.exitCode = 1;
  });
}
