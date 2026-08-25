import { createHash } from 'node:crypto';

export class ConvertV19MindError extends Error {
  constructor(message, code = 'convert_v19_mind.error') {
    super(message);
    this.name = 'ConvertV19MindError';
    this.code = code;
  }
}

export class InventoryEncodingError extends ConvertV19MindError {
  constructor(message) {
    super(message, 'convert_v19_mind.snapshot_invalid');
    this.name = 'InventoryEncodingError';
  }
}

export function summarizeInventory(inventory) {
  return Object.freeze({
    documentCount: inventory.documents.length,
    edgeCount: inventory.edges.length,
    kinds: Object.freeze(Object.fromEntries(
      [...inventory.byKind]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([kind, entries]) => [kind, entries.length])
    )),
  });
}

export function summarizeProjection(sourceInventory, projectedInventory) {
  return Object.freeze({
    droppedDocumentCount:
      sourceInventory.documents.length - projectedInventory.documents.length,
    droppedEdgeCount: sourceInventory.edges.length - projectedInventory.edges.length,
  });
}

export function requireInventorySummary(value) {
  if (!isInventorySummary(value)) {
    throw new ConvertV19MindError(
      'Inventory contains an invalid summary',
      'convert_v19_mind.snapshot_invalid'
    );
  }
  const kinds = {};
  for (const [kind, count] of Object.entries(value.kinds).sort(compareEntries)) {
    requireInventoryKindCount(kind, count);
    kinds[kind] = count;
  }
  return deepFreeze({
    documentCount: value.documentCount,
    edgeCount: value.edgeCount,
    kinds,
  });
}

function isInventorySummary(value) {
  if (!isRecord(value) || !isRecord(value.kinds)) {
    return false;
  }
  return isNonNegativeInteger(value.documentCount)
    && isNonNegativeInteger(value.edgeCount);
}

function requireInventoryKindCount(kind, count) {
  if (kind.length === 0 || !isNonNegativeInteger(count)) {
    throw new ConvertV19MindError(
      'Inventory contains an invalid kind count',
      'convert_v19_mind.snapshot_invalid'
    );
  }
}

function isNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

function compareEntries([left], [right]) {
  return left.localeCompare(right);
}

export function sampleDocuments(documents) {
  if (documents.length <= 3) {
    return documents;
  }
  return [
    documents[0],
    documents[Math.floor(documents.length / 2)],
    documents.at(-1),
  ];
}

export function chunk(values, size) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(Object.freeze(values.slice(index, index + size)));
  }
  return chunks;
}

export function compareDocumentsOldestFirst(left, right) {
  const leftSort = typeof left.sortKey === 'string' ? left.sortKey : left.id;
  const rightSort = typeof right.sortKey === 'string' ? right.sortKey : right.id;
  return leftSort.localeCompare(rightSort) || left.id.localeCompare(right.id);
}

export function compareEdges(left, right) {
  return left.from.localeCompare(right.from)
    || left.label.localeCompare(right.label)
    || left.to.localeCompare(right.to);
}

export function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isSha256(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
}

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(',')}}`;
  }
  const encoded = JSON.stringify(value);
  if (encoded === undefined) {
    throw new InventoryEncodingError(
      'Inventory contains a value that cannot be encoded'
    );
  }
  return encoded;
}

export function deepFreeze(value) {
  if (!isRecord(value) && !Array.isArray(value)) {
    return value;
  }
  for (const child of Object.values(value)) {
    deepFreeze(child);
  }
  return Object.freeze(value);
}
