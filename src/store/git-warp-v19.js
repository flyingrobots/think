import { execFile, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { promisify } from 'node:util';

import { Runtime } from '@git-stunts/git-warp';

import { ThinkError } from '../errors.js';
import { GIT_BINARY, THINK_GIT_CONFIG_ARGS } from '../git.js';
import { GRAPH_NAME } from './constants.js';
import { thinkWarp } from './think-warp-sdk.js';
import {
  addThinkCatalogEntry,
  createEmptyThinkRecord,
  listThinkCatalogShardIds,
  parseThinkRecord,
  readThinkCatalogEntries,
  stringifyThinkRecord,
  thinkCatalogShardId,
  withThinkRecordEdge,
  withThinkRecordProps,
  withThinkRecordText,
} from './v19-record.js';

const nodeRequire = createRequire(import.meta.url);
const gitWarpPackageRoot = path.dirname(nodeRequire.resolve('@git-stunts/git-warp/package.json'));
const gitWarpCli = path.join(gitWarpPackageRoot, 'dist', 'bin', 'git-warp.js');
const sessionCache = new Map();
const DEFAULT_PATCH_MAX_ATTEMPTS = 3;
const WRITER_CAS_CONFLICT_TEXT = 'writer ref was updated by another process';
const execFileAsync = promisify(execFile);

export async function openV19ThinkWorldline(repoDir, writerId) {
  const cacheKey = sessionCacheKey(repoDir, writerId);
  let session = sessionCache.get(cacheKey);
  if (!session) {
    // eslint-disable-next-line no-use-before-define -- composition entry follows the runtime-backed classes
    session = await ThinkWarpSession.open(repoDir, writerId);
    sessionCache.set(cacheKey, session);
  }
  // eslint-disable-next-line no-use-before-define -- composition entry follows the runtime-backed classes
  return new ThinkWorldline(session);
}

export function clearV19RuntimeCache(repoDir) {
  for (const [cacheKey, session] of sessionCache) {
    if (!cacheKey.startsWith(`${repoDir}\0`)) {
      continue;
    }
    sessionCache.delete(cacheKey);
    session.close().catch(() => undefined);
  }
}

export async function commitV19ThinkWorldline(repoDir, writerId, patcher, {
  maxAttempts = DEFAULT_PATCH_MAX_ATTEMPTS,
} = {}) {
  let attempt = 1;

  /* eslint-disable no-await-in-loop -- retries must reopen against the latest writer head */
  while (true) {
    const worldline = await openV19ThinkWorldline(repoDir, writerId);
    try {
      await worldline.commit(patcher);
      return worldline;
    } catch (error) {
      if (!isWriterCasConflict(error) || attempt >= maxAttempts) {
        throw error;
      }
      await worldline.reopen();
      attempt += 1;
    }
  }
  /* eslint-enable no-await-in-loop */
}

export function isWriterCasConflict(error) {
  return error instanceof Error && (
    error.code === 'E_WRITER_CAS_CONFLICT'
    || error.message.includes(WRITER_CAS_CONFLICT_TEXT)
  );
}

class ThinkWorldline {
  constructor(session) {
    this.session = session;
    this.writerId = session.writerId;
    Object.freeze(this);
  }

  live() {
    return this.session.view;
  }

  async commit(patcher) {
    // eslint-disable-next-line no-use-before-define -- patch implementation is private to this adapter
    const patch = new ThinkPatch();
    await patcher(patch);
    await patch.apply(this.session);
  }

  async readRecord(nodeId) {
    return await this.session.readRecord(nodeId);
  }

  async reopen() {
    await this.session.reopen();
  }
}

class ThinkWarpSession {
  constructor(repoDir, writerId, runtime, lane) {
    this.repoDir = repoDir;
    this.writerId = writerId;
    this.runtime = runtime;
    this.lane = lane;
    // eslint-disable-next-line no-use-before-define -- view and session form one private runtime aggregate
    this.view = new ThinkV19View(this);
  }

  static async open(repoDir, writerId) {
    const runtime = await Runtime.open({
      at: repoDir,
      writer: writerId,
    });
    const lane = await runtime.lane(GRAPH_NAME);
    return new ThinkWarpSession(repoDir, writerId, runtime, lane);
  }

  async close() {
    await this.runtime.close();
  }

  async reopen() {
    await this.runtime.close();
    this.runtime = await Runtime.open({
      at: this.repoDir,
      writer: this.writerId,
    });
    this.lane = await this.runtime.lane(GRAPH_NAME);
  }

  async repairMaterialization() {
    await this.runtime.close();
    await runMaterializationRepair(this.repoDir, this.writerId);
    this.runtime = await Runtime.open({
      at: this.repoDir,
      writer: this.writerId,
    });
    this.lane = await this.runtime.lane(GRAPH_NAME);
  }

  async readRecord(nodeId) {
    const values = await this.readRecordValues([nodeId]);
    return parseThinkRecord(values[0]);
  }

  async readRecords(nodeIds) {
    const values = await this.readRecordValues(nodeIds);
    return new Map(nodeIds.map((nodeId, index) => [
      nodeId,
      parseThinkRecord(values[index]),
    ]));
  }

  async readRecordValues(nodeIds) {
    if (nodeIds.length === 0) {
      return [];
    }
    if (!hasThinkWriterRefs(this.repoDir)) {
      return nodeIds.map(() => null);
    }

    try {
      return await observeRecordValues(this.lane, nodeIds);
    } catch (error) {
      if (!isRepairableReadFailure(error)) {
        throw error;
      }
      await this.repairMaterialization();
      return await observeRecordValues(this.lane, nodeIds);
    }
  }

  async write(intent) {
    const receipt = await this.lane.write(intent);
    requireAdmittedWrite(receipt);
    return receipt;
  }
}

class ThinkPatch {
  constructor() {
    this.changes = new Map();
    this.edges = [];
  }

  addNode(nodeId) {
    this.changeFor(nodeId).add = true;
    return this;
  }

  setProperty(nodeId, key, value) {
    this.changeFor(nodeId).props[key] = value;
    return this;
  }

  addEdge(from, to, label) {
    this.edges.push(Object.freeze({ from, to, label }));
    return this;
  }

  attachContent(nodeId, content) {
    const bytes = content instanceof Uint8Array ? content : new Uint8Array(content);
    this.changeFor(nodeId).text = new TextDecoder().decode(bytes);
    return this;
  }

  changeFor(nodeId) {
    let change = this.changes.get(nodeId);
    if (!change) {
      change = {
        add: false,
        props: {},
        text: undefined,
      };
      this.changes.set(nodeId, change);
    }
    return change;
  }

  async apply(session) {
    const repositoryWasEmpty = !hasThinkWriterRefs(session.repoDir);
    const touchedIds = collectTouchedNodeIds(this.changes, this.edges);
    const records = repositoryWasEmpty
      ? emptyRecordMap(touchedIds)
      : await session.readRecords(touchedIds);
    applyRecordChanges(records, this.changes);
    applyRecordEdges(records, this.edges);
    const newNodeIds = addedNodeIds(this.changes);
    await this.updateCatalogRecords(session, records, newNodeIds, repositoryWasEmpty);
    await registerNodes(session, newNodeIds);
    await writeRecords(session, records);
    if (repositoryWasEmpty) {
      await session.repairMaterialization();
    }
  }

  async updateCatalogRecords(session, records, newNodeIds, repositoryWasEmpty) {
    const additionsByShard = catalogAdditionsByShard(records, newNodeIds);
    if (additionsByShard.size === 0) {
      return;
    }
    const shardIds = [...additionsByShard.keys()];
    const existing = repositoryWasEmpty
      ? emptyRecordMap(shardIds)
      : await session.readRecords(shardIds);
    for (const shardId of shardIds) {
      const record = applyCatalogAdditions(existing.get(shardId), additionsByShard.get(shardId));
      if (!existing.get(shardId)) {
        // eslint-disable-next-line no-await-in-loop -- v19 admits one Intent per write
        await session.write(thinkWarp.intents.registerNode({ subject: shardId }));
      }
      records.set(shardId, record);
    }
  }
}

class ThinkV19View {
  constructor(session) {
    this.session = session;
    this.traverse = Object.freeze({
      bfs: (startId, options) => this.bfs(startId, options),
    });
  }

  async getNodeProps(nodeId) {
    const record = await this.session.readRecord(nodeId);
    if (!record) {
      return null;
    }
    return {
      ...record.props,
      _thinkText: record.text,
    };
  }

  async hasNode(nodeId) {
    return Boolean(await this.session.readRecord(nodeId));
  }

  query() {
    // eslint-disable-next-line no-use-before-define -- query is constructed only through this view
    return new ThinkV19Query(this);
  }

  async listCatalogEntries() {
    const records = await this.session.readRecords(listThinkCatalogShardIds());
    const entriesById = new Map();
    for (const record of records.values()) {
      for (const entry of readThinkCatalogEntries(record)) {
        entriesById.set(entry.id, entry);
      }
    }
    return [...entriesById.values()].sort((left, right) => left.id.localeCompare(right.id));
  }

  async bfs(startId, { dir = 'out', labelFilter = null } = {}) {
    const visited = new Set();
    const queue = [startId];
    while (queue.length > 0) {
      const nodeId = queue.shift();
      if (visited.has(nodeId)) {
        continue;
      }
      visited.add(nodeId);
      // eslint-disable-next-line no-await-in-loop -- traversal follows application-owned adjacency
      const record = await this.session.readRecord(nodeId);
      queue.push(...selectTraversalIds(record, dir, labelFilter));
    }
    return [...visited];
  }
}

class ThinkV19Query {
  constructor(view) {
    this.view = view;
    this.patterns = [];
    this.filters = {};
    this.direction = null;
    this.label = null;
  }

  match(patterns) {
    this.patterns = Array.isArray(patterns) ? [...patterns] : [patterns];
    return this;
  }

  where(filters) {
    this.filters = { ...filters };
    return this;
  }

  incoming(label) {
    this.direction = 'incoming';
    this.label = label;
    return this;
  }

  outgoing(label) {
    this.direction = 'outgoing';
    this.label = label;
    return this;
  }

  async run() {
    if (this.direction) {
      return await this.runTraversal();
    }
    return await this.runMatch();
  }

  async runTraversal() {
    const sourceId = this.patterns[0];
    const source = await this.view.session.readRecord(sourceId);
    const edges = source?.[this.direction] ?? [];
    const ids = edges
      .filter(edge => !this.label || edge.label === this.label)
      .map(edge => edge.id);
    return Object.freeze({
      nodes: Object.freeze(await this.readNodes(ids)),
    });
  }

  async runMatch() {
    const exactIds = this.patterns.filter(pattern => !pattern.includes('*'));
    const wildcardPatterns = this.patterns.filter(pattern => pattern.includes('*'));
    const ids = new Set(exactIds);

    if (wildcardPatterns.length > 0) {
      const catalog = await this.view.listCatalogEntries();
      for (const entry of catalog) {
        if (
          wildcardPatterns.some(pattern => matchesPattern(entry.id, pattern))
          && (this.filters.kind === undefined || entry.kind === this.filters.kind)
        ) {
          ids.add(entry.id);
        }
      }
    }

    return Object.freeze({
      nodes: Object.freeze(await this.readNodes([...ids])),
    });
  }

  async readNodes(ids) {
    const records = await this.view.session.readRecords(ids);
    const nodes = [];
    for (const id of ids) {
      const record = records.get(id);
      if (!record || !matchesFilters(record.props, this.filters)) {
        continue;
      }
      nodes.push(Object.freeze({
        id,
        props: record.props,
      }));
    }
    return nodes;
  }
}

async function observeRecordValues(lane, nodeIds) {
  const observation = lane.observe(recordObserver(nodeIds));
  if (nodeIds.length === 1) {
    const reading = await observation.one();
    requireCompletedObservation(await observation.receipt);
    return [reading.value];
  }

  const values = [];
  for await (const reading of observation) {
    values.push(reading.value);
  }
  requireCompletedObservation(await observation.receipt);
  return values;
}

function recordObserver(nodeIds) {
  return nodeIds.length === 1
    ? thinkWarp.observers.recordOf({ subject: nodeIds[0] })
    : thinkWarp.observers.recordsOf({ subjects: nodeIds });
}

function collectTouchedNodeIds(changes, edges) {
  const ids = new Set(changes.keys());
  for (const edge of edges) {
    ids.add(edge.from);
    ids.add(edge.to);
  }
  return [...ids];
}

function emptyRecordMap(nodeIds) {
  return new Map(nodeIds.map(nodeId => [nodeId, null]));
}

function applyRecordChanges(records, changes) {
  for (const [nodeId, change] of changes) {
    let record = records.get(nodeId) ?? createEmptyThinkRecord();
    record = withThinkRecordProps(record, change.props);
    if (change.text !== undefined) {
      record = withThinkRecordText(record, change.text);
    }
    records.set(nodeId, record);
  }
}

function applyRecordEdges(records, edges) {
  for (const edge of edges) {
    const fromRecord = records.get(edge.from) ?? createEmptyThinkRecord();
    const toRecord = records.get(edge.to) ?? createEmptyThinkRecord();
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
}

function addedNodeIds(changes) {
  return [...changes]
    .filter(([_nodeId, change]) => change.add)
    .map(([nodeId]) => nodeId);
}

async function registerNodes(session, nodeIds) {
  for (const nodeId of nodeIds) {
    // eslint-disable-next-line no-await-in-loop -- v19 admits one Intent per write
    await session.write(thinkWarp.intents.registerNode({ subject: nodeId }));
  }
}

async function writeRecords(session, records) {
  for (const [nodeId, record] of records) {
    // eslint-disable-next-line no-await-in-loop -- v19 admits one Intent per write
    await session.write(thinkWarp.intents.storeRecord({
      subject: nodeId,
      value: stringifyThinkRecord(record),
    }));
  }
}

function catalogAdditionsByShard(records, newNodeIds) {
  const catalogIds = new Set(listThinkCatalogShardIds());
  const additionsByShard = new Map();
  for (const nodeId of newNodeIds.filter(candidate => !catalogIds.has(candidate))) {
    const shardId = thinkCatalogShardId(nodeId);
    const additions = additionsByShard.get(shardId) ?? [];
    additions.push({
      id: nodeId,
      kind: records.get(nodeId)?.props?.kind ?? null,
    });
    additionsByShard.set(shardId, additions);
  }
  return additionsByShard;
}

function applyCatalogAdditions(existing, additions) {
  let record = existing ?? createEmptyThinkRecord();
  for (const entry of additions) {
    record = addThinkCatalogEntry(record, entry);
  }
  return record;
}

function selectTraversalIds(record, direction, label) {
  const edges = direction === 'in' ? record?.incoming ?? [] : record?.outgoing ?? [];
  return edges
    .filter(edge => !label || edge.label === label)
    .map(edge => edge.id);
}

function matchesPattern(value, pattern) {
  const expression = pattern
    .split('*')
    .map(piece => piece.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'))
    .join('.*');
  return new RegExp(`^${expression}$`, 'u').test(value);
}

function matchesFilters(props, filters) {
  return Object.entries(filters).every(([key, value]) => props[key] === value);
}

function requireCompletedObservation(receipt) {
  if (receipt.status !== 'completed') {
    throw new ThinkError(
      `git-warp observation was ${receipt.status}: ${receipt.reason ?? 'unknown reason'}`,
      'GIT_WARP_OBSERVATION_FAILED'
    );
  }
}

function requireAdmittedWrite(receipt) {
  if (receipt.outcome.kind === 'derived' || receipt.outcome.kind === 'plural') {
    return;
  }
  throw new ThinkError(
    `git-warp write was ${receipt.outcome.kind}: ${receipt.reason ?? 'unknown reason'}`,
    'GIT_WARP_WRITE_FAILED'
  );
}

function isRepairableReadFailure(error) {
  return error instanceof Error && (
    error.code === 'E_OBSERVATION_CARDINALITY'
    || error.code === 'E_OPTIC_FAILURE_SCHEMA'
    || error.code === 'E_OPTIC_NO_BOUNDED_BASIS'
    || error.message.includes('missing_bounded_basis')
  );
}

function hasThinkWriterRefs(repoDir) {
  const result = spawnSync(
    GIT_BINARY,
    [
      ...THINK_GIT_CONFIG_ARGS,
      '-C',
      repoDir,
      'for-each-ref',
      '--count=1',
      '--format=%(refname)',
      `refs/warp/${GRAPH_NAME}/writers/`,
    ],
    {
      encoding: 'utf8',
      env: process.env,
    }
  );

  if (result.status !== 0) {
    throw new ThinkError('Could not inspect Think writer refs', 'GIT_WARP_REF_INSPECTION_FAILED');
  }
  return result.stdout.trim().length > 0;
}

async function runMaterializationRepair(repoDir, writerId) {
  try {
    const result = await execFileAsync(
      process.execPath,
      materializationRepairArgs(repoDir, writerId),
      { encoding: 'utf8', env: process.env }
    );
    return result.stdout;
  } catch (error) {
    throw new ThinkError(
      `git-warp materialization repair failed: ${error.stderr || error.message}`,
      'GIT_WARP_MATERIALIZATION_REPAIR_FAILED'
    );
  }
}

function materializationRepairArgs(repoDir, writerId) {
  return [
    gitWarpCli,
    'repair',
    '--repo',
    repoDir,
    '--lane',
    GRAPH_NAME,
    '--writer',
    writerId,
    '--action',
    'materialization',
    '--json',
  ];
}

function sessionCacheKey(repoDir, writerId) {
  return `${repoDir}\0${writerId}`;
}
