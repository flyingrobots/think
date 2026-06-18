import {
  getGraphModelStatusForRead,
  openProductReadHandle,
} from '../store/runtime.js';
import {
  getBrowseWindowForRead,
  inspectRawEntryForRead,
  loadBrowseChronologyEntriesForRead,
  prepareBrowseBootstrapForRead,
} from '../store/queries.js';

export function openGitWarpHistoryReadHandle(repoDir) {
  return openProductReadHandle(repoDir);
}

export function getGitWarpHistoryModelStatusForRead(read) {
  return getGraphModelStatusForRead(read);
}

export function getGitWarpHistoryWindowForRead(read, entryId) {
  return getBrowseWindowForRead(read, entryId);
}

export function inspectGitWarpHistoryEntryForRead(read, entryId) {
  return inspectRawEntryForRead(read, entryId);
}

export function loadGitWarpHistoryChronologyEntriesForRead(read) {
  return loadBrowseChronologyEntriesForRead(read);
}

export function prepareGitWarpHistoryBrowseBootstrapForRead(read) {
  return prepareBrowseBootstrapForRead(read);
}
