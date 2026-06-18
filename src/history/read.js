import {
  getGitWarpHistoryModelStatusForRead,
  getGitWarpHistoryWindowForRead,
  inspectGitWarpHistoryEntryForRead,
  loadGitWarpHistoryChronologyEntriesForRead,
  openGitWarpHistoryReadHandle,
  prepareGitWarpHistoryBrowseBootstrapForRead,
} from './git-warp-read.js';

export function openHistoryReadHandle(repoDir) {
  return openGitWarpHistoryReadHandle(repoDir);
}

export function getHistoryModelStatusForRead(read) {
  return getGitWarpHistoryModelStatusForRead(read);
}

export function getHistoryWindowForRead(read, entryId) {
  return getGitWarpHistoryWindowForRead(read, entryId);
}

export function inspectHistoryEntryForRead(read, entryId) {
  return inspectGitWarpHistoryEntryForRead(read, entryId);
}

export function loadHistoryChronologyEntriesForRead(read) {
  return loadGitWarpHistoryChronologyEntriesForRead(read);
}

export function prepareHistoryBrowseBootstrapForRead(read) {
  return prepareGitWarpHistoryBrowseBootstrapForRead(read);
}
