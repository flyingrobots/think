import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

import {
  buildNativeInventory,
  convertV19Mind,
  createInventorySnapshot,
  mergeSourceInventories,
  parseConvertArgs,
  parseInventorySnapshot,
  projectNativeInventory,
} from '../../scripts/convert-v19-mind.mjs';

const execFileAsync = promisify(execFile);

test('native v19 converter rejects positional repository targets', () => {
  assert.throws(
    () => parseConvertArgs(['/tmp/mind', '--dry-run']),
    /Unknown argument/
  );
});

test('native v19 converter parses explicit repository options', () => {
  assert.deepEqual(
    parseConvertArgs([
      '--source',
      '/tmp/legacy-mind',
      '--inventory-out',
      '/tmp/legacy-mind.inventory.json',
      '--target',
      '/tmp/native-mind',
      '--dry-run',
      '--json',
    ]),
    {
      dryRun: true,
      help: false,
      inventoryIn: null,
      inventoryOut: '/tmp/legacy-mind.inventory.json',
      json: true,
      source: '/tmp/legacy-mind',
      target: '/tmp/native-mind',
    }
  );
});

test('legacy evacuation materializes once without observer property scans', async () => {
  const source = await readFile(
    path.resolve('scripts/convert-v19-mind.mjs'),
    'utf8'
  );

  assert.doesNotMatch(source, /\bcreateManyObserver\b/u);
  assert.doesNotMatch(source, /\breading\.property\b/u);
  assert.doesNotMatch(source, /\.observe\(/u);
  assert.match(source, /V18CheckpointMigrationCodec/u);
  assert.match(source, /return await graph\.materialize\(\)/u);
  assert.match(source, /Reflect\.deleteProperty\(withoutTrie, 'trie'\)/u);
  assert.match(source, /\[\.\.\.state\.nodeAlive\.elements\(\)\]\.sort\(\)/u);
});

test('native inventory preserves domain documents and native outgoing edges', () => {
  const inventory = buildNativeInventory(new Map([
    ['entry:one', legacyRecord({
      props: {
        kind: 'capture',
        createdAt: '2026-07-28T00:00:00.000Z',
        sortKey: '001',
      },
      text: 'retained thought',
      outgoing: [{ id: 'thought:one', label: 'expresses' }],
    })],
    ['thought:one', legacyRecord({
      props: { kind: 'thought' },
    })],
  ]));

  assert.deepEqual(inventory.documents[0], {
    id: 'entry:one',
    kind: 'capture',
    createdAt: '2026-07-28T00:00:00.000Z',
    sortKey: '001',
    text: 'retained thought',
  });
  assert.deepEqual(inventory.edges, [
    { from: 'entry:one', to: 'thought:one', label: 'expresses' },
  ]);
  assert.equal(inventory.byKind.get('capture').length, 1);
  assert.equal(inventory.byKind.get('thought').length, 1);
});

test('native inventory snapshot round-trips with a stable manifest checksum', () => {
  const inventory = buildNativeInventory(new Map([
    ['entry:one', legacyRecord({
      props: {
        kind: 'capture',
        createdAt: '2026-07-28T00:00:00.000Z',
        sortKey: '001',
      },
      text: 'retained thought',
      outgoing: [{ id: 'thought:one', label: 'expresses' }],
    })],
    ['thought:one', legacyRecord({
      props: { kind: 'thought' },
    })],
  ]));
  const snapshot = createInventorySnapshot({
    inventory,
    sourceDir: '/tmp/legacy-mind',
    sourceRefsSha256: 'a'.repeat(64),
  });
  const parsed = parseInventorySnapshot(JSON.stringify(snapshot));

  assert.equal(parsed.snapshot.manifestSha256, snapshot.manifestSha256);
  assert.deepEqual(parsed.snapshot.summary, {
    documentCount: 2,
    edgeCount: 1,
    kinds: {
      capture: 1,
      thought: 1,
    },
  });
  assert.deepEqual(parsed.inventory.documents, inventory.documents);
  assert.deepEqual(parsed.inventory.edges, inventory.edges);
});

test('native inventory snapshot rejects application-data tampering', () => {
  const inventory = buildNativeInventory(new Map([
    ['entry:one', legacyRecord({
      props: { kind: 'capture' },
      text: 'retained thought',
    })],
  ]));
  const snapshot = createInventorySnapshot({
    inventory,
    sourceDir: '/tmp/legacy-mind',
    sourceRefsSha256: 'b'.repeat(64),
  });
  const tampered = structuredClone(snapshot);
  tampered.documents[0].text = 'changed after inventory';

  assert.throws(
    () => parseInventorySnapshot(JSON.stringify(tampered)),
    /checksum does not match/
  );
});

test('native projection retains user records and drops recomputable graph state', () => {
  const projected = projectNativeInventory(projectionSourceInventory());

  assert.deepEqual(
    projected.documents.map(document => document.id),
    ['annotation:one', 'entry:one', 'thought:orphan']
  );
  assert.deepEqual(projected.edges, []);
  assert.equal(projected.byKind.get('capture').length, 1);
  assert.equal(projected.byKind.get('annotation').length, 1);
  assert.equal(projected.byKind.get('thought').length, 1);
});

test('mixed source inventory preserves exact native documents after legacy data', () => {
  const legacy = buildNativeInventory(new Map([
    ['entry:legacy', legacyRecord({
      props: { kind: 'capture', sortKey: '001' },
      text: 'legacy capture',
    })],
  ]));
  const native = Object.freeze({
    id: 'entry:native',
    kind: 'capture',
    sortKey: '002',
    text: 'native capture',
  });

  const merged = mergeSourceInventories(legacy, [native]);

  assert.deepEqual(
    merged.byKind.get('capture').map(document => document.id),
    ['entry:legacy', 'entry:native']
  );
  assert.deepEqual(merged.documents, [legacy.documents[0], native]);
});

test('native inventory imports into and verifies an empty real Git repository', {
  timeout: 60_000,
}, async (context) => {
  const { inventoryPath, targetDir } = await createConversionFixture(context);
  const report = await convertV19Mind({
    dryRun: false,
    inventoryIn: inventoryPath,
    inventoryOut: null,
    source: null,
    target: targetDir,
  });

  assert.equal(report.status, 'converted');
  assert.equal(report.verified, true);
  assert.equal(report.documentCount, 2);
  assert.equal(report.edgeCount, 0);
  assert.equal(report.verification.captureCount, 1);
  assert.ok(report.verification.samples.every(sample => sample.matched));
});

function projectionSourceInventory() {
  return buildNativeInventory(new Map([
    projectionCaptureRecord(),
    ['thought:derived-one', legacyRecord({
      props: { kind: 'thought' },
      text: 'duplicate thought projection',
    })],
    ['thought:orphan', legacyRecord({
      props: { kind: 'thought' },
      text: 'unmatched historical thought',
    })],
    projectionAnnotationRecord(),
    ['artifact:auto-tags', legacyRecord({
      props: { kind: 'auto_tags' },
      outgoing: [{ id: 'thought:derived-one', label: 'derived_from' }],
    })],
    ['read_model:capture:index', legacyRecord({
      props: { kind: 'capture_read_model' },
    })],
    ['classification:idea', legacyRecord({
      props: { kind: 'classification', name: 'idea' },
    })],
    ['meta:graph', legacyRecord({
      props: { kind: 'graph_meta', graphModelVersion: 4 },
    })],
  ]));
}

function projectionCaptureRecord() {
  return ['entry:one', legacyRecord({
    props: {
      kind: 'capture',
      thoughtId: 'thought:derived-one',
    },
    text: 'canonical user capture',
    outgoing: [
      { id: 'thought:derived-one', label: 'expresses' },
      { id: 'annotation:one', label: 'has_annotation' },
      { id: 'annotation:one', label: 'older' },
    ],
  })];
}

function projectionAnnotationRecord() {
  return ['annotation:one', legacyRecord({
    props: {
      kind: 'annotation',
      targetEntryId: 'entry:one',
    },
    text: 'human annotation',
    outgoing: [{ id: 'entry:one', label: 'annotates' }],
  })];
}

async function createConversionFixture(context) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'think-native-converter-'));
  context.after(async () => {
    await rm(root, { recursive: true, force: true });
  });
  const targetDir = path.join(root, 'native-mind');
  const inventoryPath = path.join(root, 'mind.inventory.json');
  await execFileAsync('git', ['init', targetDir]);
  await execFileAsync('git', ['-C', targetDir, 'config', 'user.name', 'think']);
  await execFileAsync(
    'git',
    ['-C', targetDir, 'config', 'user.email', 'think@local.invalid']
  );
  await writeConversionInventory(inventoryPath);
  return { inventoryPath, targetDir };
}

async function writeConversionInventory(inventoryPath) {
  const inventory = buildNativeInventory(new Map([
    ['entry:one', legacyRecord({
      props: {
        kind: 'capture',
        createdAt: '2026-07-28T00:00:00.000Z',
        sortKey: '001',
      },
      text: 'retained thought',
      outgoing: [{ id: 'thought:one', label: 'expresses' }],
    })],
    ['thought:one', legacyRecord({
      props: { kind: 'thought' },
    })],
  ]));
  const snapshot = createInventorySnapshot({
    inventory,
    sourceDir: '/disposable/legacy-mind',
    sourceRefsSha256: 'c'.repeat(64),
  });
  await writeFile(inventoryPath, JSON.stringify(snapshot), 'utf8');
}

function legacyRecord({
  props,
  text = null,
  incoming = [],
  outgoing = [],
}) {
  return Object.freeze({
    props: Object.freeze(props),
    text,
    incoming: Object.freeze(incoming),
    outgoing: Object.freeze(outgoing),
  });
}
