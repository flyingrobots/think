import { getPromptMetricsFile } from '../paths.js';
import { KEYWORD_PREFIX } from './constants.js';
import {
  compareEntriesNewestFirst,
  formatBucketKey,
  parseSince,
  createThoughtId,
  getCurrentTime,
} from './model.js';
import {
  buildAmbientRememberMatch,
  buildAmbientRememberScope,
  buildExplicitRememberMatch,
  buildExplicitRememberScope,
  compareRememberMatches,
  finalizeRememberMatches,
  matchesRecentQuery,
} from './remember.js';
import {
  readPromptMetricsRecords,
  summarizePromptMetricBuckets,
  summarizePromptMetrics,
  summarizePromptMetricTimings,
} from './prompt-metrics.js';
import {
  getLatestCaptureId,
  getStoredEntry,
  getChronologyNeighborEntries,
  listIndexedCaptureProps,
  listChronologyEntries,
  listRecentStoredEntries,
  openProductReadHandle,
  resolveHistorySessionTraversal,
  toBrowseEntry,
} from './runtime.js';
import {
  CAPTURE_READ_MODEL_LIMIT,
  readCaptureReadModel,
} from './read-model.js';
import {
  assessReflectability,
  ensureFirstDerivedArtifacts,
  getCanonicalThought,
  getSeedQualityReceipt,
  getSessionAttributionReceipt,
  getSessionAttributionReceiptIfPresent,
  listDirectDerivedReceipts,
} from './derivation.js';
import { KeywordTrie } from './trie.js';

const DEFAULT_RECENT_LIMIT = 50;
const searchIndexCache = new Map();
const searchIndexLoadingPromises = new Map();

export function invalidateSearchIndex(repoDir) {
  searchIndexCache.delete(repoDir);
  searchIndexLoadingPromises.delete(repoDir);
}

/**
 * Bootstrap the in-memory search index (Trie) from keyword nodes in the graph.
 * Uses a loading promise to prevent race conditions during concurrent requests.
 */
export function loadSearchIndex(repoDir) {
  const cached = searchIndexCache.get(repoDir);
  if (cached) {
    return Promise.resolve(cached);
  }

  const loading = searchIndexLoadingPromises.get(repoDir);
  if (loading) {
    return loading;
  }

  const loadingPromise = (async () => {
    const read = await openProductReadHandle(repoDir);
    const trie = new KeywordTrie();

    const keywordResult = await read.view.query().match(`${KEYWORD_PREFIX}*`).where({ kind: 'keyword' }).run();
    for (const node of keywordResult.nodes ?? []) {
      if (node.props.name) {
        trie.insert(node.props.name);
      }
    }

    searchIndexCache.set(repoDir, trie);
    return trie;
  })().finally(() => {
    searchIndexLoadingPromises.delete(repoDir);
  });

  searchIndexLoadingPromises.set(repoDir, loadingPromise);
  return loadingPromise;
}

export async function rememberThoughts(
  repoDir,
  options = {}
) {
  const read = await openProductReadHandle(repoDir);
  return await rememberThoughtsForRead(read, options);
}

export async function rememberThoughtsForRead(
  read,
  {
    cwd = process.cwd(),
    query = null,
    limit = null,
    brief = false,
  } = {}
) {
  const limitValue = limit ?? DEFAULT_RECENT_LIMIT;

  // 1. If there's an explicit query, filter the bounded recent read model.
  if (query && String(query).trim() !== '') {
    const explicitScope = buildExplicitRememberScope(query);
    const indexMatches = new Map();
    const chronologyList = await listRecentStoredEntries(read, { limit: CAPTURE_READ_MODEL_LIMIT });
    for (const entry of chronologyList) {
      const match = buildExplicitRememberMatch({
        ...entry,
        ambientCwd: entry.ambientCwd ?? null,
        ambientGitRoot: entry.ambientGitRoot ?? null,
        ambientGitRemote: entry.ambientGitRemote ?? null,
        ambientGitBranch: entry.ambientGitBranch ?? null,
      }, explicitScope);

      if (match) {
        indexMatches.set(entry.id, match);
      }
    }

    const sortedMatches = Array.from(indexMatches.values()).sort(compareRememberMatches);

    return Object.freeze({
      scope: Object.freeze({ ...explicitScope, brief, limit: limitValue }),
      matches: finalizeRememberMatches(sortedMatches, { brief, limit: limitValue }),
    });
  }

  // 2. Ambient remember (cwd-based)
  const ambientScope = buildAmbientRememberScope(cwd);
  const ambientMatches = [];
  const recentCaptures = await listRecentStoredEntries(read, { limit: CAPTURE_READ_MODEL_LIMIT });
  let topTierMatches = 0;

  for (const entry of recentCaptures) {
    const match = buildAmbientRememberMatch({
      ...entry,
      ambientCwd: entry.ambientCwd ?? null,
      ambientGitRoot: entry.ambientGitRoot ?? null,
      ambientGitRemote: entry.ambientGitRemote ?? null,
      ambientGitBranch: entry.ambientGitBranch ?? null,
    }, ambientScope);

    if (!match) {
      continue;
    }

    ambientMatches.push(match);
    if (match.tier === 3) {
      topTierMatches += 1;
    }

    if (Number.isInteger(limitValue) && topTierMatches >= limitValue) {
      break;
    }
  }

  ambientMatches.sort(compareRememberMatches);

  return Object.freeze({
    scope: Object.freeze({ ...ambientScope, brief, limit: limitValue }),
    matches: finalizeRememberMatches(ambientMatches, { brief, limit: limitValue }),
  });
}

export async function getStats(repoDir, { from, to, since, bucket } = {}) {
  const read = await openProductReadHandle(repoDir);
  return await getStatsForRead(read, { from, to, since, bucket });
}

export async function getStatsForRead(read, { from, to, since, bucket } = {}) {
  const captures = await listIndexedCaptureProps(read, { limit: CAPTURE_READ_MODEL_LIMIT });
  return statsFromCaptures(captures, { from, to, since, bucket });
}

function statsFromCaptures(captures, { from, to, since, bucket } = {}) {
  const entries = [];
  const now = getCurrentTime();
  const sinceDate = since ? parseSince(since, now) : null;
  const fromDate = from ? new Date(from) : null;
  const toDate = to ? new Date(to) : null;

  if (toDate && to.length <= 10) {
    toDate.setUTCHours(23, 59, 59, 999);
  }

  for (const entry of captures) {
    const createdAt = new Date(entry.createdAt);

    if (sinceDate && createdAt < sinceDate) {continue;}
    if (fromDate && createdAt < fromDate) {continue;}
    if (toDate && createdAt > toDate) {continue;}

    entries.push({ createdAt });
  }

  if (!bucket) {
    return Object.freeze({ total: entries.length });
  }

  const buckets = {};
  for (const entry of entries) {
    const key = formatBucketKey(entry.createdAt, bucket);
    buckets[key] = (buckets[key] || 0) + 1;
  }

  return Object.freeze({
    total: entries.length,
    buckets: Object.freeze(
      Object.entries(buckets)
        .sort((a, b) => b[0].localeCompare(a[0]))
        .map(([key, count]) => Object.freeze({ key, count }))
    ),
  });
}

export async function getPromptMetrics({ from, to, since, bucket } = {}) {
  const records = await readPromptMetricsRecords(getPromptMetricsFile());
  const now = getCurrentTime();
  const sinceDate = since ? parseSince(since, now) : null;
  const fromDate = from ? new Date(from) : null;
  const toDate = to ? new Date(to) : null;

  if (toDate && to.length <= 10) {
    toDate.setUTCHours(23, 59, 59, 999);
  }

  const filtered = records.filter((record) => {
    const ts = new Date(record.ts);
    if (Number.isNaN(ts.getTime())) {
      return false;
    }
    if (sinceDate && ts < sinceDate) {return false;}
    if (fromDate && ts < fromDate) {return false;}
    if (toDate && ts > toDate) {return false;}
    return true;
  });

  return {
    summary: summarizePromptMetrics(filtered),
    timings: summarizePromptMetricTimings(filtered),
    buckets: bucket ? summarizePromptMetricBuckets(filtered, bucket, formatBucketKey) : null,
  };
}

export async function listRecent(repoDir, { count = null, query = null } = {}) {
  const limit = count ?? DEFAULT_RECENT_LIMIT;
  const read = await openProductReadHandle(repoDir);
  const index = await readCaptureReadModel(read);

  if (!query) {
    const unfilteredRecent = (await listRecentStoredEntries(read, { limit }))
      .map(toBrowseEntry);
    return Object.freeze({
      entries: unfilteredRecent,
      total: index.totalCaptures,
    });
  }

  const captures = await listRecentStoredEntries(read, { limit: CAPTURE_READ_MODEL_LIMIT });
  const recent = captures
    .map(entry => ({
      id: entry.id,
      text: entry.text,
      sortKey: entry.sortKey,
      createdAt: entry.createdAt,
      sessionId: entry.sessionId ?? null,
    }))
    .sort(compareEntriesNewestFirst);

  const filtered = recent.filter((entry) => matchesRecentQuery(entry.text, query));
  const total = filtered.length;
  const entries = filtered.slice(0, limit);

  return Object.freeze({ entries, total });
}

export async function listReflectableRecent(repoDir) {
  const { entries } = await listRecent(repoDir);
  return entries.filter((entry) => assessReflectability(entry.text).eligible);
}

export async function loadBrowseChronologyEntries(repoDir) {
  const read = await openProductReadHandle(repoDir);
  return loadBrowseChronologyEntriesForRead(read);
}

export async function prepareBrowseBootstrap(repoDir) {
  const read = await openProductReadHandle(repoDir);
  return prepareBrowseBootstrapForRead(read);
}

export async function getBrowseWindow(repoDir, entryId) {
  const read = await openProductReadHandle(repoDir);
  return getBrowseWindowForRead(read, entryId);
}

export async function inspectRawEntry(repoDir, entryId) {
  const read = await openProductReadHandle(repoDir);
  return inspectRawEntryForRead(read, entryId);
}

// eslint-disable-next-line require-await -- wraps git-warp runtime call that returns a promise
export async function loadBrowseChronologyEntriesForRead(read) {
  return listChronologyEntries(read);
}

export async function prepareBrowseBootstrapForRead(read) {
  const latestCaptureId = await getLatestCaptureId(read);
  if (!latestCaptureId) {
    return {
      ok: false,
      reason: 'no_entries',
      current: null,
      newer: null,
      older: null,
      sessionContext: null,
      sessionEntries: [],
      sessionSteps: [],
    };
  }

  const window = await buildBrowseWindow(read, latestCaptureId);
  if (!window) {
    return {
      ok: false,
      reason: 'entry_not_found',
      current: null,
      newer: null,
      older: null,
      sessionContext: null,
      sessionEntries: [],
      sessionSteps: [],
    };
  }

  return {
    ok: true,
    ...window,
  };
}

// eslint-disable-next-line require-await -- wraps git-warp runtime call that returns a promise
export async function getBrowseWindowForRead(read, entryId) {
  return buildBrowseWindow(read, entryId);
}

export async function inspectRawEntryForRead(read, entryId) {
  let entry = await getStoredEntry(read, entryId);

  if (!entry || entry.kind !== 'capture') {
    return null;
  }

  await ensureFirstDerivedArtifacts(read.repoDir, read, entry);
  entry = await getStoredEntry(read, entryId);

  const canonicalThought = await getCanonicalThought(read, entry);
  const seedQuality = await getSeedQualityReceipt(read, entry);
  const sessionAttribution = await getSessionAttributionReceipt(read, entry);
  const derivedReceipts = await listDirectDerivedReceipts(read, entryId);

  const annotations = await listAnnotationsForEntry(read, entryId);

  return Object.freeze({
    entryId: entry.id,
    thoughtId: canonicalThought?.thoughtId ?? createThoughtId(entry.text),
    kind: 'raw_capture',
    text: entry.text,
    sortKey: entry.sortKey,
    createdAt: entry.createdAt,
    captureProvenance: entry.captureProvenance,
    canonicalThought,
    seedQuality,
    sessionAttribution,
    derivedReceipts,
    annotations,
  });
}

async function listAnnotationsForEntry(read, entryId) {
  const traversal = await read.view.query().match(entryId).incoming('annotates').run();
  const annotations = [];

  for (const node of traversal.nodes ?? []) {
    // eslint-disable-next-line no-await-in-loop -- sequential annotation reads
    const entry = await getStoredEntry(read, node.id);
    if (entry) {
      annotations.push(Object.freeze({
        annotationId: entry.id,
        text: entry.text,
        createdAt: entry.createdAt,
      }));
    }
  }

  return annotations.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

async function buildBrowseWindow(read, entryId) {
  const currentEntry = await getStoredEntry(read, entryId);

  if (!currentEntry || currentEntry.kind !== 'capture') {
    return null;
  }

  const sessionAttribution = await getSessionAttributionReceiptIfPresent(read, currentEntry);
  const current = toBrowseEntryWithSession(currentEntry, sessionAttribution?.sessionId ?? null);
  const neighbors = await resolveChronologyNeighbors(read, currentEntry);
  const older = neighbors.older ? toBrowseEntry(neighbors.older) : null;
  const newer = neighbors.newer ? toBrowseEntry(neighbors.newer) : null;
  const sessionTraversal = await resolveHistorySessionTraversal(read, current);

  return Object.freeze({
    current,
    newer,
    older,
    sessionContext: sessionAttribution
      ? {
          entryId,
          sessionId: sessionAttribution.sessionId,
          reasonKind: sessionAttribution.reasonKind,
          reasonText: sessionAttribution.reasonText,
          sessionPosition: sessionTraversal.sessionPosition,
          sessionCount: sessionTraversal.sessionCount,
        }
      : null,
    sessionEntries: sessionTraversal.entries
      .filter((entry) => entry.id !== entryId)
      .sort(compareEntriesNewestFirst),
    sessionSteps: sessionAttribution
      ? [
          ...(sessionTraversal.previous
            ? [{
                direction: 'previous',
                ...sessionTraversal.previous,
                sessionPosition: sessionTraversal.sessionPosition - 1,
              }]
            : []),
          ...(sessionTraversal.next
            ? [{
                direction: 'next',
                ...sessionTraversal.next,
                sessionPosition: sessionTraversal.sessionPosition + 1,
              }]
            : []),
        ]
      : [],
  });
}

function resolveChronologyNeighbors(read, currentEntry) {
  return getChronologyNeighborEntries(read, currentEntry);
}

function toBrowseEntryWithSession(entry, sessionId) {
  const browseEntry = toBrowseEntry(entry);
  if (!sessionId || browseEntry.sessionId) {
    return browseEntry;
  }
  return Object.freeze({
    ...browseEntry,
    sessionId,
  });
}
