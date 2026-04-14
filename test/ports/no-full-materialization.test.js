import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

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

test('no source file calls getNodes() or getEdges() for full graph materialization', () => {
  const srcDir = new URL('../../src/', import.meta.url).pathname;
  const files = collectJsFiles(srcDir);
  const violations = [];

  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    const relPath = path.relative(path.join(srcDir, '..'), file);

    // Match .getNodes() or .getEdges() but not in comments
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('//') || line.startsWith('*')) { continue; }
      if (/\.getNodes\(\)/.test(line)) {
        violations.push(`${relPath}:${i + 1}: ${line.trim()}`);
      }
      if (/\.getEdges\(\)/.test(line)) {
        violations.push(`${relPath}:${i + 1}: ${line.trim()}`);
      }
    }
  }

  assert.deepEqual(
    violations,
    [],
    `Found ${violations.length} full-materialization anti-pattern(s):\n${violations.join('\n')}`
  );
});
