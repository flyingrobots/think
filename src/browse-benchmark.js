import Plumbing from '@git-stunts/plumbing';
import { GitGraphAdapter, WarpGraph } from '@git-stunts/git-warp';

import { ensureGitRepo, hasGitRepo } from './git.js';
import { GRAPH_NAME, listRecent } from './store.js';

const DEFAULT_START_TIME_MS = Date.parse('2026-03-20T16:00:00.000Z');
const WITHIN_SESSION_GAP_MS = 30 * 1000;
const BETWEEN_SESSION_GAP_MS = 10 * 60 * 1000;
const TEXT_MIME = 'text/plain; charset=utf-8';

export async function prepareBrowseBootstrap(repoDir) {
  if (!hasGitRepo(repoDir)) {
    return {
      ok: false,
      reason: 'repo_missing',
      entryCount: 0,
      initialEntryId: null,
    };
  }

  const entries = await listRecent(repoDir);
  return {
    ok: entries.length > 0,
    reason: entries.length > 0 ? null : 'no_entries',
    entryCount: entries.length,
    initialEntryId: entries[0]?.id ?? null,
  };
}

export async function createSyntheticBrowseFixture({
  repoDir,
  captureCount = 100,
  sessionCount = 10,
} = {}) {
  if (!repoDir) {
    throw new Error('repoDir is required');
  }
  if (!Number.isInteger(captureCount) || captureCount <= 0) {
    throw new Error('captureCount must be a positive integer');
  }
  if (!Number.isInteger(sessionCount) || sessionCount <= 0) {
    throw new Error('sessionCount must be a positive integer');
  }
  if (sessionCount > captureCount) {
    throw new Error('sessionCount cannot exceed captureCount');
  }

  await ensureGitRepo(repoDir);

  const capturesPerSession = distributeCaptures(captureCount, sessionCount);
  let currentMs = DEFAULT_START_TIME_MS;
  let createdCaptures = 0;
  const graph = await openGraph(repoDir);

  const entries = [];
  for (let sessionIndex = 0; sessionIndex < capturesPerSession.length; sessionIndex += 1) {
    const countInSession = capturesPerSession[sessionIndex];
    const sessionStartMs = currentMs;
    let sessionStartSortKey = null;

    for (let captureIndex = 0; captureIndex < countInSession; captureIndex += 1) {
      const thoughtNumber = createdCaptures + 1;
      const entry = createSyntheticEntry({
        thoughtNumber,
        sessionNumber: sessionIndex + 1,
        captureNumberInSession: captureIndex + 1,
        timestampMs: currentMs,
      });
      sessionStartSortKey ??= entry.sortKey;
      entry.sessionId = `session:${sessionStartSortKey}`;
      entries.push(entry);
      createdCaptures += 1;
      currentMs += WITHIN_SESSION_GAP_MS;
    }

    if (countInSession > 0) {
      const sessionId = `session:${sessionStartSortKey}`;
      entries.push({
        type: 'session',
        id: sessionId,
        createdAt: new Date(sessionStartMs).toISOString(),
        sortKey: sessionStartSortKey,
      });
    }

    if (sessionIndex + 1 < capturesPerSession.length) {
      currentMs += BETWEEN_SESSION_GAP_MS;
    }
  }

  await graph.patch(async (patch) => {
    for (const item of entries) {
      if (item.type === 'session') {
        patch
          .addNode(item.id)
          .setProperty(item.id, 'kind', 'session')
          .setProperty(item.id, 'createdAt', item.createdAt)
          .setProperty(item.id, 'sortKey', item.sortKey)
          .setProperty(item.id, 'schemaVersion', '1');
        continue;
      }

      patch
        .addNode(item.id)
        .setProperty(item.id, 'kind', 'capture')
        .setProperty(item.id, 'source', 'benchmark')
        .setProperty(item.id, 'channel', 'benchmark')
        .setProperty(item.id, 'writerId', graph.writerId)
        .setProperty(item.id, 'createdAt', item.createdAt)
        .setProperty(item.id, 'sortKey', item.sortKey)
        .setProperty(item.id, 'sessionId', item.sessionId);

      await patch.attachContent(item.id, item.text, { mime: TEXT_MIME });
    }
  });

  return {
    captureCount,
    sessionCount,
    startTimeMs: DEFAULT_START_TIME_MS,
    endTimeMs: currentMs,
    withinSessionGapMs: WITHIN_SESSION_GAP_MS,
    betweenSessionGapMs: BETWEEN_SESSION_GAP_MS,
  };
}

function distributeCaptures(captureCount, sessionCount) {
  const base = Math.floor(captureCount / sessionCount);
  const remainder = captureCount % sessionCount;

  return Array.from({ length: sessionCount }, (_, index) => base + (index < remainder ? 1 : 0));
}

function createSyntheticThought({ thoughtNumber, sessionNumber, captureNumberInSession }) {
  return [
    `Benchmark thought ${thoughtNumber}.`,
    `Session ${sessionNumber}, capture ${captureNumberInSession}.`,
    `Browse startup should stay honest about graph reads, session context, and inspect receipts.`,
  ].join(' ');
}

function createSyntheticEntry({ thoughtNumber, sessionNumber, captureNumberInSession, timestampMs }) {
  const createdAt = new Date(timestampMs).toISOString();
  const suffix = String(thoughtNumber).padStart(4, '0');
  const sortKey = `${String(timestampMs).padStart(13, '0')}-bench-${suffix}`;

  return {
    type: 'capture',
    id: `entry:${sortKey}`,
    createdAt,
    sortKey,
    text: createSyntheticThought({
      thoughtNumber,
      sessionNumber,
      captureNumberInSession,
    }),
    sessionId: null,
  };
}

async function openGraph(repoDir) {
  const plumbing = Plumbing.createDefault({ cwd: repoDir });
  const persistence = new GitGraphAdapter({ plumbing });

  return WarpGraph.open({
    persistence,
    graphName: GRAPH_NAME,
    writerId: 'benchmark-fixture',
  });
}
