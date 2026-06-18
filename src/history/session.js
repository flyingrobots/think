import { SESSION_IDLE_GAP_MS } from '../store/constants.js';
import { compareEntriesOldestFirst } from '../store/model.js';

export function resolveHistorySessionEntries(entries, entry) {
  if (!entry) {
    return [];
  }

  const entriesById = new Map();

  for (const candidate of resolveTemporalSessionEntries(entries, entry)) {
    entriesById.set(candidate.id, candidate);
  }

  if (entry.sessionId) {
    for (const candidate of entries) {
      if (candidate.sessionId === entry.sessionId) {
        entriesById.set(candidate.id, candidate);
      }
    }
  }

  return [...entriesById.values()].sort(compareEntriesOldestFirst);
}

function resolveTemporalSessionEntries(entries, entry) {
  const sortedEntries = [...entries].sort(compareEntriesOldestFirst);
  let currentSession = [];

  for (const candidate of sortedEntries) {
    const previous = currentSession.at(-1) ?? null;
    if (previous && !isWithinIdleGap(previous, candidate)) {
      const session = currentSession;
      if (session.some((sessionEntry) => sessionEntry.id === entry.id)) {
        return session;
      }
      currentSession = [];
    }

    currentSession.push(candidate);
  }

  return currentSession.some((candidate) => candidate.id === entry.id)
    ? currentSession
    : [];
}

function isWithinIdleGap(previous, next) {
  const gapMs = Date.parse(next.createdAt) - Date.parse(previous.createdAt);
  return Number.isFinite(gapMs) && gapMs >= 0 && gapMs <= SESSION_IDLE_GAP_MS;
}
