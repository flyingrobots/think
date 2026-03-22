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
  const timestamp = new Date();
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

function createWriterId() {
  const hostname = os.hostname().toLowerCase().replace(/[^a-z0-9._-]+/g, '-');
  const safeHostname = hostname || 'unknown-host';
  return `local.${safeHostname}.cli`;
}
