import { Worker } from 'node:worker_threads';

import { hasGitRepo } from '../../git.js';
import {
  getCheckpointGraphModelStatus,
  listCheckpointEntriesByKind,
} from '../../store/checkpoint-read.js';
import { compareEntriesNewestFirst } from '../../store/model.js';
import {
  getHistoryModelStatusForRead,
  openHistoryReadHandle,
  prepareHistoryBrowseBootstrapForRead,
} from '../../history/read.js';
import {
  createHistoryReadyWindow,
  createHistoryUnavailable,
} from '../../history/port.js';
import { browseInitialViewFromHistoryWindow } from './history.js';
import { createBrowseInitialView } from '../port.js';

class BrowseDataLoadError extends TypeError {
  constructor(message, { name = 'BrowseDataLoadError', stack = null } = {}) {
    super(message);
    this.name = name;
    if (stack) {
      this.stack = stack;
    }
  }
}

export function createGitWarpBrowseDataPort({ repoDir, mindName = 'default' }) {
  if (!repoDir) {
    throw new BrowseDataLoadError('createGitWarpBrowseDataPort requires repoDir');
  }

  return Object.freeze({
    loadInitialView() {
      const task = createGitWarpBrowseInitialViewTask({ repoDir, mindName });
      return task.promise.finally(() => {
        task.dispose();
      });
    },
    loadInitialViewTask() {
      return createGitWarpBrowseInitialViewTask({ repoDir, mindName });
    },
  });
}

export function createGitWarpHistoryPort({ repoDir }) {
  return Object.freeze({
    loadLatestCaptureWindow() {
      return loadGitWarpHistoryWindow({ repoDir });
    },
    loadLatestCaptureWindowUpdates() {
      return loadGitWarpHistoryWindowUpdates({ repoDir });
    },
  });
}

export async function loadGitWarpBrowseInitialView({ repoDir, mindName = 'default' }) {
  let finalView = null;
  for await (const update of loadGitWarpBrowseInitialViewUpdates({ repoDir, mindName })) {
    finalView = update.view;
  }
  return finalView ?? createBrowseInitialView({ status: 'error', mindName });
}

export async function* loadGitWarpBrowseInitialViewUpdates({ repoDir, mindName = 'default' }) {
  for await (const update of loadGitWarpHistoryWindowUpdates({ repoDir })) {
    yield {
      final: update.final,
      view: browseInitialViewFromHistoryWindow(update.historyWindow, { mindName }),
    };
  }
}

async function loadGitWarpHistoryWindow({ repoDir }) {
  let finalWindow = null;
  for await (const update of loadGitWarpHistoryWindowUpdates({ repoDir })) {
    finalWindow = update.historyWindow;
  }
  return finalWindow ?? createHistoryUnavailable({ reason: 'missing_bootstrap' });
}

async function* loadGitWarpHistoryWindowUpdates({ repoDir }) {
  if (!hasGitRepo(repoDir)) {
    yield {
      final: true,
      historyWindow: createHistoryUnavailable({ reason: 'repo_missing' }),
    };
    return;
  }

  const checkpointWindow = await loadCheckpointHistoryWindow(repoDir);
  if (checkpointWindow) {
    if (!checkpointWindow.ok) {
      yield finalHistoryUpdate(checkpointWindow);
      return;
    }
    yield {
      final: false,
      historyWindow: checkpointWindow,
    };
  }

  yield finalHistoryUpdate(await loadLiveHistoryWindow(repoDir));
}

async function loadLiveHistoryWindow(repoDir) {
  const read = await openHistoryReadHandle(repoDir);
  const graphStatus = await getHistoryModelStatusForRead(read);

  if (graphStatus.migrationRequired) {
    return createHistoryUnavailable({
      reason: 'migration_required',
      graphStatus,
    });
  }

  return createHistoryWindowFromBrowseBootstrap(await prepareHistoryBrowseBootstrapForRead(read));
}

function finalHistoryUpdate(historyWindow) {
  return Object.freeze({
    final: true,
    historyWindow,
  });
}

function createGitWarpBrowseInitialViewTask({ repoDir, mindName }) {
  const state = { settled: false, rejectTask: null, listeners: new Set() };
  const worker = createBrowseWorker({ repoDir, mindName });
  const promise = createBrowseWorkerPromise(worker, state);

  return {
    promise,
    subscribe(listener) {
      state.listeners.add(listener);
      return () => {
        state.listeners.delete(listener);
      };
    },
    dispose() {
      if (state.settled) {
        return;
      }
      state.settled = true;
      state.listeners.clear();
      state.rejectTask?.(new BrowseDataLoadError('Browse Git WARP worker load cancelled'));
      worker.terminate().catch(() => {});
    },
  };
}

function createBrowseWorker({ repoDir, mindName }) {
  return new Worker(new URL('./git-warp-worker.js', import.meta.url), {
    workerData: { repoDir, mindName },
  });
}

function createBrowseWorkerPromise(worker, state) {
  return new Promise((resolve, reject) => {
    state.rejectTask = reject;
    worker.on('message', (message) => handleWorkerMessage(message, state, resolve, reject));
    worker.once('error', (error) => rejectIfPending(state, reject, error));
    worker.once('exit', (code) => handleWorkerExit(code, state, reject));
  });
}

function handleWorkerMessage(message, state, resolve, reject) {
  if (state.settled) {
    return;
  }
  if (message?.type === 'partial') {
    emitWorkerUpdate(state, createBrowseInitialView(message.view));
    return;
  }

  state.settled = true;
  if (message?.type === 'loaded') {
    resolve(createBrowseInitialView(message.view));
  } else {
    reject(deserializeWorkerError(message?.error));
  }
}

function emitWorkerUpdate(state, view) {
  for (const listener of state.listeners) {
    listener(view);
  }
}

function handleWorkerExit(code, state, reject) {
  if (code !== 0) {
    rejectIfPending(
      state,
      reject,
      new BrowseDataLoadError(`Browse Git WARP worker exited with code ${code}`)
    );
  }
}

function rejectIfPending(state, reject, error) {
  if (state.settled) {
    return;
  }
  state.settled = true;
  reject(error);
}

function deserializeWorkerError(error) {
  if (!error) {
    return new BrowseDataLoadError('Browse Git WARP worker failed');
  }

  return new BrowseDataLoadError(error.message || 'Browse Git WARP worker failed', {
    name: error.name || 'BrowseDataLoadError',
    stack: error.stack ?? null,
  });
}

function createHistoryWindowFromBrowseBootstrap(bootstrap) {
  if (!bootstrap) {
    return createHistoryUnavailable({ reason: 'missing_bootstrap' });
  }

  if (!bootstrap.ok) {
    return createHistoryUnavailable({
      reason: bootstrap.reason ?? 'no_entries',
    });
  }

  return createHistoryReadyWindow(bootstrap);
}

async function loadCheckpointHistoryWindow(repoDir) {
  const graphStatus = await getCheckpointGraphModelStatus(repoDir);
  if (graphStatus === null) {
    return null;
  }

  if (graphStatus.migrationRequired) {
    return createHistoryUnavailable({
      reason: 'migration_required',
      graphStatus,
    });
  }

  const entries = await listCheckpointEntriesByKind(repoDir, 'capture');
  if (entries === null) {
    return null;
  }

  return createCheckpointHistoryWindow(entries);
}

function createCheckpointHistoryWindow(entries) {
  const sortedEntries = entries.filter(Boolean).sort(compareEntriesNewestFirst);
  if (sortedEntries.length === 0) {
    return createHistoryUnavailable({
      reason: 'no_entries',
    });
  }

  return createHistoryReadyWindow({
    current: sortedEntries[0],
    older: sortedEntries[1] ?? null,
  });
}
