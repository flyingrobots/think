import assert from 'node:assert/strict';
import test from 'node:test';

import { listRecentStoredEntries } from '../../src/store/runtime.js';

test('listRecentStoredEntries does not traverse older edges beyond the requested limit', async () => {
  const read = createFakeChronologyRead(['entry:newest', 'entry:middle', 'entry:oldest']);

  const entries = await listRecentStoredEntries(read, { limit: 1 });

  assert.deepEqual(entries.map((entry) => entry.id), ['entry:newest']);
  assert.equal(read.olderLookups, 0, 'Expected limit=1 not to traverse the older chain.');
});

test('listRecentStoredEntries hydrates only the requested sorted capture window', async () => {
  const read = createFakeChronologyRead(['entry:newest', 'entry:middle', 'entry:oldest']);

  const entries = await listRecentStoredEntries(read, { limit: 2 });

  assert.deepEqual(entries.map((entry) => entry.id), ['entry:newest', 'entry:middle']);
  assert.equal(read.olderLookups, 0, 'Expected recent reads to sort capture props without traversing older edges.');
});

function createFakeChronologyRead(ids) {
  const propsById = createFakePropsById(ids);
  const textById = new Map(ids.map((id) => [id, `text for ${id}`]));
  const read = { olderLookups: 0 };

  read.view = createFakeChronologyView(ids, propsById, read);
  read.readContent = (nodeId) => new TextEncoder().encode(textById.get(nodeId) ?? '');
  return read;
}

function createFakePropsById(ids) {
  return new Map(ids.map((id, index) => [id, {
    kind: 'capture',
    writerId: 'writer:test',
    createdAt: new Date(1770000000000 - index).toISOString(),
    sortKey: String(1770000000000 - index),
  }]));
}

function createFakeChronologyView(ids, propsById, read) {
  return {
    query() {
      return createFakeChronologyQuery(ids, propsById, read);
    },
    getNodeProps(nodeId) {
      return propsById.get(nodeId) ?? null;
    },
  };
}

function createFakeChronologyQuery(ids, propsById, read) {
  const state = { nodeId: null, label: null, criteria: null };
  const query = {
    match(nodeId) {
      state.nodeId = nodeId;
      return query;
    },
    where(criteria) {
      state.criteria = criteria;
      return query;
    },
    outgoing(label) {
      state.label = label;
      return query;
    },
    run() {
      return runFakeChronologyQuery(state, ids, propsById, read);
    },
  };
  return query;
}

function runFakeChronologyQuery(state, ids, propsById, read) {
  if (state.criteria?.kind === 'capture') {
    return { nodes: ids.map((id) => ({ id, props: propsById.get(id) })) };
  }

  if (state.label === 'latest_capture') {
    return { nodes: ids.length > 0 ? [{ id: ids[0] }] : [] };
  }

  if (state.label === 'older') {
    read.olderLookups += 1;
    return { nodes: getFakeOlderNode(state.nodeId, ids) };
  }

  return { nodes: [] };
}

function getFakeOlderNode(nodeId, ids) {
  const currentIndex = ids.indexOf(nodeId);
  const olderId = currentIndex === -1 ? null : ids[currentIndex + 1] ?? null;
  return olderId ? [{ id: olderId }] : [];
}
