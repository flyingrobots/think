import { randomUUID } from 'node:crypto';
import os from 'node:os';

import Plumbing from '@git-stunts/plumbing';
import { GitGraphAdapter, WarpGraph } from '@git-stunts/git-warp';

export const GRAPH_NAME = 'think';
const ENTRY_PREFIX = 'entry:';
const TEXT_MIME = 'text/plain; charset=utf-8';

export async function captureThought(repoDir, thought) {
  const graph = await openGraph(repoDir);
  const entry = createEntry(thought, graph.writerId);

  await graph.patch(async patch => {
    patch
      .addNode(entry.id)
      .setProperty(entry.id, 'kind', entry.kind)
      .setProperty(entry.id, 'source', entry.source)
      .setProperty(entry.id, 'channel', entry.channel)
      .setProperty(entry.id, 'writerId', entry.writerId)
      .setProperty(entry.id, 'createdAt', entry.createdAt)
      .setProperty(entry.id, 'sortKey', entry.sortKey);

    await patch.attachContent(entry.id, thought, { mime: TEXT_MIME });
  });

  return entry;
}

export async function getStats(repoDir, { from, to, since, bucket } = {}) {
  const graph = await openGraph(repoDir);
  const nodeIds = await graph.getNodes();
  const entries = [];

  const now = getCurrentTime();
  const sinceDate = since ? parseSince(since, now) : null;
  const fromDate = from ? new Date(from) : null;
  const toDate = to ? new Date(to) : null;

  if (toDate) {
    // If it's just a date like 2026-03-21, we want to include the whole day.
    if (to.length <= 10) {
      toDate.setUTCHours(23, 59, 59, 999);
    }
  }

  for (const nodeId of nodeIds) {
    if (!nodeId.startsWith(ENTRY_PREFIX)) {
      continue;
    }

    const props = await graph.getNodeProps(nodeId);
    if (!props || props.kind !== 'capture') {
      continue;
    }

    const createdAt = new Date(props.createdAt);
    
    if (sinceDate && createdAt < sinceDate) continue;
    if (fromDate && createdAt < fromDate) continue;
    if (toDate && createdAt > toDate) continue;

    entries.push({ createdAt });
  }

  if (!bucket) {
    return { total: entries.length };
  }

  const buckets = {};
  for (const entry of entries) {
    const key = formatBucketKey(entry.createdAt, bucket);
    buckets[key] = (buckets[key] || 0) + 1;
  }

  return {
    total: entries.length,
    buckets: Object.entries(buckets)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, count]) => ({ key, count })),
  };
}

export async function listRecent(repoDir) {
  const graph = await openGraph(repoDir);
  const nodeIds = await graph.getNodes();
  const captures = [];

  for (const nodeId of nodeIds) {
    if (!nodeId.startsWith(ENTRY_PREFIX)) {
      continue;
    }

    const props = await graph.getNodeProps(nodeId);
    if (!props || props.kind !== 'capture') {
      continue;
    }

    const content = await graph.getContent(nodeId);
    captures.push({
      id: nodeId,
      text: content ? new TextDecoder().decode(content) : '',
      sortKey: String(props.sortKey || ''),
    });
  }

  captures.sort((left, right) => {
    if (left.sortKey === right.sortKey) {
      return right.id.localeCompare(left.id);
    }

    return right.sortKey.localeCompare(left.sortKey);
  });

  return captures;
}

async function openGraph(repoDir) {
  const plumbing = Plumbing.createDefault({ cwd: repoDir });
  const persistence = new GitGraphAdapter({ plumbing });

  return WarpGraph.open({
    persistence,
    graphName: GRAPH_NAME,
    writerId: createWriterId(),
  });
}

function createEntry(thought, writerId) {
  const timestamp = getCurrentTime();
  const unique = randomUUID();
  const createdAt = timestamp.toISOString();
  const sortKey = `${String(timestamp.getTime()).padStart(13, '0')}-${unique}`;

  return {
    id: `${ENTRY_PREFIX}${sortKey}`,
    kind: 'capture',
    source: 'capture',
    channel: 'cli',
    writerId,
    createdAt,
    sortKey,
    text: thought,
  };
}

function getCurrentTime() {
  if (process.env.THINK_TEST_NOW) {
    const ms = parseInt(process.env.THINK_TEST_NOW, 10);
    if (!isNaN(ms)) {
      return new Date(ms);
    }
  }
  return new Date();
}

function parseSince(since, now) {
  const match = since.match(/^(\d+)([hdw])$/);
  if (!match) return null;

  const value = parseInt(match[1], 10);
  const unit = match[2];

  const ms = {
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
  }[unit];

  return new Date(now.getTime() - value * ms);
}

function formatBucketKey(date, bucket) {
  const iso = date.toISOString();
  if (bucket === 'hour') return iso.substring(0, 13) + ':00';
  if (bucket === 'day') return iso.substring(0, 10);
  if (bucket === 'week') {
    // Basic week bucket (start of week)
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() - d.getUTCDay());
    return d.toISOString().substring(0, 10);
  }
  return iso.substring(0, 10);
}

function createWriterId() {
  const hostname = os.hostname().toLowerCase().replace(/[^a-z0-9._-]+/g, '-');
  const safeHostname = hostname || 'unknown-host';
  return `local.${safeHostname}.cli`;
}
