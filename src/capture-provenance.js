export const VALID_CAPTURE_INGRESSES = new Set([
  'url',
  'shortcut',
  'selected_text',
  'share',
]);

export function captureProvenanceFromEnvironment(environment = process.env) {
  return normalizeCaptureProvenance({
    ingress: environment.THINK_CAPTURE_INGRESS,
    sourceApp: environment.THINK_CAPTURE_SOURCE_APP,
    sourceURL: environment.THINK_CAPTURE_SOURCE_URL,
  });
}

export class CaptureProvenance {
  constructor(ingress, sourceApp, sourceURL) {
    this.ingress = ingress;
    this.sourceApp = sourceApp;
    this.sourceURL = sourceURL;
    Object.freeze(this);
  }
}

export function normalizeCaptureProvenance(provenance) {
  if (!provenance || typeof provenance !== 'object') {
    return null;
  }

  const ingress = normalizeIngress(provenance.ingress);
  const sourceApp = normalizeString(provenance.sourceApp);
  const sourceURL = normalizeUrl(provenance.sourceURL);

  if (!ingress && !sourceApp && !sourceURL) {
    return null;
  }

  return new CaptureProvenance(ingress, sourceApp, sourceURL);
}

function normalizeIngress(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return VALID_CAPTURE_INGRESSES.has(trimmed) ? trimmed : null;
}

function normalizeString(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

const SAFE_URL_SCHEMES = new Set(['http:', 'https:']);

function normalizeUrl(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    return null;
  }

  try {
    const parsed = new URL(value);
    if (!SAFE_URL_SCHEMES.has(parsed.protocol)) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}
