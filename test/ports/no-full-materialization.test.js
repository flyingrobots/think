import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const FORBIDDEN_RUNTIME_PATTERNS = Object.freeze([
  ['full node materialization', /\.getNodes\(\)/u],
  ['full edge materialization', /\.getEdges\(\)/u],
  ['wildcard query facade', /\.query\(\)\s*\.match\(/u],
  ['legacy Think record key', /think\.record\.v1/u],
  ['private git-warp distribution import', /@git-stunts\/git-warp\/dist\//u],
]);

test('production source contains no legacy graph facade or full materialization path', () => {
  const srcDir = new URL('../../src/', import.meta.url).pathname;
  const violations = [];
  for (const file of collectJsFiles(srcDir)) {
    const content = readFileSync(file, 'utf8');
    const relative = path.relative(srcDir, file);
    for (const [name, pattern] of FORBIDDEN_RUNTIME_PATTERNS) {
      if (pattern.test(withoutComments(content))) {
        violations.push(`${relative}: ${name}`);
      }
    }
  }
  assert.deepEqual(violations, []);
});

test('rejected compatibility modules are absent', () => {
  const storeDir = new URL('../../src/store/', import.meta.url).pathname;
  const files = new Set(readdirSync(storeDir));
  assert.equal(files.has('git-warp-v19.js'), false);
  assert.equal(files.has('think-warp-sdk.js'), false);
  assert.equal(files.has('v19-record.js'), false);
  assert.equal(files.has('read-model.js'), false);
});

function collectJsFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...collectJsFiles(full));
    } else if (entry.endsWith('.js')) {
      files.push(full);
    }
  }
  return files;
}

function withoutComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//gu, '')
    .replace(/^\s*\/\/.*$/gmu, '');
}
