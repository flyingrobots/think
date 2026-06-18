import { parentPort, workerData } from 'node:worker_threads';

import { loadGitWarpBrowseInitialViewUpdates } from './git-warp.js';

try {
  let finalView = null;
  for await (const update of loadGitWarpBrowseInitialViewUpdates(workerData)) {
    if (update.final) {
      finalView = update.view;
    } else {
      parentPort.postMessage({
        type: 'partial',
        view: update.view,
      });
    }
  }

  parentPort.postMessage({
    type: 'loaded',
    view: finalView ?? { status: 'error', message: 'Browse Git WARP worker produced no view' },
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
