import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildV19ApplicationRecords,
  parsePrepareArgs,
} from '../../scripts/prepare-v19-mind.mjs';
import { parseReplayArgs } from '../../scripts/replay-v19-capture-on-v18.mjs';
import {
  listThinkCatalogShardIds,
  readThinkCatalogEntries,
} from '../../src/store/v19-record.js';

test('v19 preparation args require an explicit disposable repository and v18 package', () => {
  const args = parsePrepareArgs([
    '--repo',
    '/tmp/mind',
    '--v18-package-root',
    '/tmp/git-warp-v18',
    '--batch-size',
    '17',
    '--dry-run',
    '--json',
  ]);

  assert.deepEqual(args, {
    batchSize: 17,
    dryRun: true,
    help: false,
    json: true,
    repo: '/tmp/mind',
    v18PackageRoot: '/tmp/git-warp-v18',
  });
});

test('mixed-format capture replay args name the source commit explicitly', () => {
  const args = parseReplayArgs([
    '--repo',
    '/tmp/mind',
    '--commit',
    'abc123',
    '--v18-package-root',
    '/tmp/git-warp-v18',
    '--json',
  ]);

  assert.deepEqual(args, {
    commit: 'abc123',
    help: false,
    json: true,
    repo: '/tmp/mind',
    v18PackageRoot: '/tmp/git-warp-v18',
  });
});

test('v19 preparation records preserve props, text, adjacency, and bounded catalog discovery', () => {
  const records = buildV19ApplicationRecords(recordFixture());

  assert.equal(records.get('entry:one').text, 'retained text');
  assert.deepEqual(records.get('entry:one').props, { kind: 'capture', source: 'cli' });
  assert.deepEqual(records.get('entry:one').outgoing, [
    { id: 'thought:one', label: 'distilled_to' },
  ]);
  assert.deepEqual(records.get('thought:one').incoming, [
    { id: 'entry:one', label: 'distilled_to' },
  ]);

  const catalogEntries = listThinkCatalogShardIds()
    .flatMap(shardId => readThinkCatalogEntries(records.get(shardId)));
  assert.deepEqual(
    catalogEntries.sort((left, right) => left.id.localeCompare(right.id)),
    [
      { id: 'entry:one', kind: 'capture' },
      { id: 'thought:one', kind: 'thought' },
    ]
  );
});

function recordFixture() {
  return {
    nodes: [
      {
        id: 'entry:one',
        props: { kind: 'capture', source: 'cli' },
        text: 'retained text',
      },
      {
        id: 'thought:one',
        props: { kind: 'thought' },
        text: 'retained thought',
      },
    ],
    edges: [
      {
        from: 'entry:one',
        label: 'distilled_to',
        to: 'thought:one',
      },
    ],
  };
}
