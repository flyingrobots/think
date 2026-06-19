import { createBijou } from '@flyingrobots/bijou';
import { nodeRuntime, nodeIO, chalkStyle } from '@flyingrobots/bijou-node';
import { createFramedApp, createKeyMap, quit, tick } from '@flyingrobots/bijou-tui';

import {
  advanceBrowseLoading,
  applyBrowseFailed,
  applyBrowseLoaded,
  createBrowseModel,
  resizeBrowseModel,
} from './model.js';
import { renderBrowsePaneSurface } from './view.js';
import { thinkShellThemes, thinkTheme } from '../browse-tui/theme.js';

const LOADING_TICK_MS = 120;

class BrowseAppError extends Error {
  constructor(message) {
    super(message);
    this.name = 'BrowseAppError';
  }
}

export const browsePageKeyMap = createKeyMap()
  .group('Browse', (group) => group
    .bind('q', 'Quit', { type: 'quit' })
    .bind('escape', 'Quit', { type: 'quit' }));

export async function runBrowseAppShellTui({
  dataPort,
  title = 'THINK BROWSE',
  mindName = 'default',
} = {}) {
  const ctx = createInteractiveBijouContext();
  const modelRef = { current: null };
  const app = createBrowseShellApp({ dataPort, title, mindName, ctx, modelRef });

  await app.run({ ctx });

  return { type: 'quit', model: modelRef.current };
}

export function createBrowseShellApp({
  dataPort,
  title = 'THINK BROWSE',
  mindName = 'default',
  ctx,
  modelRef = null,
} = {}) {
  const page = createBrowsePage({ dataPort, title, mindName, modelRef });

  return createFramedApp({
    ctx,
    title,
    pages: [page],
    shellThemes: thinkShellThemes,
    keyPriority: 'page-first',
    bodyTopRows: 1,
    bodyBottomRows: 1,
    helpLineSource: ({ model }) => {
      const pageModel = model.pageModels?.[page.id];
      if (pageModel?.status === 'loading') {
        return 'q quit';
      }
      return page.keyMap;
    },
  });
}

export function createBrowsePage({
  dataPort,
  title = 'THINK BROWSE',
  mindName = 'default',
  modelRef = null,
  columns = 80,
  rows = 24,
} = {}) {
  assertBrowseDataPort(dataPort);

  return {
    id: 'browse',
    title: formatBrowsePageTitle(title, mindName),

    init() {
      return initBrowsePage({ dataPort, mindName, columns, rows, modelRef });
    },

    update(msg, model) {
      return updateBrowsePage({ msg, model, modelRef });
    },

    layout(model) {
      return layoutBrowsePage(model);
    },

    keyMap: browsePageKeyMap,
    helpSource: browsePageKeyMap,
  };
}

function assertBrowseDataPort(dataPort) {
  if (
    !dataPort
    || (
      typeof dataPort.loadInitialView !== 'function'
      && typeof dataPort.loadInitialViewTask !== 'function'
    )
  ) {
    throw new BrowseAppError('Browse AppShell requires a Browse data port');
  }
}

function formatBrowsePageTitle(title, mindName) {
  return mindName && mindName !== 'default' ? `${title} [${mindName}]` : title;
}

function initBrowsePage({ dataPort, mindName, columns, rows, modelRef }) {
  return commitModel(modelRef, createBrowseModel({ mindName, columns, rows }), [
    loadInitialViewCommand(dataPort),
    loadingTickCommand(),
  ]);
}

const browsePageUpdateHandlers = Object.freeze({
  resize: ({ msg, model, modelRef }) => (
    commitModel(modelRef, resizeBrowseModel(model, msg.columns, msg.rows), [])
  ),
  browse_initial_view_loaded: ({ msg, model, modelRef }) => (
    commitModel(modelRef, applyBrowseLoaded(model, msg.view), [])
  ),
  browse_initial_view_failed: ({ msg, model, modelRef }) => (
    commitModel(modelRef, applyBrowseFailed(model, msg.error), [])
  ),
  browse_loading_tick: ({ model, modelRef }) => commitLoadingTick(modelRef, model),
  quit: ({ model, modelRef }) => commitModel(modelRef, model, [quit()]),
});

function updateBrowsePage({ msg, model, modelRef }) {
  const handler = browsePageUpdateHandlers[msg.type] ?? keepBrowsePageModel;
  return handler({ msg, model, modelRef });
}

function commitLoadingTick(modelRef, model) {
  const next = advanceBrowseLoading(model);
  return commitModel(
    modelRef,
    next,
    next.status === 'loading' ? [loadingTickCommand()] : []
  );
}

function keepBrowsePageModel({ model, modelRef }) {
  return commitModel(modelRef, model, []);
}

function layoutBrowsePage(model) {
  return {
    kind: 'pane',
    paneId: 'browse-reader',
    render: (width, height) => renderBrowsePaneSurface(
      resizeBrowseModel(model, width, height),
      width,
      height
    ),
  };
}

function loadInitialViewCommand(dataPort) {
  return (emit) => {
    let disposed = false;
    const task = createInitialViewTask(dataPort);
    const unsubscribe = subscribeInitialViewTask(task, emit, () => disposed);

    task.promise.then(
      (view) => emitInitialViewLoaded(emit, view, () => disposed),
      (error) => emitInitialViewFailed(emit, error, () => disposed)
    );

    return {
      dispose() {
        disposed = true;
        unsubscribe();
        task.dispose();
      },
    };
  };
}

function subscribeInitialViewTask(task, emit, isDisposed) {
  if (typeof task.subscribe !== 'function') {
    return () => {};
  }

  const subscription = task.subscribe((view) => {
    emitInitialViewLoaded(emit, view, isDisposed);
  });
  return typeof subscription === 'function' ? subscription : () => {};
}

function emitInitialViewLoaded(emit, view, isDisposed) {
  if (!isDisposed()) {
    emit({
      type: 'browse_initial_view_loaded',
      view,
    });
  }
}

function emitInitialViewFailed(emit, error, isDisposed) {
  if (!isDisposed()) {
    emit({
      type: 'browse_initial_view_failed',
      error,
    });
  }
}

function createInitialViewTask(dataPort) {
  if (typeof dataPort.loadInitialViewTask === 'function') {
    return dataPort.loadInitialViewTask();
  }

  return {
    promise: dataPort.loadInitialView(),
    dispose() {},
  };
}

function loadingTickCommand() {
  return tick(LOADING_TICK_MS, { type: 'browse_loading_tick' });
}

function commitModel(modelRef, model, commands) {
  if (modelRef) {
    modelRef.current = model;
  }
  return [model, commands];
}

function createInteractiveBijouContext() {
  const ctx = createBijou({
    runtime: nodeRuntime(),
    io: nodeIO(),
    style: chalkStyle(),
    theme: thinkTheme,
  });

  return ctx.mode === 'interactive'
    ? ctx
    : { ...ctx, mode: 'interactive' };
}
