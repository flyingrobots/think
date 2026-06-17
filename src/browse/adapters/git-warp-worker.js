import { parentPort, workerData } from 'node:worker_threads';

import { loadGitWarpBrowseInitialView } from './git-warp.js';

try {
  parentPort.postMessage({
    type: 'loaded',
    view: await loadGitWarpBrowseInitialView(workerData),
  });
} catch (error) {
  parentPort.postMessage({
    type: 'failed',
    error: serializeError(error),
  });
}

function serializeError(error) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    name: 'Error',
    message: String(error),
    stack: null,
  };
}
