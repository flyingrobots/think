import { cpFilter } from '@flyingrobots/bijou-tui';
import { currentEntry, createJumpPalette } from './resolve.js';
import { createBrowseWindowLoadCommand, createChronologyLoadCommand, createInspectLoadCommand } from './commands.js';

export function queueBrowseWindowLoad(model, entryId, overrides = {}) {
  if (!model.loadBrowseWindow) {
    return {
      model,
      effect: null,
    };
  }

  return {
    model: {
      ...model,
      notice: null,
      contentScrollY: 0,
      ...overrides,
    },
    effect: null,
    cmds: [createBrowseWindowLoadCommand(entryId, model.loadBrowseWindow)],
  };
}

export function queueChronologyLoad(model, query = null) {
  if (!model.loadChronologyEntries || model.chronologyLoaded || model.chronologyLoading) {
    return {
      model: {
        ...model,
        panelMode: model.panelMode,
      },
      effect: null,
    };
  }

  return {
    model: {
      ...model,
      chronologyLoading: true,
      jumpPalette: query === null ? model.jumpPalette : cpFilter(createJumpPalette([]), query),
    },
    effect: null,
    cmds: [createChronologyLoadCommand(model.loadChronologyEntries, query)],
  };
}

export function applyBrowseWindowLoaded(model, msg, loadInspectEntry) {
  if (!msg.browseWindow?.ok && !msg.browseWindow?.current && msg.browseWindow !== null) {
    return [model, []];
  }

  const nextWindow = msg.browseWindow;
  if (!nextWindow?.current) {
    return [model, []];
  }

  const nextEntries = model.chronologyLoaded
    ? model.entries
    : [nextWindow.current];
  const nextIndex = nextEntries.findIndex((entry) => entry.id === nextWindow.current.id);

  const nextModel = {
    ...model,
    currentWindow: nextWindow,
    entries: nextEntries,
    currentIndex: nextIndex === -1 ? 0 : nextIndex,
    contentScrollY: 0,
    notice: null,
  };

  return maybeQueueInspectLoad(nextModel, loadInspectEntry);
}

export function applyChronologyLoaded(model, msg) {
  const entries = msg.entries ?? [];
  const currentId = currentEntry(model)?.id ?? null;
  const nextIndex = currentId
    ? Math.max(0, entries.findIndex((entry) => entry.id === currentId))
    : 0;

  return {
    ...model,
    chronologyLoaded: true,
    chronologyLoading: false,
    entries,
    currentIndex: nextIndex,
    jumpPalette: cpFilter(createJumpPalette(entries), msg.query ?? model.jumpPalette.query ?? ''),
    notice: null,
  };
}

export function maybeQueueInspectLoad(model, loadInspectEntry) {
  if (!loadInspectEntry) {
    return [model, []];
  }

  const entryId = currentEntry(model).id;
  if (model.panelMode !== 'inspect') {
    return [model, []];
  }
  if (model.inspectCache.has(entryId)) {
    return [model, []];
  }
  if (model.inspectLoadingEntryId === entryId) {
    return [model, []];
  }

  return [{
    ...model,
    inspectLoadingEntryId: entryId,
  }, [createInspectLoadCommand(entryId, loadInspectEntry)]];
}
