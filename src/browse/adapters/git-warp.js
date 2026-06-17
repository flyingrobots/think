import { Worker } from 'node:worker_threads';

import { hasGitRepo } from '../../git.js';
import {
  getCheckpointGraphModelStatus,
  listCheckpointEntriesByKind,
} from '../../store/checkpoint-read.js';
import { compareEntriesNewestFirst } from '../../store/model.js';
import {
  getGraphModelStatusForRead,
  openProductReadHandle,
  prepareBrowseBootstrapForRead,
} from '../../store.js';
import { browseInitialViewFromBootstrap, createBrowseInitialView } from '../port.js';

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

export async function loadGitWarpBrowseInitialView({ repoDir, mindName = 'default' }) {
  if (!hasGitRepo(repoDir)) {
    return createBrowseInitialView({
      status: 'repo_missing',
      mindName,
      reason: 'repo_missing',
    });
  }

  const checkpointView = await loadCheckpointInitialView(repoDir, mindName);
  if (checkpointView) {
    return checkpointView;
  }

  const read = await openProductReadHandle(repoDir);
  const graphStatus = await getGraphModelStatusForRead(read);

  if (graphStatus.migrationRequired) {
    return createBrowseInitialView({
      status: 'migration_required',
      mindName,
      reason: 'graph_migration_required',
      graphStatus,
    });
  }

  return browseInitialViewFromBootstrap(
    await prepareBrowseBootstrapForRead(read),
    { mindName }
  );
}

function createGitWarpBrowseInitialViewTask({ repoDir, mindName }) {
  const state = { settled: false, rejectTask: null };
  const worker = createBrowseWorker({ repoDir, mindName });
  const promise = createBrowseWorkerPromise(worker, state);

  return {
    promise,
    dispose() {
      if (state.settled) {
        return;
      }
      state.settled = true;
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
    worker.once('message', (message) => handleWorkerMessage(message, state, resolve, reject));
    worker.once('error', (error) => rejectIfPending(state, reject, error));
    worker.once('exit', (code) => handleWorkerExit(code, state, reject));
  });
}

function handleWorkerMessage(message, state, resolve, reject) {
  if (state.settled) {
    return;
  }
  state.settled = true;
  if (message?.type === 'loaded') {
    resolve(createBrowseInitialView(message.view));
  } else {
    reject(deserializeWorkerError(message?.error));
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

async function loadCheckpointInitialView(repoDir, mindName) {
  const graphStatus = await getCheckpointGraphModelStatus(repoDir);
  if (graphStatus === null) {
    return null;
  }

  if (graphStatus.migrationRequired) {
    return createBrowseInitialView({
      status: 'migration_required',
      mindName,
      reason: 'graph_migration_required',
      graphStatus,
    });
  }

  const entries = await listCheckpointEntriesByKind(repoDir, 'capture');
  if (entries === null) {
    return null;
  }

  return createCheckpointInitialView(entries, mindName);
}

function createCheckpointInitialView(entries, mindName) {
  const sortedEntries = entries.filter(Boolean).sort(compareEntriesNewestFirst);
  if (sortedEntries.length === 0) {
    return createBrowseInitialView({
      status: 'empty',
      mindName,
      reason: 'no_entries',
    });
  }

  return createBrowseInitialView({
    status: 'ready',
    mindName,
    current: sortedEntries[0],
    older: sortedEntries[1] ?? null,
  });
}
