import { createBrowseInitialView } from '../port.js';

const BROWSE_STATUS_BY_HISTORY_REASON = Object.freeze({
  entry_not_found: 'empty',
  graph_migration_required: 'migration_required',
  migration_required: 'migration_required',
  no_entries: 'empty',
  repo_missing: 'repo_missing',
});

const HISTORY_VIEW_READERS = Object.freeze({
  false: (historyWindow, mindName) => createBrowseInitialView({
    status: BROWSE_STATUS_BY_HISTORY_REASON[historyWindow?.reason] ?? 'error',
    mindName,
    message: historyWindow?.message,
    reason: historyWindow?.reason,
    graphStatus: historyWindow?.graphStatus,
  }),
  true: (historyWindow, mindName) => createBrowseInitialView({
    status: 'ready',
    mindName,
    current: historyWindow?.current,
    newer: historyWindow?.newer,
    older: historyWindow?.older,
    sessionContext: historyWindow?.sessionContext,
  }),
});

export function createHistoryBrowseDataPort({ history, mindName = 'default' }) {
  return Object.freeze({
    async loadInitialView() {
      return browseInitialViewFromHistoryWindow(
        await history.loadLatestCaptureWindow(),
        { mindName }
      );
    },
  });
}

export function browseInitialViewFromHistoryWindow(
  historyWindow,
  { mindName = 'default' } = {}
) {
  return HISTORY_VIEW_READERS[String(historyWindow?.ok === true)](historyWindow, mindName);
}
