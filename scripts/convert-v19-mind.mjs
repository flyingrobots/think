#!/usr/bin/env node

import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

import { GIT_BINARY, THINK_GIT_CONFIG_ARGS } from '../src/git.js';
import {
  ARTIFACT_PREFIX,
  CLASSIFICATION_PREFIX,
  GRAPH_META_ID,
  GRAPH_NAME,
  KEYWORD_PREFIX,
  PIPELINE_RUN_PREFIX,
  READ_MODEL_PREFIX,
  TOPIC_PREFIX,
} from '../src/store/constants.js';
import {
  decodeNativeDocument,
  encodeNativeDocument,
} from '../src/store/native-document.js';
import {
  NATIVE_INDEX_PAGE_SIZE,
  readIndexedMemoryDocument,
} from '../src/store/native-index.js';
import {
  closeNativeMemory,
  openNativeMemory,
} from '../src/store/native-runtime.js';
import {
  formatFailure,
  formatReport,
  parseConvertArgs,
  usage,
} from './convert-v19-mind-cli.mjs';
import {
  collectNativeSourceProperties,
  mergeNativeSourceDocuments,
  requireCompleteSourceRecords,
} from './convert-v19-mind-source.mjs';
import {
  chunk,
  compareDocumentsOldestFirst,
  compareEdges,
  ConvertV19MindError,
  deepFreeze,
  isRecord,
  isSha256,
  requireInventorySummary,
  sampleDocuments,
  sha256,
  stableStringify,
  summarizeInventory,
  summarizeProjection,
} from './convert-v19-mind-support.mjs';

const LEGACY_RECORD_KEY = 'think.record.v1';
const LEGACY_RECORD_VERSION = 1;
const LEGACY_CATALOG_COUNT = 4;
const LEGACY_CATALOG_PREFIX = `${READ_MODEL_PREFIX}v19:catalog:`;
const NATIVE_INDEX_PREFIX = `${READ_MODEL_PREFIX}v19:index:`;
const CONVERTER_WRITER = 'think-native-v19-converter';
const EVACUATION_MATERIALIZATION_NAMESPACE = 'think-v19-migration';
const INVENTORY_FORMAT = 'think.native-v19.inventory';
const INVENTORY_VERSION = 1;
const IMPORT_CONCURRENCY = 8;
const READ_CONCURRENCY = 16;
const RECOMPUTABLE_PREFIXES = Object.freeze([
  ARTIFACT_PREFIX,
  CLASSIFICATION_PREFIX,
  KEYWORD_PREFIX,
  PIPELINE_RUN_PREFIX,
  READ_MODEL_PREFIX,
  TOPIC_PREFIX,
]);
const moduleRequire = createRequire(import.meta.url);
const gitWarpPackageRoot = path.dirname(
  moduleRequire.resolve('@git-stunts/git-warp/package.json')
);
let gitWarpEvacuationModulesPromise = null;

export { ConvertV19MindError, parseConvertArgs, usage };

export async function convertV19Mind(options) {
  const mode = requireConversionMode(options);
  if (mode === 'extract') {
    return await extractLegacyInventory(options);
  }
  return await convertInventory(options);
}

async function extractLegacyInventory(options) {
  const sourceDir = requireRepository(options.source, '--source');
  const outputPath = path.resolve(options.inventoryOut);
  const refsBefore = repositoryRefsSha256(sourceDir);
  const extractedInventory = await readLegacyInventory(sourceDir);
  requireStableSourceRefs(sourceDir, refsBefore);
  const outputSnapshot = createInventorySnapshot({
    inventory: extractedInventory,
    sourceDir,
    sourceRefsSha256: refsBefore,
  });
  await writeInventorySnapshot(outputPath, outputSnapshot);
  const persisted = await loadInventorySnapshot(outputPath);
  return Object.freeze({
    status: 'inventoried',
    sourceDir,
    inventoryPath: outputPath,
    sourceRefsSha256: refsBefore,
    manifestSha256: persisted.snapshot.manifestSha256,
    ...persisted.snapshot.summary,
    verified: true,
  });
}

function requireStableSourceRefs(sourceDir, refsBefore) {
  if (refsBefore !== repositoryRefsSha256(sourceDir)) {
    throw new ConvertV19MindError(
      'Legacy source refs changed while the inventory was being read',
      'convert_v19_mind.source_changed'
    );
  }
}

async function convertInventory(options) {
  const inputPath = path.resolve(options.inventoryIn);
  const loaded = await loadInventorySnapshot(inputPath);
  const inventory = projectNativeInventory(loaded.inventory);
  const context = Object.freeze({ inputPath, inventory, loaded });
  if (options.dryRun) {
    return inventoryVerificationReport(context);
  }
  const targetDir = requireRepository(options.target, '--target');
  return await importNativeInventory(context, targetDir);
}

function inventoryVerificationReport({ inputPath, inventory, loaded }) {
  return Object.freeze({
    status: 'inventory-verified',
    ...inventoryReportBase(inputPath, inventory, loaded),
    verified: true,
  });
}

async function importNativeInventory(context, targetDir) {
  requireEmptyTarget(targetDir);
  await runPartitionedWrites(
    targetDir,
    'index',
    [...context.inventory.byKind],
    async (workerMemory, [kind, documents]) => {
      await writeNativeIndex(workerMemory, kind, documents);
    }
  );
  await repairConvertedTarget(targetDir);
  const verification = await verifyConversion(targetDir, context.inventory);
  if (!verification.verified) {
    const error = new ConvertV19MindError(
      'Native v19 conversion verification failed',
      'convert_v19_mind.verification_failed'
    );
    error.details = verification;
    throw error;
  }
  return Object.freeze({
    status: 'converted',
    ...inventoryReportBase(
      context.inputPath,
      context.inventory,
      context.loaded
    ),
    targetDir,
    verified: true,
    verification,
  });
}

function inventoryReportBase(inputPath, inventory, loaded) {
  return {
    inventoryPath: inputPath,
    sourceDir: loaded.snapshot.source.repoDir,
    sourceRefsSha256: loaded.snapshot.source.refsSha256,
    manifestSha256: loaded.snapshot.manifestSha256,
    sourceSummary: loaded.snapshot.summary,
    ...summarizeInventory(inventory),
    ...summarizeProjection(loaded.inventory, inventory),
  };
}

async function repairConvertedTarget(targetDir) {
  const memory = await openNativeMemory(targetDir, {
    writerId: CONVERTER_WRITER,
  });
  try {
    await memory.repairBasis();
  } finally {
    await closeNativeMemory(targetDir);
  }
}

export function buildNativeInventory(records) {
  const documents = [];
  const edges = [];
  for (const [id, record] of records) {
    const document = Object.freeze({
      id,
      ...record.props,
      ...(record.text === null ? {} : { text: record.text }),
    });
    documents.push(document);
    for (const edge of record.outgoing) {
      edges.push(Object.freeze({
        from: id,
        to: edge.id,
        label: edge.label,
      }));
    }
  }
  return buildInventoryFromNativeDocuments(documents, edges);
}

export function createInventorySnapshot({
  inventory,
  sourceDir,
  sourceRefsSha256,
}) {
  if (!isSha256(sourceRefsSha256)) {
    throw new ConvertV19MindError(
      'Source ref digest must be a SHA-256 value',
      'convert_v19_mind.snapshot_invalid'
    );
  }
  const payload = Object.freeze({
    format: INVENTORY_FORMAT,
    version: INVENTORY_VERSION,
    source: Object.freeze({
      repoDir: path.resolve(sourceDir),
      refsSha256: sourceRefsSha256,
    }),
    summary: summarizeInventory(inventory),
    documents: inventory.documents,
    edges: inventory.edges,
  });
  return deepFreeze({
    ...payload,
    manifestSha256: sha256(stableStringify(payload)),
  });
}

export function projectNativeInventory(sourceInventory) {
  const capturedThoughtIds = new Set(
    sourceInventory.documents
      .filter(document => document.kind === 'capture')
      .map(document => document.thoughtId)
      .filter(value => typeof value === 'string' && value.length > 0)
  );
  const documents = sourceInventory.documents.filter(document => (
    !isRecomputableDocument(document, capturedThoughtIds)
  ));
  return buildInventoryFromNativeDocuments([...documents], []);
}

export function parseInventorySnapshot(text) {
  const parsed = parseInventoryJson(text);
  requireInventoryEnvelope(parsed);
  const documents = requireUniqueNativeDocuments(parsed.documents);
  const edges = parsed.edges.map(requireNativeEdge);
  const inventory = buildInventoryFromNativeDocuments(documents, edges);
  const summary = requireInventorySummary(parsed.summary);
  requireMatchingInventorySummary(summary, inventory);
  const payload = createParsedInventoryPayload(parsed, summary, documents, edges);
  const expectedSha256 = sha256(stableStringify(payload));
  requireMatchingManifest(parsed.manifestSha256, expectedSha256);
  return Object.freeze({
    inventory,
    snapshot: deepFreeze({
      ...payload,
      manifestSha256: expectedSha256,
    }),
  });
}

function parseInventoryJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    throw new ConvertV19MindError(
      'Inventory is not valid JSON',
      'convert_v19_mind.snapshot_invalid'
    );
  }
}

function requireInventoryEnvelope(value) {
  if (!isRecord(value)) {
    throw invalidInventoryStructureError();
  }
  requireInventoryIdentity(value);
  requireInventorySource(value.source);
  if (!isRecord(value.summary)) {
    throw invalidInventoryStructureError();
  }
  if (!Array.isArray(value.documents) || !Array.isArray(value.edges)) {
    throw invalidInventoryStructureError();
  }
}

function requireInventoryIdentity(value) {
  if (value.format !== INVENTORY_FORMAT || value.version !== INVENTORY_VERSION) {
    throw invalidInventoryStructureError();
  }
  if (!isSha256(value.manifestSha256)) {
    throw invalidInventoryStructureError();
  }
}

function requireInventorySource(source) {
  if (!isRecord(source) || !isSha256(source.refsSha256)) {
    throw invalidInventoryStructureError();
  }
  if (typeof source.repoDir !== 'string' || source.repoDir.length === 0) {
    throw invalidInventoryStructureError();
  }
}

function invalidInventoryStructureError() {
  return new ConvertV19MindError(
    'Inventory structure is invalid',
    'convert_v19_mind.snapshot_invalid'
  );
}

function requireUniqueNativeDocuments(values) {
  const documents = values.map(requireNativeDocument);
  const ids = new Set();
  for (const document of documents) {
    if (ids.has(document.id)) {
      throw new ConvertV19MindError(
        `Inventory contains duplicate document id: ${document.id}`,
        'convert_v19_mind.snapshot_invalid'
      );
    }
    ids.add(document.id);
  }
  return documents;
}

function requireMatchingInventorySummary(summary, inventory) {
  if (stableStringify(summary) !== stableStringify(summarizeInventory(inventory))) {
    throw new ConvertV19MindError(
      'Inventory summary does not match its documents and edges',
      'convert_v19_mind.snapshot_invalid'
    );
  }
}

function createParsedInventoryPayload(parsed, summary, documents, edges) {
  return deepFreeze({
    format: INVENTORY_FORMAT,
    version: INVENTORY_VERSION,
    source: {
      repoDir: parsed.source.repoDir,
      refsSha256: parsed.source.refsSha256,
    },
    summary,
    documents,
    edges,
  });
}

function requireMatchingManifest(actual, expected) {
  if (actual !== expected) {
    throw new ConvertV19MindError(
      'Inventory checksum does not match its manifest',
      'convert_v19_mind.snapshot_checksum_mismatch'
    );
  }
}

function buildInventoryFromNativeDocuments(documents, edges) {
  const byKind = new Map();
  for (const document of documents) {
    const kind = typeof document.kind === 'string' && document.kind.length > 0
      ? document.kind
      : null;
    if (kind) {
      const entries = byKind.get(kind) ?? [];
      entries.push(document);
      byKind.set(kind, entries);
    }
  }
  for (const entries of byKind.values()) {
    entries.sort(compareDocumentsOldestFirst);
    Object.freeze(entries);
  }
  documents.sort((left, right) => left.id.localeCompare(right.id));
  edges.sort(compareEdges);
  return Object.freeze({
    byKind,
    documents: Object.freeze(documents),
    edges: Object.freeze(edges),
  });
}

async function loadInventorySnapshot(inventoryPath) {
  let contents;
  try {
    contents = await readFile(inventoryPath, 'utf8');
  } catch (error) {
    throw new ConvertV19MindError(
      `Unable to read inventory ${inventoryPath}: ${error.message}`,
      'convert_v19_mind.snapshot_read_failed'
    );
  }
  return parseInventorySnapshot(contents);
}

async function writeInventorySnapshot(inventoryPath, snapshot) {
  try {
    await writeFile(
      inventoryPath,
      `${JSON.stringify(snapshot, null, 2)}\n`,
      { encoding: 'utf8', flag: 'wx' }
    );
  } catch (error) {
    const code = error?.code === 'EEXIST'
      ? 'convert_v19_mind.snapshot_exists'
      : 'convert_v19_mind.snapshot_write_failed';
    throw new ConvertV19MindError(
      `Unable to create inventory ${inventoryPath}: ${error.message}`,
      code
    );
  }
}

async function readLegacyInventory(repoDir) {
  const modules = await loadGitWarpEvacuationModules();
  const state = await materializeLegacyState(repoDir, modules);
  const liveNodeIds = [...state.nodeAlive.elements()].sort();
  const collected = collectLegacyRecords(state, modules, liveNodeIds);
  const native = collectNativeSourceProperties(state, modules, liveNodeIds);
  requireCompleteSourceRecords(collected, native, liveNodeIds);
  requireLegacyCatalogs(collected.records);
  return mergeSourceInventories(
    buildNativeInventory(collected.records),
    native.documents
  );
}

function collectLegacyRecords(state, modules, liveNodeIds) {
  const liveNodeIdSet = new Set(liveNodeIds);
  const records = new Map();
  const invalidRecordIds = [];
  for (const [encodedKey, register] of state.prop) {
    if (modules.isEdgePropKey(encodedKey)) {
      continue;
    }
    const { nodeId, propKey } = modules.decodePropKey(encodedKey);
    if (propKey !== LEGACY_RECORD_KEY || !liveNodeIdSet.has(nodeId)) {
      continue;
    }
    const record = parseLegacyRecord(register.value);
    if (record === null) {
      invalidRecordIds.push(nodeId);
      continue;
    }
    records.set(nodeId, record);
  }
  return Object.freeze({ invalidRecordIds, records });
}

export function mergeSourceInventories(legacyInventory, nativeDocuments) {
  return buildInventoryFromNativeDocuments(
    mergeNativeSourceDocuments(legacyInventory.documents, nativeDocuments),
    [...legacyInventory.edges]
  );
}

function requireLegacyCatalogs(records) {
  const missingCatalogIds = legacyCatalogIds().filter(id => !records.has(id));
  if (missingCatalogIds.length > 0) {
    throw new ConvertV19MindError(
      `Legacy Think catalog records are missing: ${missingCatalogIds.join(', ')}`,
      'convert_v19_mind.legacy_catalog_missing'
    );
  }
}

async function materializeLegacyState(repoDir, modules) {
  const storage = await modules.GitStorage.open({ cwd: repoDir });
  const binding = modules.resolveWarpStorage(storage);
  const ports = modules.getDefaultRuntimeHostNodePorts();
  const runtimeStorage = migrationRuntimeStorage(binding.runtimeStorage, modules);
  let graph = null;
  try {
    graph = await modules.openRuntimeHostProduct({
      persistence: binding.history,
      runtimeStorage,
      graphName: GRAPH_NAME,
      writerId: CONVERTER_WRITER,
      codec: new modules.V18CheckpointMigrationCodec(),
      crypto: ports.crypto,
      trustCrypto: ports.trustCrypto,
      commitMessageCodec: ports.commitMessageCodec,
      stateCache: null,
      autoMaterialize: false,
    });
    return await graph.materialize();
  } finally {
    if (graph !== null) {
      await graph.close();
    }
    await storage.close();
  }
}

function migrationRuntimeStorage(runtimeStorage, modules) {
  return Object.freeze({
    async createRuntimeStorageServices(options) {
      const services = await runtimeStorage.createRuntimeStorageServices(options);
      const { materializations } = services;
      const withoutTrie = { ...services };
      Reflect.deleteProperty(withoutTrie, 'materializations');
      Reflect.deleteProperty(withoutTrie, 'trie');
      return Object.freeze({
        ...withoutTrie,
        materializations: transientMaterializationStore(materializations, modules),
      });
    },
  });
}

function transientMaterializationStore(underlying, modules) {
  return Object.freeze({
    openWorkspace: rejectMaterializationWorkspace,
    retain: request => retainTransientMaterialization(request, modules),
    acquireExact: resolveNull,
    acquireBestCompatiblePredecessor: resolveNull,
    loadReplayBasis: resolveNull,
    close: () => underlying.close(),
  });
}

function rejectMaterializationWorkspace() {
  return Promise.reject(new ConvertV19MindError(
    'Legacy evacuation cannot open a materialization workspace',
    'convert_v19_mind.materialization_write_rejected'
  ));
}

function retainTransientMaterialization(request, modules) {
  const bundle = new modules.BundleHandle(`transient:${request.stateHash}`);
  return Promise.resolve(new modules.MaterializationHandle({
    laneName: GRAPH_NAME,
    bundle,
    coordinate: request.coordinate,
    roots: request.roots,
    stateHash: request.stateHash,
    retention: new modules.StorageRetentionWitness({
      handle: bundle,
      policy: 'evictable',
      reachability: 'volatile',
      root: transientRetentionRoot(modules),
      observedAt: new Date().toISOString(),
    }),
  }));
}

function transientRetentionRoot(modules) {
  return new modules.StorageRetentionRoot({
    kind: 'expiring-set',
    namespace: EVACUATION_MATERIALIZATION_NAMESPACE,
    locator: 'memory',
    generation: '1',
    path: GRAPH_NAME,
  });
}

function resolveNull() {
  return Promise.resolve(null);
}

async function loadGitWarpEvacuationModules() {
  gitWarpEvacuationModulesPromise ??= loadEvacuationModuleSet();
  return await gitWarpEvacuationModulesPromise;
}

async function loadEvacuationModuleSet() {
  const modules = await Promise.all([
    importGitWarpModule('dist/src/application/GitStorage.js'),
    importGitWarpModule('dist/src/application/WarpStorageRegistry.js'),
    importGitWarpModule('dist/src/application/RuntimeHostNodeDefaults.js'),
    importGitWarpModule('dist/src/domain/warp/RuntimeHostProduct.js'),
    importGitWarpModule('dist/src/domain/materialization/MaterializationHandle.js'),
    importGitWarpModule('dist/src/domain/storage/BundleHandle.js'),
    importGitWarpModule('dist/src/domain/storage/StorageRetentionWitness.js'),
    importGitWarpModule('dist/src/domain/services/KeyCodec.js'),
    importGitWarpModule(
      'dist/scripts/v18-to-v19/V18CheckpointMigrationCodec.js'
    ),
  ]);
  return assembleEvacuationModules(modules);
}

function assembleEvacuationModules([
    gitStorage,
    storageRegistry,
    nodeDefaults,
    runtimeHostProduct,
    materializationHandle,
    bundleHandle,
    storageRetention,
    keyCodec,
    checkpointCodec,
  ]) {
  return Object.freeze({
    GitStorage: gitStorage.default,
    resolveWarpStorage: storageRegistry.resolveWarpStorage,
    getDefaultRuntimeHostNodePorts: nodeDefaults.getDefaultRuntimeHostNodePorts,
    openRuntimeHostProduct: runtimeHostProduct.openRuntimeHostProduct,
    MaterializationHandle: materializationHandle.default,
    BundleHandle: bundleHandle.default,
    StorageRetentionWitness: storageRetention.default,
    StorageRetentionRoot: storageRetention.StorageRetentionRoot,
    decodePropKey: keyCodec.decodePropKey,
    isEdgePropKey: keyCodec.isEdgePropKey,
    V18CheckpointMigrationCodec: checkpointCodec.V18CheckpointMigrationCodec,
  });
}

async function importGitWarpModule(relativePath) {
  return await import(pathToFileURL(path.join(gitWarpPackageRoot, relativePath)).href);
}

function parseLegacyRecord(value) {
  if (typeof value !== 'string' || value.length === 0) {
    return null;
  }
  try {
    const parsed = JSON.parse(value);
    if (!isLegacyRecord(parsed)) {
      return null;
    }
    return Object.freeze({
      props: Object.freeze({ ...parsed.props }),
      text: parsed.text,
      incoming: Object.freeze(parsed.incoming.map(requireLegacyEdge)),
      outgoing: Object.freeze(parsed.outgoing.map(requireLegacyEdge)),
    });
  } catch {
    return null;
  }
}

function isLegacyRecord(value) {
  if (!isRecord(value) || value.version !== LEGACY_RECORD_VERSION) {
    return false;
  }
  if (!isRecord(value.props) || !Array.isArray(value.incoming)) {
    return false;
  }
  if (!Array.isArray(value.outgoing)) {
    return false;
  }
  return value.text === null || typeof value.text === 'string';
}

async function writeNativeIndex(memory, kind, documents) {
  const pages = chunk(documents, NATIVE_INDEX_PAGE_SIZE);
  for (let pageNumber = 0; pageNumber < pages.length; pageNumber += 1) {
    const page = Object.freeze({
      kind,
      pageNumber,
      entries: Object.freeze(pages[pageNumber]),
    });
    // eslint-disable-next-line no-await-in-loop -- pages are independently bounded v19 properties
    await memory.writeMemoryIndexPage({
      id: nativeIndexPageId(kind, pageNumber),
      bytes: encodeNativeDocument('memory-index-page', page),
    });
  }
  const latest = documents.at(-1) ?? null;
  const state = Object.freeze({
    id: nativeIndexId(kind),
    kind,
    total: documents.length,
    latestId: latest?.id ?? null,
    headPage: Math.max(0, pages.length - 1),
  });
  await memory.writeMemoryIndex({
    id: state.id,
    bytes: encodeNativeDocument('memory-index', state),
  });
}

async function verifyConversion(repoDir, inventory) {
  const memory = await openNativeMemory(repoDir, { writerId: CONVERTER_WRITER });
  try {
    const expectedCaptures = inventory.byKind.get('capture') ?? [];
    const captureState = decodeNativeDocument(
      await memory.memoryIndex(nativeIndexId('capture')),
      'memory-index'
    );
    const samples = sampleDocuments(inventory.documents);
    const sampleResults = await mapConcurrent(samples, async (expected) => {
      const actual = await readIndexedMemoryDocument(repoDir, expected.id, {
        kinds: [expected.kind],
        memory,
      });
      return Object.freeze({
        id: expected.id,
        matched: JSON.stringify(actual) === JSON.stringify(expected),
      });
    }, READ_CONCURRENCY);
    const verified = captureState?.total === expectedCaptures.length
      && sampleResults.every(result => result.matched);
    return Object.freeze({
      verified,
      captureCount: captureState?.total ?? null,
      expectedCaptureCount: expectedCaptures.length,
      samples: Object.freeze(sampleResults),
    });
  } finally {
    await closeNativeMemory(repoDir);
  }
}

async function mapConcurrent(values, task, concurrency) {
  const results = new Array(values.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      // eslint-disable-next-line no-await-in-loop -- bounded worker pool
      results[index] = await task(values[index], index);
    }
  }
  await Promise.all(
    Array.from(
      { length: Math.min(concurrency, values.length) },
      () => worker()
    )
  );
  return results;
}

async function runPartitionedWrites(repoDir, phase, values, task) {
  if (values.length === 0) {
    return;
  }
  let nextIndex = 0;
  const workerCount = Math.min(IMPORT_CONCURRENCY, values.length);
  const workers = Array.from({ length: workerCount }, (_unused, workerIndex) => (
    async () => {
      const writerId = `${CONVERTER_WRITER}.${phase}.${String(workerIndex).padStart(2, '0')}`;
      const memory = await openNativeMemory(repoDir, { writerId });
      while (nextIndex < values.length) {
        const index = nextIndex;
        nextIndex += 1;
        try {
          // eslint-disable-next-line no-await-in-loop -- each worker owns one ordered writer head
          await task(memory, values[index], index);
        } catch (error) {
          return error;
        }
      }
      return null;
    }
  ));
  let results;
  try {
    results = await Promise.all(workers.map(worker => worker()));
  } finally {
    await closeNativeMemory(repoDir);
  }
  const failure = results.find(result => result !== null) ?? null;
  if (failure !== null) {
    throw failure;
  }
}

function legacyCatalogIds() {
  return Array.from(
    { length: LEGACY_CATALOG_COUNT },
    (_unused, index) => `${LEGACY_CATALOG_PREFIX}${String(index).padStart(2, '0')}`
  );
}

function nativeIndexId(kind) {
  return `${NATIVE_INDEX_PREFIX}${kind}`;
}

function nativeIndexPageId(kind, number) {
  return `${NATIVE_INDEX_PREFIX}${kind}:page:${String(number).padStart(8, '0')}`;
}

function requireRepository(value, option) {
  if (!value) {
    throw new ConvertV19MindError(`${option} is required`, 'convert_v19_mind.usage');
  }
  const repoDir = path.resolve(value);
  if (!existsSync(path.join(repoDir, '.git'))) {
    throw new ConvertV19MindError(
      `Think repository not found: ${repoDir}`,
      'convert_v19_mind.repo_not_found'
    );
  }
  return repoDir;
}

function requireConversionMode(options) {
  const hasSource = hasOptionValue(options.source);
  const hasInventoryIn = hasOptionValue(options.inventoryIn);
  if (hasSource === hasInventoryIn) {
    throw new ConvertV19MindError(
      'Exactly one of --source or --inventory-in is required',
      'convert_v19_mind.usage'
    );
  }
  return hasSource
    ? requireExtractMode(options)
    : requireInventoryMode(options);
}

function requireExtractMode(options) {
  const invalid = !hasOptionValue(options.inventoryOut)
    || hasOptionValue(options.target)
    || options.dryRun;
  if (invalid) {
    throw new ConvertV19MindError(
      '--source requires --inventory-out and cannot be combined with --target or --dry-run',
      'convert_v19_mind.usage'
    );
  }
  return 'extract';
}

function requireInventoryMode(options) {
  if (hasOptionValue(options.inventoryOut)) {
    throw new ConvertV19MindError(
      '--inventory-out can only be combined with --source',
      'convert_v19_mind.usage'
    );
  }
  const hasTarget = hasOptionValue(options.target);
  if (options.dryRun === hasTarget) {
    throw new ConvertV19MindError(
      '--inventory-in requires exactly one of --target or --dry-run',
      'convert_v19_mind.usage'
    );
  }
  return options.dryRun ? 'validate' : 'import';
}

function hasOptionValue(value) {
  return typeof value === 'string' && value.length > 0;
}

function repositoryRefsSha256(repoDir) {
  const result = spawnSync(
    GIT_BINARY,
    [
      ...THINK_GIT_CONFIG_ARGS,
      '-C',
      repoDir,
      'for-each-ref',
      '--format=%(refname) %(objectname)',
    ],
    { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }
  );
  if (result.status !== 0) {
    throw new ConvertV19MindError(
      `Unable to snapshot refs in ${repoDir}`,
      'convert_v19_mind.source_inspection_failed'
    );
  }
  const refs = result.stdout
    .split(/\r?\n/u)
    .filter(line => line.length > 0)
    .sort();
  return sha256(refs.length > 0 ? `${refs.join('\n')}\n` : '');
}

function requireEmptyTarget(repoDir) {
  const result = spawnSync(
    GIT_BINARY,
    [
      ...THINK_GIT_CONFIG_ARGS,
      '-C',
      repoDir,
      'for-each-ref',
      '--count=1',
      '--format=%(refname)',
    ],
    { encoding: 'utf8' }
  );
  if (result.status !== 0) {
    throw new ConvertV19MindError(
      `Unable to inspect native target: ${repoDir}`,
      'convert_v19_mind.target_inspection_failed'
    );
  }
  if (result.stdout.trim().length > 0) {
    throw new ConvertV19MindError(
      `Native target must contain no refs: ${repoDir}`,
      'convert_v19_mind.target_not_empty'
    );
  }
}

function requireLegacyEdge(value) {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.label !== 'string') {
    throw new ConvertV19MindError(
      'Legacy Think record contains an invalid edge',
      'convert_v19_mind.edge_invalid'
    );
  }
  return Object.freeze({ id: value.id, label: value.label });
}

function requireNativeDocument(value) {
  if (!isRecord(value) || typeof value.id !== 'string' || value.id.length === 0) {
    throw new ConvertV19MindError(
      'Inventory contains an invalid native document',
      'convert_v19_mind.snapshot_invalid'
    );
  }
  return deepFreeze({ ...value });
}

function requireNativeEdge(value) {
  if (
    !isRecord(value)
    || typeof value.from !== 'string'
    || value.from.length === 0
    || typeof value.to !== 'string'
    || value.to.length === 0
    || typeof value.label !== 'string'
    || value.label.length === 0
  ) {
    throw new ConvertV19MindError(
      'Inventory contains an invalid native edge',
      'convert_v19_mind.snapshot_invalid'
    );
  }
  return Object.freeze({
    from: value.from,
    to: value.to,
    label: value.label,
  });
}

function isRecomputableDocument(document, capturedThoughtIds) {
  if (document.id === GRAPH_META_ID) {
    return true;
  }
  if (RECOMPUTABLE_PREFIXES.some(prefix => document.id.startsWith(prefix))) {
    return true;
  }
  return document.kind === 'thought' && capturedThoughtIds.has(document.id);
}

async function main() {
  const args = parseConvertArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  try {
    const report = await convertV19Mind(args);
    process.stdout.write(`${formatReport(report, args.json)}\n`);
  } catch (error) {
    process.stderr.write(`${formatFailure(error, args.json)}\n`);
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await main();
}
