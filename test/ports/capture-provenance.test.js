import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CaptureProvenance,
  VALID_CAPTURE_INGRESSES,
  captureProvenanceFromEnvironment,
  normalizeCaptureProvenance,
} from '../../src/capture-provenance.js';

test('capture provenance exports the canonical ingress set', () => {
  assert.deepEqual(
    [...VALID_CAPTURE_INGRESSES],
    ['url', 'shortcut', 'selected_text', 'share'],
    'Expected capture provenance to expose the canonical ingress values in one place.'
  );
});

test('capture provenance trims source strings while preserving valid ingress and URL', () => {
  const result = normalizeCaptureProvenance({
    ingress: 'share',
    sourceApp: '  Safari  ',
    sourceURL: 'https://example.com/article',
  });
  assert.equal(result.ingress, 'share');
  assert.equal(result.sourceApp, 'Safari');
  assert.equal(result.sourceURL, 'https://example.com/article');
});

test('capture provenance trims ingress strings before validation', () => {
  const result = normalizeCaptureProvenance({
    ingress: '  url  ',
    sourceApp: '  Safari  ',
    sourceURL: 'https://example.com/article',
  });
  assert.equal(result.ingress, 'url');
  assert.equal(result.sourceApp, 'Safari');
  assert.equal(result.sourceURL, 'https://example.com/article');
});

test('capture provenance rejects dangerous URL schemes', () => {
  for (const dangerous of ['data:text/html,<h1>x</h1>', 'file:///etc/passwd', 'ftp://evil.example.com/payload']) {
    const result = normalizeCaptureProvenance({
      ingress: 'url',
      sourceApp: 'Test',
      sourceURL: dangerous,
    });
    assert.equal(
      result.sourceURL,
      null,
      `Expected "${dangerous}" to be rejected as a provenance URL.`
    );
  }
});

test('capture provenance accepts safe URL schemes', () => {
  for (const safe of ['https://example.com', 'http://localhost:3000']) {
    const result = normalizeCaptureProvenance({
      ingress: 'url',
      sourceApp: 'Test',
      sourceURL: safe,
    });
    assert.ok(
      result.sourceURL !== null,
      `Expected "${safe}" to be accepted as a provenance URL.`
    );
  }
});

test('normalizeCaptureProvenance returns a frozen CaptureProvenance instance', () => {
  const result = normalizeCaptureProvenance({
    ingress: 'url',
    sourceApp: 'Safari',
    sourceURL: 'https://example.com',
  });

  assert.ok(result instanceof CaptureProvenance, 'Expected CaptureProvenance instance.');
  assert.ok(Object.isFrozen(result), 'Expected frozen.');
});

test('capture provenance reads and normalizes environment input', () => {
  const result = captureProvenanceFromEnvironment({
    THINK_CAPTURE_INGRESS: 'selected_text',
    THINK_CAPTURE_SOURCE_APP: '  Mail  ',
    THINK_CAPTURE_SOURCE_URL: 'https://example.com/share',
  });
  assert.ok(result instanceof CaptureProvenance, 'Expected CaptureProvenance from environment.');
  assert.equal(result.ingress, 'selected_text');
  assert.equal(result.sourceApp, 'Mail');
  assert.equal(result.sourceURL, 'https://example.com/share');
});
