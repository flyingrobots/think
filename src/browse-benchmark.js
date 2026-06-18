import WarpApp, { GitGraphAdapter } from '@git-stunts/git-warp';

import { ValidationError } from './errors.js';
import { createThinkPlumbing, ensureGitRepo, hasGitRepo } from './git.js';
import {
  GRAPH_NAME,
  loadBrowseChronologyEntries,
  prepareBrowseBootstrap as loadBrowseBootstrap,
} from './store.js';
import {
  ENTRY_PREFIX,
  GRAPH_META_ID,
  GRAPH_MODEL_VERSION,
  SCHEMA_VERSION,
  SESSION_PREFIX,
  TEXT_MIME,
} from './store/constants.js';
import { encodeTextContent } from './store/content.js';

const DEFAULT_START_TIME_MS = Date.parse('2026-03-20T16:00:00.000Z');
const WITHIN_SESSION_GAP_MS = 30 * 1000;
const BETWEEN_SESSION_GAP_MS = 10 * 60 * 1000;

// eslint-disable-next-line require-await -- wraps store call that returns a promise (git-warp)
export async function prepareBrowseBootstrap(repoDir) {
  if (!hasGitRepo(repoDir)) {
    return Object.freeze({
      ok: false,
      reason: 'repo_missing',
      current: null,
      newer: null,
      older: null,
      sessionContext: null,
      sessionEntries: Object.freeze([]),
      sessionSteps: Object.freeze([]),
    });
  }

  return loadBrowseBootstrap(repoDir);
}

// eslint-disable-next-line require-await -- wraps store call that returns a promise (git-warp)
export async function loadBrowseChronologyEntriesForBenchmark(repoDir) {
  if (!hasGitRepo(repoDir)) {
    return [];
  }

  return loadBrowseChronologyEntries(repoDir);
}

export async function createSyntheticBrowseFixture({
  repoDir,
  captureCount = 100,
  sessionCount = 10,
} = {}) {
  if (!repoDir) {
    throw new ValidationError('repoDir is required');
  }
  if (!Number.isInteger(captureCount) || captureCount <= 0) {
    throw new ValidationError('captureCount must be a positive integer');
  }
  if (!Number.isInteger(sessionCount) || sessionCount <= 0) {
    throw new ValidationError('sessionCount must be a positive integer');
  }
  if (sessionCount > captureCount) {
    throw new ValidationError('sessionCount cannot exceed captureCount');
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
      entry.sessionId = `${SESSION_PREFIX}${sessionStartSortKey}`;
      entries.push(entry);
      createdCaptures += 1;
      currentMs += WITHIN_SESSION_GAP_MS;
    }

    if (countInSession > 0) {
      const sessionId = `${SESSION_PREFIX}${sessionStartSortKey}`;
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
    patch
      .addNode(GRAPH_META_ID)
      .setProperty(GRAPH_META_ID, 'kind', 'graph_meta')
      .setProperty(GRAPH_META_ID, 'createdAt', new Date(DEFAULT_START_TIME_MS).toISOString())
      .setProperty(GRAPH_META_ID, 'updatedAt', new Date(currentMs).toISOString())
      .setProperty(GRAPH_META_ID, 'graphModelVersion', GRAPH_MODEL_VERSION);

    for (const item of entries) {
      if (item.type === 'session') {
        patch
          .addNode(item.id)
          .setProperty(item.id, 'kind', 'session')
          .setProperty(item.id, 'createdAt', item.createdAt)
          .setProperty(item.id, 'sortKey', item.sortKey)
          .setProperty(item.id, 'schemaVersion', SCHEMA_VERSION);
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

      patch.addEdge(item.id, item.sessionId, 'captured_in');

      // eslint-disable-next-line no-await-in-loop -- sequential graph writes within a patch transaction
      await patch.attachContent(item.id, encodeTextContent(item.text), { mime: TEXT_MIME });
    }

    const captures = entries
      .filter((item) => item.type === 'capture')
      .sort((left, right) => right.sortKey.localeCompare(left.sortKey));

    for (let index = 0; index + 1 < captures.length; index += 1) {
      patch.addEdge(captures[index].id, captures[index + 1].id, 'older');
    }
  });

  return Object.freeze({
    captureCount,
    sessionCount,
    startTimeMs: DEFAULT_START_TIME_MS,
    endTimeMs: currentMs,
    withinSessionGapMs: WITHIN_SESSION_GAP_MS,
    betweenSessionGapMs: BETWEEN_SESSION_GAP_MS,
  });
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
    id: `${ENTRY_PREFIX}${sortKey}`,
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

// eslint-disable-next-line require-await -- wraps git-warp WarpApp.open which returns a promise
async function openGraph(repoDir) {
  const plumbing = createThinkPlumbing(repoDir);
  const persistence = new GitGraphAdapter({ plumbing });

  return WarpApp.open({
    persistence,
    graphName: GRAPH_NAME,
    writerId: 'benchmark-fixture',
  });
}
