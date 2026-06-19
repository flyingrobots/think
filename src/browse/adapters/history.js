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
  const loadInitialView = async () => browseInitialViewFromHistoryWindow(
    await history.loadLatestCaptureWindow(),
    { mindName }
  );

  return Object.freeze({
    loadInitialView,
    loadInitialViewTask() {
      if (typeof history.loadLatestCaptureWindowUpdates !== 'function') {
        return {
          promise: loadInitialView(),
          dispose() {},
        };
      }
      return createHistoryBrowseInitialViewTask({ history, mindName });
    },
  });
}

export function browseInitialViewFromHistoryWindow(
  historyWindow,
  { mindName = 'default' } = {}
) {
  return HISTORY_VIEW_READERS[String(historyWindow?.ok === true)](historyWindow, mindName);
}

function createHistoryBrowseInitialViewTask({ history, mindName }) {
  const state = { disposed: false, listeners: new Set() };

  return {
    promise: loadHistoryBrowseInitialViewFromUpdates({ history, mindName, state }),
    subscribe(listener) {
      state.listeners.add(listener);
      return () => {
        state.listeners.delete(listener);
      };
    },
    dispose() {
      state.disposed = true;
      state.listeners.clear();
    },
  };
}

async function loadHistoryBrowseInitialViewFromUpdates({ history, mindName, state }) {
  let finalView = null;
  for await (const rawUpdate of history.loadLatestCaptureWindowUpdates()) {
    if (state.disposed) {
      break;
    }

    const update = normalizeHistoryWindowUpdate(rawUpdate);
    const view = browseInitialViewFromHistoryWindow(update.historyWindow, { mindName });
    if (update.final) {
      finalView = view;
    } else {
      emitHistoryUpdate(state, view);
    }
  }
  return resolveHistoryBrowseFinalView({ finalView, history, mindName, state });
}

async function resolveHistoryBrowseFinalView({ finalView, history, mindName, state }) {
  if (state.disposed) {
    return finalView ?? createBrowseInitialView({ status: 'error', mindName });
  }
  return finalView ?? browseInitialViewFromHistoryWindow(
    await history.loadLatestCaptureWindow(),
    { mindName }
  );
}

function normalizeHistoryWindowUpdate(update) {
  if (update && Object.hasOwn(update, 'historyWindow')) {
    return Object.freeze({
      final: update.final !== false,
      historyWindow: update.historyWindow,
    });
  }

  return Object.freeze({
    final: true,
    historyWindow: update,
  });
}

function emitHistoryUpdate(state, view) {
  for (const listener of state.listeners) {
    listener(view);
  }
}
