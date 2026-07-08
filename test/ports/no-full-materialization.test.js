import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { stringifyJson } from '../../src/json.js';
import { CAPTURE_READ_MODEL_ID } from '../../src/store/constants.js';
import { rememberThoughtsForRead } from '../../src/store/queries.js';
import { ambientReadModelId } from '../../src/store/read-model.js';

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

test('default ambient remember reads bounded manifests instead of graph queries', async () => {
  const cwd = '/tmp/think-alpha-project';
  const matching = capture('entry:1780000002000-alpha', 'alpha project should stay fast', {
    ambientCwd: cwd,
  });
  const other = capture('entry:1780000001000-beta', 'lunch note should not rank', {
    ambientCwd: '/tmp/think-beta-project',
  });
  const read = createBoundedRead([matching, other], { ambientIndexes: [{ key: 'ambientCwd', value: cwd, entries: [matching] }] });

  const remembered = await rememberThoughtsForRead(read, { cwd, limit: 5 });

  assert.deepEqual(
    remembered.matches.map((match) => match.entryId),
    [matching.id],
    'Expected ambient remember to exact-read the ambient read model and avoid graph-wide capture scans.'
  );
  assert.equal(read.queryCalls, 0, 'Expected default ambient remember not to call read.view.query().');
});

test('explicit remember filters bounded recent refs instead of bootstrapping keyword scans', async () => {
  const matching = capture('entry:1780000002000-warp', 'warp receipts need a bounded recall path');
  const other = capture('entry:1780000001000-lunch', 'lunch notes are unrelated');
  const read = createBoundedRead([matching, other]);

  const remembered = await rememberThoughtsForRead(read, { query: 'warp receipts', limit: 5 });

  assert.deepEqual(
    remembered.matches.map((match) => match.entryId),
    [matching.id],
    'Expected explicit remember to search the bounded recent read model without a keyword:* scan.'
  );
  assert.equal(read.queryCalls, 0, 'Expected explicit remember not to call read.view.query().');
});

function capture(id, text, props = {}) {
  return Object.freeze({
    id,
    text,
    props: Object.freeze({
      kind: 'capture',
      writerId: 'test',
      createdAt: new Date(Number(id.split(':')[1].split('-')[0])).toISOString(),
      sortKey: id.slice('entry:'.length),
      ...props,
    }),
  });
}

function createBoundedRead(entries, { ambientIndexes = [] } = {}) {
  const propsById = new Map(entries.map((entry) => [entry.id, entry.props]));
  const textById = new Map(entries.map((entry) => [entry.id, entry.text]));
  const read = { queryCalls: 0, repoDir: '/tmp/think-bounded-read' };

  read.view = {
    getNodeProps(nodeId) {
      if (nodeId === CAPTURE_READ_MODEL_ID) {
        return readModelProps(entries);
      }

      for (const index of ambientIndexes) {
        if (nodeId === ambientReadModelId(index.key, index.value)) {
          return ambientReadModelProps(index);
        }
      }

      return propsById.get(nodeId) ?? null;
    },
    query() {
      read.queryCalls += 1;
      throw new Error('Expected bounded recall to avoid read.view.query().');
    },
  };
  read.readContent = (nodeId) => new TextEncoder().encode(textById.get(nodeId) ?? '');
  return read;
}

function readModelProps(entries) {
  return {
    kind: 'capture_read_model',
    latestCaptureId: entries[0]?.id ?? null,
    totalCaptures: entries.length,
    recentCaptureRefsJson: stringifyJson(entries.map(entryRef)),
  };
}

function ambientReadModelProps(index) {
  return {
    kind: 'ambient_capture_read_model',
    ambientKey: index.key,
    ambientValue: index.value,
    recentCaptureRefsJson: stringifyJson(index.entries.map(entryRef)),
  };
}

function entryRef(entry) {
  return {
    id: entry.id,
    createdAt: entry.props.createdAt,
    sortKey: entry.props.sortKey,
  };
}
