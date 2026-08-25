import {
  decodeNativeDocument,
  INDEX_DOCUMENT_KEY,
  INDEX_PAGE_DOCUMENT_KEY,
  MEMORY_DOCUMENT_KEY,
} from '../src/store/native-document.js';
import {
  ConvertV19MindError,
  deepFreeze,
  isRecord,
  stableStringify,
} from './convert-v19-mind-support.mjs';

const NATIVE_SOURCE_PROPERTY_KINDS = Object.freeze([
  [MEMORY_DOCUMENT_KEY, 'memory-object'],
  [INDEX_DOCUMENT_KEY, 'memory-index'],
  [INDEX_PAGE_DOCUMENT_KEY, 'memory-index-page'],
]);

export function collectNativeSourceProperties(state, modules, liveNodeIds) {
  const liveNodeIdSet = new Set(liveNodeIds);
  const nativeNodeIds = new Set();
  const documents = [];
  const invalidNodeIds = [];
  for (const [encodedKey, register] of state.prop) {
    const decodedKey = decodeNativeSourceKey(encodedKey, modules);
    if (!decodedKey || !liveNodeIdSet.has(decodedKey.nodeId)) {
      continue;
    }
    const decoded = decodeNativeSourceValue(register.value, decodedKey.kind);
    if (decoded === null) {
      invalidNodeIds.push(decodedKey.nodeId);
      continue;
    }
    nativeNodeIds.add(decodedKey.nodeId);
    documents.push(...documentsFromNativeProperty(decodedKey, decoded));
  }
  return Object.freeze({ documents, invalidNodeIds, nativeNodeIds });
}

function decodeNativeSourceKey(encodedKey, modules) {
  if (modules.isEdgePropKey(encodedKey)) {
    return null;
  }
  const { nodeId, propKey } = modules.decodePropKey(encodedKey);
  const kind = NATIVE_SOURCE_PROPERTY_KINDS
    .find(([key]) => key === propKey)?.[1] ?? null;
  return kind === null ? null : Object.freeze({ kind, nodeId });
}

function decodeNativeSourceValue(value, kind) {
  const bytes = value instanceof Uint8Array
    ? value
    : value?.toUint8Array?.();
  return decodeNativeDocument(bytes, kind);
}

function documentsFromNativeProperty({ kind, nodeId }, value) {
  if (kind === 'memory-index-page') {
    return Array.isArray(value.entries)
      ? value.entries.map(requireNativeSourceDocument)
      : [];
  }
  if (kind !== 'memory-object') {
    return [];
  }
  const document = requireNativeSourceDocument(value);
  requireNativeDocumentSubject(document, nodeId);
  return [document];
}

function requireNativeSourceDocument(value) {
  if (!isRecord(value) || typeof value.id !== 'string' || value.id.length === 0) {
    throw new ConvertV19MindError(
      'Native source contains an invalid document',
      'convert_v19_mind.native_source_invalid'
    );
  }
  return deepFreeze({ ...value });
}

function requireNativeDocumentSubject(document, nodeId) {
  if (document.id !== nodeId) {
    throw new ConvertV19MindError(
      `Native source document ${document.id} does not match subject ${nodeId}`,
      'convert_v19_mind.native_source_invalid'
    );
  }
}

export function requireCompleteSourceRecords(legacy, native, liveNodeIds) {
  requireValidLegacyRecords(legacy.invalidRecordIds);
  requireValidNativeProperties(native.invalidNodeIds);
  const covered = coveredSourceNodeIds(legacy.records, native);
  const firstMissing = liveNodeIds.find(id => !covered.has(id)) ?? null;
  if (firstMissing !== null) {
    throw new ConvertV19MindError(
      `Think materialized ${liveNodeIds.length} live nodes but source records do not cover ${firstMissing}`,
      'convert_v19_mind.record_missing'
    );
  }
}

function requireValidLegacyRecords(invalidRecordIds) {
  if (invalidRecordIds.length > 0) {
    throw new ConvertV19MindError(
      `Legacy Think contains ${invalidRecordIds.length} invalid live records; first: ${invalidRecordIds[0]}`,
      'convert_v19_mind.record_invalid'
    );
  }
}

function requireValidNativeProperties(invalidNodeIds) {
  if (invalidNodeIds.length > 0) {
    throw new ConvertV19MindError(
      `Native Think contains ${invalidNodeIds.length} invalid live properties; first: ${invalidNodeIds[0]}`,
      'convert_v19_mind.native_source_invalid'
    );
  }
}

function coveredSourceNodeIds(records, native) {
  return new Set([
    ...records.keys(),
    ...native.nativeNodeIds,
    ...native.documents.map(document => document.id),
  ]);
}

export function mergeNativeSourceDocuments(legacyDocuments, nativeDocuments) {
  const documents = new Map(
    legacyDocuments.map(document => [document.id, document])
  );
  for (const document of nativeDocuments) {
    requireCompatibleDocument(documents.get(document.id), document);
    documents.set(document.id, document);
  }
  return [...documents.values()];
}

function requireCompatibleDocument(existing, document) {
  if (existing && stableStringify(existing) !== stableStringify(document)) {
    throw new ConvertV19MindError(
      `Legacy and native source documents conflict for ${document.id}`,
      'convert_v19_mind.source_conflict'
    );
  }
}
