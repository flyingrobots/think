export function canonicalizeJsonValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalizeJsonValue(item));
  }

  if (isPlainObject(value)) {
    const sorted = {};
    for (const key of Object.keys(value).sort()) {
      sorted[key] = canonicalizeJsonValue(value[key]);
    }
    return sorted;
  }

  return value;
}

export function stringifyJson(value) {
  return JSON.stringify(canonicalizeJsonValue(value));
}

export function parseJson(text) {
  return canonicalizeJsonValue(JSON.parse(text));
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype;
}
