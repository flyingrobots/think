import { ValidationError } from '../errors.js';

export const MEMORY_DOCUMENT_KEY = 'think.memory-document.v1';
export const INDEX_DOCUMENT_KEY = 'think.memory-index.v1';
export const INDEX_PAGE_DOCUMENT_KEY = 'think.memory-index-page.v1';

const DOCUMENT_VERSION = 1;
const decoder = new TextDecoder('utf-8', { fatal: true });
const encoder = new TextEncoder();

export function encodeNativeDocument(kind, value) {
  if (!isRecord(value)) {
    throw new ValidationError(`Native ${kind} document must be an object`);
  }
  return encoder.encode(JSON.stringify({
    version: DOCUMENT_VERSION,
    kind,
    value,
  }));
}

export function decodeNativeDocument(bytes, expectedKind) {
  if (!(bytes instanceof Uint8Array)) {
    return null;
  }
  try {
    const envelope = JSON.parse(decoder.decode(bytes));
    if (
      !isRecord(envelope)
      || envelope.version !== DOCUMENT_VERSION
      || envelope.kind !== expectedKind
      || !isRecord(envelope.value)
    ) {
      return null;
    }
    return Object.freeze(envelope.value);
  } catch {
    return null;
  }
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
