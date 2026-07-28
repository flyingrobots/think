#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { createThinkPlumbing } from '../src/git.js';
import { GRAPH_NAME, TEXT_CONTENT_KINDS } from '../src/store/constants.js';
import {
  addThinkCatalogEntry,
  createEmptyThinkRecord,
  listThinkCatalogShardIds,
  parseThinkRecord,
  stringifyThinkRecord,
  thinkCatalogShardId,
  THINK_RECORD_KEY,
  withThinkRecordEdge,
  withThinkRecordProps,
  withThinkRecordText,
} from '../src/store/v19-record.js';

const DEFAULT_BATCH_SIZE = 250;
const MIGRATION_WRITER_ID = 'think-v19-application-migration';

export class PrepareV19MindError extends Error {
  constructor(message, code = 'prepare_v19_mind.error') {
    super(message);
    this.name = 'PrepareV19MindError';
    this.code = code;
  }
}

export function usage() {
  return [
    'Usage:',
    '  node scripts/prepare-v19-mind.mjs --repo <path> --v18-package-root <path> [options]',
    '',
    'Options:',
    '  --repo <path>              Disposable v18 Think repository to prepare.',
    '  --v18-package-root <path>  Installed @git-stunts/git-warp v18 package root.',
    `  --batch-size <count>       Records per v18 patch. Defaults to ${DEFAULT_BATCH_SIZE}.`,
    '  --dry-run                  Inventory and validate without writing.',
    '  --json                     Emit machine-readable JSON.',
    '  --help, -h                 Show this help.',
    '',
    'This command is an application-data bridge. Run the official',
    'git-warp-v18-to-v19 substrate migrator only after this command succeeds.',
  ].join('\n');
}

export function parsePrepareArgs(argv) {
  const args = {
    batchSize: DEFAULT_BATCH_SIZE,
    dryRun: false,
    help: false,
    json: false,
    repo: null,
    v18PackageRoot: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (applyBooleanFlag(args, arg)) {
      continue;
    }
    if (applyValueFlag(args, arg, requireValue(argv, index, arg))) {
      index += 1;
      continue;
    }
    throw new PrepareV19MindError(`Unknown argument: ${arg}`, 'prepare_v19_mind.usage');
  }

  return Object.freeze(args);
}

function applyBooleanFlag(args, flag) {
  if (flag === '--dry-run') {
    args.dryRun = true;
    return true;
  }
  if (flag === '--json') {
    args.json = true;
    return true;
  }
  if (flag === '--help' || flag === '-h') {
    args.help = true;
    return true;
  }
  return false;
}

function applyValueFlag(args, flag, value) {
  if (flag === '--repo') {
    args.repo = value;
    return true;
  }
  if (flag === '--v18-package-root') {
    args.v18PackageRoot = value;
    return true;
  }
  if (flag === '--batch-size') {
    args.batchSize = parseBatchSize(value);
    return true;
  }
  return false;
}

function requireValue(argv, index, flag) {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new PrepareV19MindError(`${flag} requires a value`, 'prepare_v19_mind.usage');
  }
  return value;
}

function parseBatchSize(value) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new PrepareV19MindError(
      '--batch-size must be a positive integer',
      'prepare_v19_mind.usage'
    );
  }
  return parsed;
}

export async function prepareV19Mind(options) {
  const repoDir = requireRepository(options.repo);
  const v18PackageRoot = requireV18Package(options.v18PackageRoot);
  const runtime = await loadV18Runtime(v18PackageRoot);
  const session = await openV18Session(runtime, repoDir);
  const inventory = await readV18Inventory(session);
  const prepared = buildV19ApplicationRecords(inventory);
  const before = summarizePreparedRecords(prepared);

  if (options.dryRun) {
    return createReport({ before, dryRun: true, repoDir, verified: false });
  }

  await writePreparedRecords(session.worldline, prepared, options.batchSize);
  const verified = await verifyPreparedRecords(session.worldline.live(), prepared);
  return createReport({ before, dryRun: false, repoDir, verified });
}

function requireRepository(value) {
  if (!value) {
    throw new PrepareV19MindError('--repo is required', 'prepare_v19_mind.usage');
  }
  const repoDir = path.resolve(value);
  if (!existsSync(path.join(repoDir, '.git'))) {
    throw new PrepareV19MindError(
      `Think repository not found: ${repoDir}`,
      'prepare_v19_mind.repo_not_found'
    );
  }
  return repoDir;
}

function requireV18Package(value) {
  if (!value) {
    throw new PrepareV19MindError(
      '--v18-package-root is required',
      'prepare_v19_mind.usage'
    );
  }
  const packageRoot = path.resolve(value);
  const packageJsonPath = path.join(packageRoot, 'package.json');
  if (!existsSync(packageJsonPath)) {
    throw new PrepareV19MindError(
      `git-warp package not found: ${packageRoot}`,
      'prepare_v19_mind.package_not_found'
    );
  }
  const manifest = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  if (manifest.name !== '@git-stunts/git-warp' || !String(manifest.version).startsWith('18.')) {
    throw new PrepareV19MindError(
      `Expected @git-stunts/git-warp v18, found ${manifest.name}@${manifest.version}`,
      'prepare_v19_mind.package_version'
    );
  }
  return packageRoot;
}

async function loadV18Runtime(packageRoot) {
  const entries = v18CompatibilityEntries(packageRoot);
  const [
    runtime,
    { default: CasBlobAdapter },
    { default: SubstrateCompatibilityPolicy },
  ] = await Promise.all([
    import(pathToFileURL(entries.runtime).href),
    import(pathToFileURL(entries.blobAdapter).href),
    import(pathToFileURL(entries.compatibilityPolicy).href),
  ]);
  if (
    typeof runtime.GitGraphAdapter !== 'function'
    || typeof runtime.openWarpWorldline !== 'function'
  ) {
    throw new PrepareV19MindError(
      'The supplied v18 package does not expose the retained-state bridge',
      'prepare_v19_mind.package_api'
    );
  }
  return Object.freeze({
    ...runtime,
    CasBlobAdapter,
    legacyContentPolicy: new SubstrateCompatibilityPolicy({
      legacyContentBlobReads: true,
    }),
  });
}

function v18CompatibilityEntries(packageRoot) {
  const adapterRoot = path.join(
    packageRoot,
    'dist',
    'src',
    'infrastructure',
    'adapters'
  );
  return Object.freeze({
    blobAdapter: path.join(adapterRoot, 'CasBlobAdapter.js'),
    compatibilityPolicy: path.join(adapterRoot, 'SubstrateCompatibilityPolicy.js'),
    runtime: path.join(packageRoot, 'dist', 'index.js'),
  });
}

async function openV18Session(runtime, repoDir) {
  const plumbing = createThinkPlumbing(repoDir);
  const persistence = new runtime.GitGraphAdapter({
    plumbing,
  });
  const blobStorage = new runtime.CasBlobAdapter({
    compatibilityPolicy: runtime.legacyContentPolicy,
    persistence,
    plumbing,
  });
  const worldline = await runtime.openWarpWorldline({
    blobStorage,
    persistence,
    worldlineName: GRAPH_NAME,
    writerId: MIGRATION_WRITER_ID,
  });
  return Object.freeze({
    blobStorage,
    worldline,
  });
}

async function readV18Inventory(session) {
  const view = session.worldline.live();
  const [nodeIds, edges] = await Promise.all([
    view.getNodes(),
    view.getEdges(),
  ]);
  const nodes = [];

  for (const nodeId of [...nodeIds].sort(compareStrings)) {
    // eslint-disable-next-line no-await-in-loop -- bounded migration inventory preserves read failures
    const props = await view.getNodeProps(nodeId);
    // eslint-disable-next-line no-await-in-loop -- content OIDs are independent retained blobs
    const text = await readV18Text(session.blobStorage, props);
    nodes.push(Object.freeze({ id: nodeId, props: props ?? {}, text }));
  }

  return Object.freeze({
    edges: Object.freeze([...edges].sort(compareEdges)),
    nodes: Object.freeze(nodes),
  });
}

async function readV18Text(blobStorage, props) {
  if (!TEXT_CONTENT_KINDS.includes(props?.kind) || typeof props?._content !== 'string') {
    return null;
  }
  const content = await blobStorage.retrieve(props._content);
  return new TextDecoder().decode(content);
}

export function buildV19ApplicationRecords(inventory) {
  const records = new Map();
  for (const node of inventory.nodes) {
    records.set(node.id, recordFromV18Node(node));
  }
  for (const edge of inventory.edges) {
    addRecordEdge(records, edge);
  }
  addCatalogRecords(records);
  return records;
}

function recordFromV18Node(node) {
  const productProps = { ...node.props };
  delete productProps[THINK_RECORD_KEY];
  let record = withThinkRecordProps(createEmptyThinkRecord(), productProps);
  if (node.text !== null) {
    record = withThinkRecordText(record, node.text);
  }
  return record;
}

function addRecordEdge(records, edge) {
  const fromRecord = requireRecord(records, edge.from);
  const toRecord = requireRecord(records, edge.to);
  records.set(edge.from, withThinkRecordEdge(
    fromRecord,
    'outgoing',
    { id: edge.to, label: edge.label }
  ));
  records.set(edge.to, withThinkRecordEdge(
    toRecord,
    'incoming',
    { id: edge.from, label: edge.label }
  ));
}

function requireRecord(records, nodeId) {
  const record = records.get(nodeId);
  if (!record) {
    throw new PrepareV19MindError(
      `Edge references missing node: ${nodeId}`,
      'prepare_v19_mind.invalid_edge'
    );
  }
  return record;
}

function addCatalogRecords(records) {
  const shardIds = new Set(listThinkCatalogShardIds());
  const entries = [...records]
    .filter(([nodeId]) => !shardIds.has(nodeId))
    .map(([id, record]) => ({
      id,
      kind: typeof record.props.kind === 'string' ? record.props.kind : null,
    }));

  for (const shardId of shardIds) {
    let record = createEmptyThinkRecord();
    for (const entry of entries.filter(candidate => thinkCatalogShardId(candidate.id) === shardId)) {
      record = addThinkCatalogEntry(record, entry);
    }
    records.set(shardId, record);
  }
}

async function writePreparedRecords(worldline, records, batchSize) {
  const shardIds = new Set(listThinkCatalogShardIds());
  const entries = [...records].sort(([left], [right]) => compareStrings(left, right));

  for (let offset = 0; offset < entries.length; offset += batchSize) {
    const batch = entries.slice(offset, offset + batchSize);
    // eslint-disable-next-line no-await-in-loop -- each v18 writer commit advances the migration writer
    await worldline.commit(patch => {
      for (const [nodeId, record] of batch) {
        if (shardIds.has(nodeId)) {
          patch.addNode(nodeId);
        }
        patch.setProperty(nodeId, THINK_RECORD_KEY, stringifyThinkRecord(record));
      }
    });
  }
}

async function verifyPreparedRecords(view, records) {
  for (const [nodeId, expected] of records) {
    // eslint-disable-next-line no-await-in-loop -- verification names the first mismatched retained record
    const props = await view.getNodeProps(nodeId);
    const actual = parseThinkRecord(props?.[THINK_RECORD_KEY]);
    if (stringifyThinkRecord(actual) !== stringifyThinkRecord(expected)) {
      throw new PrepareV19MindError(
        `Prepared record verification failed: ${nodeId}`,
        'prepare_v19_mind.verify_failed'
      );
    }
  }
  return true;
}

function summarizePreparedRecords(records) {
  const manifest = [...records]
    .sort(([left], [right]) => compareStrings(left, right))
    .map(([nodeId, record]) => `${nodeId}\0${stringifyThinkRecord(record)}\n`)
    .join('');
  return Object.freeze({
    catalogShards: listThinkCatalogShardIds().length,
    manifestSha256: createHash('sha256').update(manifest, 'utf8').digest('hex'),
    records: records.size,
  });
}

function createReport({ before, dryRun, repoDir, verified }) {
  return Object.freeze({
    ok: true,
    dryRun,
    graph: GRAPH_NAME,
    repo: repoDir,
    writer: MIGRATION_WRITER_ID,
    records: before.records,
    catalogShards: before.catalogShards,
    manifestSha256: before.manifestSha256,
    verified,
  });
}

function compareStrings(left, right) {
  return left.localeCompare(right);
}

function compareEdges(left, right) {
  return compareStrings(left.from, right.from)
    || compareStrings(left.to, right.to)
    || compareStrings(left.label, right.label);
}

function printReport(report, json) {
  if (json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }
  process.stdout.write([
    `Think v19 application preparation ${report.dryRun ? 'rehearsed' : 'completed'}.`,
    `Repository: ${report.repo}`,
    `Records: ${report.records}`,
    `Manifest: ${report.manifestSha256}`,
    `Verified: ${report.verified ? 'yes' : 'not written'}`,
  ].join('\n'));
  process.stdout.write('\n');
}

async function main() {
  const args = parsePrepareArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  const report = await prepareV19Mind(args);
  printReport(report, args.json);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch(error => {
    const output = {
      ok: false,
      code: error.code ?? 'prepare_v19_mind.unexpected',
      message: error instanceof Error ? error.message : String(error),
    };
    if (process.argv.includes('--json')) {
      process.stderr.write(`${JSON.stringify(output, null, 2)}\n`);
    } else {
      process.stderr.write(`prepare-v19-mind: ${output.message}\n`);
    }
    process.exitCode = 1;
  });
}
