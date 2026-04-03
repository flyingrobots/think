import { getPromptMetricsFile } from '../paths.js';
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
  getSingleNeighborId,
  getStoredEntry,
  listChronologyEntries,
  listEntriesByKind,
  openProductReadHandle,
  resolveGraphSessionTraversal,
  toBrowseEntry,
} from './runtime.js';
import {
  assessReflectability,
  ensureFirstDerivedArtifacts,
  getCanonicalThought,
  getSeedQualityReceipt,
  getSessionAttributionReceipt,
  getSessionAttributionReceiptIfPresent,
  listDirectDerivedReceipts,
} from './derivation.js';

export async function rememberThoughts(
  repoDir,
  {
    cwd = process.cwd(),
    query = null,
    limit = null,
    brief = false,
  } = {}
) {
  const read = await openProductReadHandle(repoDir);
  const captures = (await listEntriesByKind(read, 'capture'))
    .map((entry) => ({
      id: entry.id,
      text: entry.text,
      sortKey: entry.sortKey,
      createdAt: entry.createdAt,
      ambientCwd: entry.ambientCwd ?? null,
      ambientGitRoot: entry.ambientGitRoot ?? null,
      ambientGitRemote: entry.ambientGitRemote ?? null,
      ambientGitBranch: entry.ambientGitBranch ?? null,
    }))
    .sort(compareEntriesNewestFirst);

  if (query && String(query).trim() !== '') {
    const explicitScope = buildExplicitRememberScope(query);
    const explicitMatches = captures
      .map((entry) => buildExplicitRememberMatch(entry, explicitScope))
      .filter(Boolean)
      .sort(compareRememberMatches);
    return {
      scope: {
        ...explicitScope,
        brief,
        limit,
      },
      matches: finalizeRememberMatches(explicitMatches, { brief, limit }),
    };
  }

  const scope = buildAmbientRememberScope(cwd);
  const matches = captures
    .map((entry) => buildAmbientRememberMatch(entry, scope))
    .filter(Boolean)
    .sort(compareRememberMatches);
  return {
    scope: {
      ...scope,
      brief,
      limit,
    },
    matches: finalizeRememberMatches(matches, { brief, limit }),
  };
}

export async function getStats(repoDir, { from, to, since, bucket } = {}) {
  const read = await openProductReadHandle(repoDir);
  const entries = [];

  const now = getCurrentTime();
  const sinceDate = since ? parseSince(since, now) : null;
  const fromDate = from ? new Date(from) : null;
  const toDate = to ? new Date(to) : null;

  if (toDate && to.length <= 10) {
    toDate.setUTCHours(23, 59, 59, 999);
  }

  for (const entry of await listEntriesByKind(read, 'capture')) {
    const createdAt = new Date(entry.createdAt);

    if (sinceDate && createdAt < sinceDate) {continue;}
    if (fromDate && createdAt < fromDate) {continue;}
    if (toDate && createdAt > toDate) {continue;}

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
  const read = await openProductReadHandle(repoDir);
  const captures = await listEntriesByKind(read, 'capture');

  const recent = captures
    .map(entry => ({
      id: entry.id,
      text: entry.text,
      sortKey: entry.sortKey,
      createdAt: entry.createdAt,
      sessionId: entry.sessionId ?? null,
    }))
    .sort(compareEntriesNewestFirst);

  const filtered = query
    ? recent.filter((entry) => matchesRecentQuery(entry.text, query))
    : recent;

  if (count === null) {
    return filtered;
  }

  return filtered.slice(0, count);
}

export async function listReflectableRecent(repoDir) {
  const recent = await listRecent(repoDir);
  return recent.filter((entry) => assessReflectability(entry.text).eligible);
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

  await ensureFirstDerivedArtifacts(read.app, read, entry);
  entry = await getStoredEntry(read, entryId);

  const canonicalThought = await getCanonicalThought(read, entry);
  const seedQuality = await getSeedQualityReceipt(read, entry);
  const sessionAttribution = await getSessionAttributionReceipt(read, entry);
  const derivedReceipts = await listDirectDerivedReceipts(read, entryId);

  return {
    entryId: entry.id,
    thoughtId: canonicalThought?.thoughtId ?? createThoughtId(entry.text),
    kind: 'raw_capture',
    text: entry.text,
    sortKey: entry.sortKey,
    createdAt: entry.createdAt,
    canonicalThought,
    seedQuality,
    sessionAttribution,
    derivedReceipts,
  };
}

async function buildBrowseWindow(read, entryId) {
  const currentEntry = await getStoredEntry(read, entryId);

  if (!currentEntry || currentEntry.kind !== 'capture') {
    return null;
  }

  const current = toBrowseEntry(currentEntry);
  const olderEntryId = await getSingleNeighborId(read, entryId, 'outgoing', 'older');
  const newerEntryId = await getSingleNeighborId(read, entryId, 'incoming', 'older');
  const older = olderEntryId ? toBrowseEntry(await getStoredEntry(read, olderEntryId)) : null;
  const newer = newerEntryId ? toBrowseEntry(await getStoredEntry(read, newerEntryId)) : null;
  const sessionAttribution = await getSessionAttributionReceiptIfPresent(read, currentEntry);
  const sessionTraversal = await resolveGraphSessionTraversal(read, current);

  return {
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
  };
}
