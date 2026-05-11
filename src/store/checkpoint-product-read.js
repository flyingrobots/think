import { openCheckpointStateRead } from './checkpoint-state.js';

const DEFAULT_PATTERN = '*';
const DEFAULT_MAX_DEPTH = 1000;

class CheckpointProductQuery {
  constructor({ reader, stateHash }) {
    this._reader = reader;
    this._stateHash = stateHash;
    this._pattern = DEFAULT_PATTERN;
    this._operations = [];
  }

  match(pattern) {
    this._pattern = pattern;
    return this;
  }

  where(criteria) {
    this._operations.push({ type: 'where', criteria });
    return this;
  }

  incoming(label) {
    this._operations.push({ type: 'incoming', label });
    return this;
  }

  outgoing(label) {
    this._operations.push({ type: 'outgoing', label });
    return this;
  }

  async run() {
    let strand = this._matchingNodeIds(this._pattern);
    for (const operation of this._operations) {
      if (operation.type === 'where') {
        strand = this._applyWhere(strand, operation.criteria);
        continue;
      }
      strand = this._applyNeighborHop(strand, operation.type, operation.label);
    }

    return Object.freeze({
      stateHash: this._stateHash,
      nodes: Object.freeze(await Promise.all(strand.map(async (id) => Object.freeze({
        id,
        props: Object.freeze(await this._reader.getNodeProps(id) ?? {}),
      })))),
    });
  }

  _matchingNodeIds(pattern) {
    if (isSingleExactPattern(pattern)) {
      return this._reader.hasNode(pattern) ? [pattern] : [];
    }
    return this._reader.project().nodes
      .filter((nodeId) => matchesPattern(pattern, nodeId))
      .sort(compareStrings);
  }

  _applyWhere(strand, criteria) {
    if (typeof criteria === 'function') {
      return this._applyPredicateWhere(strand, criteria);
    }
    if (!isPlainWhereObject(criteria)) {
      throw new TypeError('checkpoint product query where() expects an object or predicate');
    }

    const filtered = [];
    for (const nodeId of strand) {
      const props = this._reader.getNodeProps(nodeId);
      if (propsMatch(props ?? {}, criteria)) {
        filtered.push(nodeId);
      }
    }
    return filtered.sort(compareStrings);
  }

  _applyPredicateWhere(strand, predicate) {
    const filtered = [];
    for (const nodeId of strand) {
      const snapshot = this._nodeSnapshot(nodeId);
      if (predicate(snapshot)) {
        filtered.push(nodeId);
      }
    }
    return filtered.sort(compareStrings);
  }

  _nodeSnapshot(nodeId) {
    const [props, edgesOut, edgesIn] = [
      this._reader.getNodeProps(nodeId),
      this._neighborEdges(nodeId, 'outgoing'),
      this._neighborEdges(nodeId, 'incoming'),
    ];
    return Object.freeze({
      id: nodeId,
      props: Object.freeze(props ?? {}),
      edgesOut,
      edgesIn,
    });
  }

  _neighborEdges(nodeId, direction) {
    return Object.freeze(this._reader.neighbors(nodeId, direction).map((entry) => Object.freeze(
      direction === 'outgoing'
        ? { label: entry.label, to: entry.nodeId }
        : { label: entry.label, from: entry.nodeId },
    )));
  }

  _applyNeighborHop(strand, direction, label) {
    const next = new Set();
    for (const nodeId of strand) {
      for (const neighbor of this._reader.neighbors(nodeId, direction, label)) {
        next.add(neighbor.nodeId);
      }
    }
    return [...next].sort(compareStrings);
  }
}

class CheckpointProductTraversal {
  constructor(reader) {
    this._reader = reader;
    Object.freeze(this);
  }

  bfs(start, options = {}) {
    if (!this._reader.hasNode(start)) {
      throw new Error(`Start node not found: ${start}`);
    }

    const direction = normalizeTraversalDirection(options.dir);
    const labels = normalizeLabelFilter(options.labelFilter);
    const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
    const visited = new Set();
    let currentLevel = [{ nodeId: start, depth: 0 }];
    const result = [];

    while (currentLevel.length > 0) {
      currentLevel.sort((left, right) => compareStrings(left.nodeId, right.nodeId));
      const nextLevel = [];
      const queued = new Set();

      for (const { nodeId, depth } of currentLevel) {
        if (visited.has(nodeId) || depth > maxDepth) {
          continue;
        }

        visited.add(nodeId);
        result.push(nodeId);

        if (depth >= maxDepth) {
          continue;
        }

        for (const neighbor of this._neighbors(nodeId, direction, labels)) {
          if (!visited.has(neighbor.nodeId) && !queued.has(neighbor.nodeId)) {
            queued.add(neighbor.nodeId);
            nextLevel.push({ nodeId: neighbor.nodeId, depth: depth + 1 });
          }
        }
      }

      currentLevel = nextLevel;
    }

    return result;
  }

  _neighbors(nodeId, direction, labels) {
    if (direction === 'both') {
      return sortNeighbors(dedupeNeighbors([
        ...this._reader.neighbors(nodeId, 'outgoing'),
        ...this._reader.neighbors(nodeId, 'incoming'),
      ])).filter((neighbor) => labelMatches(neighbor.label, labels));
    }
    return sortNeighbors(this._reader.neighbors(nodeId, direction))
      .filter((neighbor) => labelMatches(neighbor.label, labels));
  }
}

class CheckpointProductView {
  constructor({ reader, stateHash }) {
    this._reader = reader;
    this._stateHash = stateHash;
    this.traverse = new CheckpointProductTraversal(reader);
    Object.freeze(this);
  }

  hasNode(nodeId) {
    return this._reader.hasNode(nodeId);
  }

  getNodeProps(nodeId) {
    return this._reader.getNodeProps(nodeId);
  }

  getNodeContentMeta(nodeId) {
    return this._reader.getNodeContentMeta(nodeId);
  }

  query() {
    return new CheckpointProductQuery({
      reader: this._reader,
      stateHash: this._stateHash,
    });
  }
}

export async function openCheckpointProductRead(repoDir, app = null) {
  const checkpoint = await openCheckpointStateRead(repoDir, app);
  if (checkpoint === null) {
    return null;
  }

  return Object.freeze({
    blobStorage: checkpoint.blobStorage,
    view: new CheckpointProductView({
      reader: checkpoint.reader,
      stateHash: checkpoint.checkpointSha,
    }),
  });
}

function isSingleExactPattern(pattern) {
  return typeof pattern === 'string' && !pattern.includes('*');
}

function matchesPattern(pattern, nodeId) {
  if (typeof pattern === 'string') {
    return matchGlob(pattern, nodeId);
  }
  return pattern.some((entry) => matchGlob(entry, nodeId));
}

function matchGlob(pattern, value) {
  return globToRegExp(pattern).test(value);
}

function globToRegExp(pattern) {
  return new RegExp(`^${String(pattern).split('*').map(escapeRegExp).join('.*')}$`);
}

function escapeRegExp(value) {
  return value.replace(/[\\^$+?.()|[\]{}]/g, '\\$&');
}

function isPlainWhereObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function propsMatch(props, criteria) {
  for (const [key, value] of Object.entries(criteria)) {
    if (props[key] !== value) {
      return false;
    }
  }
  return true;
}

function compareStrings(left, right) {
  if (left < right) { return -1; }
  if (left > right) { return 1; }
  return 0;
}

function normalizeTraversalDirection(direction = 'out') {
  if (direction === 'out' || direction === 'outgoing') {
    return 'outgoing';
  }
  if (direction === 'in' || direction === 'incoming') {
    return 'incoming';
  }
  if (direction === 'both') {
    return 'both';
  }
  throw new Error(`Unsupported traversal direction: ${direction}`);
}

function normalizeLabelFilter(labelFilter) {
  if (labelFilter === undefined || labelFilter === null) {
    return null;
  }
  return new Set(Array.isArray(labelFilter) ? labelFilter : [labelFilter]);
}

function labelMatches(label, labels) {
  return labels === null || labels.has(label);
}

function sortNeighbors(neighbors) {
  return [...neighbors].sort((left, right) => {
    const nodeComparison = compareStrings(left.nodeId, right.nodeId);
    if (nodeComparison !== 0) {
      return nodeComparison;
    }
    return compareStrings(left.label, right.label);
  });
}

function dedupeNeighbors(neighbors) {
  const seen = new Set();
  const deduped = [];
  for (const neighbor of neighbors) {
    const key = `${neighbor.nodeId}\0${neighbor.label}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(neighbor);
    }
  }
  return deduped;
}
