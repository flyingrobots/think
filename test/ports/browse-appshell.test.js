import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  browsePageKeyMap,
  createBrowsePage,
  createBrowseShellApp,
} from '../../src/browse/app.js';
import {
  createGitWarpBrowseDataPort,
  createGitWarpHistoryPort,
} from '../../src/browse/adapters/git-warp.js';
import { createHistoryBrowseDataPort } from '../../src/browse/adapters/history.js';
import {
  browseInitialViewFromBootstrap,
  createBrowseInitialView,
  createMemoryBrowseDataPort,
} from '../../src/browse/port.js';
import {
  advanceBrowseLoading,
  applyBrowseLoaded,
  createBrowseModel,
} from '../../src/browse/model.js';
import {
  BROWSE_LOADING_FRAMES,
  renderBrowsePaneText,
} from '../../src/browse/view.js';
import {
  createHistoryReadyWindow,
  createHistoryUnavailable,
} from '../../src/history/port.js';
import { ensureGitRepo } from '../../src/git.js';
import { migrateGraphModel, saveRawCapture } from '../../src/store.js';
import { createTempDir } from '../fixtures/tmp.js';

test('Browse data port maps bootstrap data into a TUI-facing initial view', () => {
  const view = browseInitialViewFromBootstrap({
    ok: true,
    current: {
      id: 'entry:1780000000000-abcdef12-3456-7890-abcd-ef1234567890',
      text: 'Port data should be boring and renderer-shaped.',
      createdAt: '2026-06-17T13:00:00.000Z',
      sortKey: '1780000000000-abcdef12-3456-7890-abcd-ef1234567890',
    },
    older: null,
    newer: null,
    sessionContext: null,
  }, { mindName: 'codex' });

  assert.equal(view.status, 'ready');
  assert.equal(view.mindName, 'codex');
  assert.equal(view.current.text, 'Port data should be boring and renderer-shaped.');
  assert.equal(view.older, null);
});

test('Browse data port maps empty bootstrap data into an empty view', () => {
  const view = browseInitialViewFromBootstrap({
    ok: false,
    reason: 'no_entries',
    current: null,
    older: null,
    newer: null,
    sessionContext: null,
  });

  assert.equal(view.status, 'empty');
  assert.equal(view.reason, 'no_entries');
  assert.match(view.message, /No raw captures/);
});

test('Browse data port preserves ready History metadata', () => {
  const graphStatus = {
    currentGraphModelVersion: 4,
    requiredGraphModelVersion: 4,
    migrationRequired: false,
  };
  const view = browseInitialViewFromBootstrap({
    ok: true,
    current: {
      id: 'entry:1780000000000-abcdef12-3456-7890-abcd-ef1234567890',
      text: 'Checkpoint data can stay visible while live History catches up.',
      createdAt: '2026-06-17T13:00:00.000Z',
    },
    older: null,
    newer: null,
    sessionContext: null,
    message: 'Showing checkpoint while live History failed: fixture failure',
    reason: 'live_load_failed',
    graphStatus,
  }, { mindName: 'codex' });

  assert.equal(view.status, 'ready');
  assert.equal(view.message, 'Showing checkpoint while live History failed: fixture failure');
  assert.equal(view.reason, 'live_load_failed');
  assert.equal(view.graphStatus, graphStatus);
});

test('Browse data port maps a History capture window into an initial view', async () => {
  const dataPort = createHistoryBrowseDataPort({
    mindName: 'codex',
    history: {
      loadLatestCaptureWindow: () => Promise.resolve(createHistoryReadyWindow({
        current: {
          id: 'entry:1780000000000-abcdef12-3456-7890-abcd-ef1234567890',
          text: 'History is the Browse contract.',
          createdAt: '2026-06-17T13:00:00.000Z',
        },
      })),
    },
  });

  const view = await dataPort.loadInitialView();

  assert.equal(view.status, 'ready');
  assert.equal(view.mindName, 'codex');
  assert.equal(view.current.text, 'History is the Browse contract.');
});

test('Browse data port maps unavailable History into an empty view', async () => {
  const dataPort = createHistoryBrowseDataPort({
    history: {
      loadLatestCaptureWindow: () => Promise.resolve(createHistoryUnavailable({
        reason: 'no_entries',
      })),
    },
  });

  const view = await dataPort.loadInitialView();

  assert.equal(view.status, 'empty');
  assert.match(view.message, /No raw captures/);
});

test('Browse data port streams History capture window updates', async () => {
  const dataPort = createStreamingHistoryDataPort();
  const task = dataPort.loadInitialViewTask();
  const partialViews = [];
  const unsubscribe = task.subscribe((view) => partialViews.push(view));

  const finalView = await task.promise;
  unsubscribe();
  task.dispose();

  assert.equal(partialViews.length, 1);
  assert.equal(partialViews[0].current.text, 'Checkpoint History view.');
  assert.equal(finalView.current.text, 'Final live History view.');
});

test('Browse page loads initial data through the port inside a Bijou page', async () => {
  const dataPort = createMemoryBrowseDataPort({
    status: 'ready',
    mindName: 'codex',
    current: {
      id: 'entry:1780000000000-abcdef12-3456-7890-abcd-ef1234567890',
      text: 'The first frame can load without blocking startup.',
      createdAt: '2026-06-17T13:00:00.000Z',
    },
  });
  const page = createBrowsePage({ dataPort, columns: 72, rows: 12 });
  const [initialModel, commands] = page.init();
  const emitted = [];

  assert.equal(page.id, 'browse');
  assert.equal(initialModel.status, 'loading');
  assert.equal(commands.length, 2);

  const cleanup = commands[0]((msg) => emitted.push(msg));
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
  cleanup.dispose();
  const [loadedModel] = page.update(emitted[0], initialModel);

  assert.equal(loadedModel.status, 'ready');
  assert.equal(loadedModel.view.current.text, 'The first frame can load without blocking startup.');
});

test('Browse page applies streamed initial History updates before the final load', async () => {
  const fixture = createStreamedInitialViewPage();
  const [initialModel, commands] = fixture.page.init();
  const emitted = [];

  const cleanup = commands[0]((msg) => emitted.push(msg));
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
  assert.equal(emitted.length, 1);
  const [partialModel] = fixture.page.update(emitted[0], initialModel);
  assert.equal(partialModel.view.current.text, 'Checkpoint snapshot is already usable.');

  fixture.resolveFinal();
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
  cleanup.dispose();

  assert.equal(emitted.length, 2);
  const [finalModel] = fixture.page.update(emitted[1], partialModel);
  assert.equal(finalModel.view.current.text, 'Live History finished loading.');
});

test('Browse page disposes cancellable background load tasks', async () => {
  let disposed = false;
  let resolveTask;
  const emitted = [];
  const page = createBrowsePage({
    dataPort: {
      loadInitialViewTask() {
        return {
          promise: new Promise((resolve) => {
            resolveTask = resolve;
          }),
          dispose() {
            disposed = true;
          },
        };
      },
    },
  });
  const [, commands] = page.init();

  const cleanup = commands[0]((msg) => emitted.push(msg));
  cleanup.dispose();
  resolveTask(createBrowseInitialView({ status: 'empty' }));
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

  assert.equal(disposed, true);
  assert.deepEqual(emitted, []);
});

test('Browse page layout renders inside a framed pane', () => {
  const page = createBrowsePage({
    dataPort: createMemoryBrowseDataPort({ status: 'empty' }),
    columns: 60,
    rows: 16,
  });
  const [model] = page.init();
  const layout = page.layout(model);

  assert.equal(layout.kind, 'pane');
  assert.equal(layout.paneId, 'browse-reader');
  assert.equal(typeof layout.render, 'function');
});

test('Browse shell app is a Bijou AppShell, not a hand-rolled terminal loop', async () => {
  const app = createBrowseShellApp({
    dataPort: createMemoryBrowseDataPort({ status: 'empty' }),
  });
  const source = await readFile(new URL('../../src/browse/app.js', import.meta.url), 'utf8');

  assert.equal(typeof app.run, 'function');
  assert.match(source, /createFramedApp/);
  assert.doesNotMatch(source, /setRawMode|process\\.stdin|\\x1b/);
});

test('Browse page body renders loading state with a real spinner', () => {
  const loading = createBrowseModel({ mindName: 'codex', columns: 64, rows: 10 });
  const loadingText = renderBrowsePaneText(loading);
  assert.match(loadingText, /Mind: codex/);
  assert.match(loadingText, new RegExp(`[${BROWSE_LOADING_FRAMES.join('')}]`, 'u'));
  assert.doesNotMatch(loadingText, /\[[=-]+\]/);
  assert.match(loadingText, /Waiting on history read/);
  assert.doesNotMatch(loadingText, /THINK BROWSE/);

  const advancedLoadingText = renderBrowsePaneText(advanceBrowseLoading(loading));
  assert.notEqual(advancedLoadingText, loadingText);
});

test('Browse page body renders ready state with a History rail', () => {
  const loading = createBrowseModel({ mindName: 'codex', columns: 64, rows: 10 });
  const ready = applyBrowseLoaded(loading, createBrowseInitialView({
    status: 'ready',
    mindName: 'codex',
    current: {
      id: 'entry:1780000000000-abcdef12-3456-7890-abcd-ef1234567890',
      text: 'Draw this text without leaking storage implementation details.',
      createdAt: '2026-06-17T13:00:00.000Z',
    },
    older: {
      id: 'entry:1779999999000-older',
      text: 'Older context.',
      createdAt: '2026-06-17T12:59:59.000Z',
    },
  }));
  const readyText = renderBrowsePaneText(ready);
  assert.match(readyText, /Draw this text/);
  assert.match(readyText, /History/);
  assert.match(readyText, /now/);
  assert.match(readyText, /older/);
  assert.doesNotMatch(readyText, /git-warp|checkpoint|graph/i);
});

test('Browse page body renders empty, migration, and repo-missing states', () => {
  const loading = createBrowseModel({ mindName: 'codex', columns: 64, rows: 10 });
  const empty = applyBrowseLoaded(loading, createBrowseInitialView({ status: 'empty' }));
  assert.match(renderBrowsePaneText(empty), /No raw captures/);

  const migration = applyBrowseLoaded(loading, createBrowseInitialView({
    status: 'migration_required',
  }));
  assert.match(renderBrowsePaneText(migration), /History migration required/);
  assert.doesNotMatch(renderBrowsePaneText(migration), /Graph migration required/);

  const error = applyBrowseLoaded(loading, createBrowseInitialView({
    status: 'repo_missing',
    message: 'No thought repo found for this mind',
  }));
  assert.match(renderBrowsePaneText(error), /No thought repo/);
});

test('Browse AppShell keymap exposes direct quit bindings', () => {
  assert.deepEqual(browsePageKeyMap.handle(key('q')), { type: 'quit' });
  assert.deepEqual(browsePageKeyMap.handle(key('escape')), { type: 'quit' });
  assert.equal(browsePageKeyMap.handle(key('down')), undefined);
});

test('Git WARP Browse adapter reads the latest raw capture through the Browse port', async () => {
  const repoDir = await createTempDir('think-browse-appshell-');
  await ensureGitRepo(repoDir);
  await saveRawCapture(repoDir, 'Browse adapter should turn store data into reader data.');
  await migrateGraphModel(repoDir);

  const view = await createGitWarpBrowseDataPort({
    repoDir,
    mindName: 'fixture',
  }).loadInitialView();

  assert.equal(view.status, 'ready');
  assert.equal(view.mindName, 'fixture');
  assert.equal(view.current.text, 'Browse adapter should turn store data into reader data.');
});

test('Git WARP implements the Browse History port for capture windows', async () => {
  const repoDir = await createTempDir('think-browse-history-');
  await ensureGitRepo(repoDir);
  await saveRawCapture(repoDir, 'Git WARP is one possible History backend.');
  await migrateGraphModel(repoDir);

  const historyWindow = await createGitWarpHistoryPort({
    repoDir,
    mindName: 'fixture',
  }).loadLatestCaptureWindow();

  assert.equal(historyWindow.ok, true);
  assert.equal(historyWindow.current.text, 'Git WARP is one possible History backend.');
});

test('Git WARP History port treats empty migrated repos as no entries', async () => {
  const repoDir = await createTempDir('think-browse-empty-history-');
  await ensureGitRepo(repoDir);
  await migrateGraphModel(repoDir);

  const historyWindow = await createGitWarpHistoryPort({
    repoDir,
  }).loadLatestCaptureWindow();

  assert.equal(historyWindow.ok, false);
  assert.equal(historyWindow.reason, 'no_entries');
});

function createStreamingHistoryDataPort() {
  return createHistoryBrowseDataPort({
    history: {
      loadLatestCaptureWindow: () => Promise.resolve(createHistoryWindow(
        'entry:1780000001000-final',
        'Final live History view.'
      )),
      loadLatestCaptureWindowUpdates: async function* loadUpdates() {
        yield historyWindowUpdate(false, 'entry:1780000000000-partial', 'Checkpoint History view.');
        yield historyWindowUpdate(true, 'entry:1780000001000-final', 'Final live History view.');
      },
    },
  });
}

function createStreamedInitialViewPage() {
  const partialView = createBrowseInitialView({
    status: 'ready',
    mindName: 'codex',
    current: createBrowseEntry('entry:1780000000000-partial', 'Checkpoint snapshot is already usable.'),
  });
  const finalView = createBrowseInitialView({
    status: 'ready',
    mindName: 'codex',
    current: createBrowseEntry('entry:1780000001000-final', 'Live History finished loading.'),
  });
  let resolveFinal;
  const listeners = new Set();

  return {
    page: createBrowsePage({
      dataPort: createControlledStreamDataPort({
        listeners,
        partialView,
        setResolve: (resolve) => {
          resolveFinal = resolve;
        },
      }),
    }),
    resolveFinal() {
      resolveFinal(finalView);
    },
  };
}

function createControlledStreamDataPort({ listeners, partialView, setResolve }) {
  return {
    loadInitialViewTask() {
      queueMicrotask(() => emitToListeners(listeners, partialView));
      return {
        promise: new Promise((resolve) => {
          setResolve(resolve);
        }),
        subscribe(listener) {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
        dispose() {
          listeners.clear();
        },
      };
    },
  };
}

function emitToListeners(listeners, view) {
  for (const listener of listeners) {
    listener(view);
  }
}

function historyWindowUpdate(final, id, text) {
  return {
    final,
    historyWindow: createHistoryWindow(id, text),
  };
}

function createHistoryWindow(id, text) {
  return createHistoryReadyWindow({
    current: { id, text },
  });
}

function createBrowseEntry(id, text) {
  return {
    id,
    text,
    createdAt: '2026-06-17T13:00:00.000Z',
  };
}

function key(name) {
  return {
    type: 'key',
    key: name,
    ctrl: false,
    alt: false,
    shift: false,
  };
}
