import {
  createCommandPaletteState,
  helpShort,
} from '@flyingrobots/bijou-tui';
import { formatCompactWhen, normalizeWhitespace, clamp, compareEntriesOldestFirst } from './format.js';
import { browseKeymap } from './keymap.js';

const DEFAULT_JUMP_HEIGHT = 8;

export function currentEntry(model) {
  if (model.mode === 'windowed' && model.currentWindow?.current) {
    return model.currentWindow.current;
  }
  return model.entries[model.currentIndex];
}

export function currentInspectEntry(model) {
  return model.inspectCache.get(currentEntry(model).id) ?? null;
}

export function resolveNeighbors(model) {
  if (model.mode === 'windowed' && model.currentWindow) {
    return {
      newer: model.currentWindow.newer ?? null,
      older: model.currentWindow.older ?? null,
    };
  }

  return {
    newer: model.currentIndex > 0 ? model.entries[model.currentIndex - 1] : null,
    older: model.currentIndex + 1 < model.entries.length ? model.entries[model.currentIndex + 1] : null,
  };
}

export function resolveSessionTraversal(model) {
  const entry = currentEntry(model);

  if (model.mode === 'windowed' && model.currentWindow) {
    const { sessionContext } = model.currentWindow;
    const previous = model.currentWindow.sessionSteps
      .find((step) => step.direction === 'previous') ?? null;
    const next = model.currentWindow.sessionSteps
      .find((step) => step.direction === 'next') ?? null;

    return {
      entries: [entry, ...model.currentWindow.sessionEntries].sort(compareEntriesOldestFirst),
      count: sessionContext?.sessionCount ?? model.currentWindow.sessionEntries.length + 1,
      position: sessionContext?.sessionPosition ?? null,
      previous,
      next,
    };
  }

  if (!entry?.sessionId) {
    return {
      entries: [],
      count: 0,
      position: null,
      previous: null,
      next: null,
    };
  }

  const sessionEntries = model.entries
    .filter((candidate) => candidate.sessionId === entry.sessionId)
    .sort(compareEntriesOldestFirst);
  const sessionIndex = sessionEntries.findIndex((candidate) => candidate.id === entry.id);

  if (sessionIndex === -1) {
    return {
      entries: sessionEntries,
      count: sessionEntries.length,
      position: null,
      previous: null,
      next: null,
    };
  }

  return {
    entries: sessionEntries,
    count: sessionEntries.length,
    position: sessionIndex + 1,
    previous: sessionIndex > 0 ? sessionEntries[sessionIndex - 1] : null,
    next: sessionIndex + 1 < sessionEntries.length ? sessionEntries[sessionIndex + 1] : null,
  };
}

export function resolveChronologyPosition(model) {
  if (model.mode === 'windowed' && !model.chronologyLoaded) {
    return null;
  }

  return `${model.currentIndex + 1} of ${model.entries.length}`;
}

export function resolveJumpEntries(model) {
  if (model.mode !== 'windowed') {
    return model.entries;
  }

  return model.chronologyLoaded ? model.entries : [];
}

export function resolveLayout(model) {
  const bodyHeight = Math.max(1, model.rows - 2);
  const panelHeight = resolvePanelHeight(bodyHeight);

  return {
    bodyHeight,
    bodyWidth: model.columns,
    panelHeight,
    thoughtHeight: bodyHeight,
  };
}

function resolvePanelHeight(bodyHeight) {
  const target = Math.floor(bodyHeight * 0.35);
  return clamp(target, 6, Math.max(6, bodyHeight - 8));
}

export function resolveHelpLine(model) {
  if (model.panelMode === 'reflect') {
    return model.notice
      ? `${model.notice} • Type to respond • Enter save • Backspace delete • Esc cancel`
      : 'Type to respond • Enter save • Backspace delete • Esc cancel';
  }

  if (model.panelMode === 'jump') {
    return 'Type to filter • ↑/↓ move • Enter open • Backspace erase • Esc close';
  }

  const help = helpShort(browseKeymap);
  return model.notice ? `${model.notice} • ${help}` : help;
}

export function resolveBrowseCounter(model) {
  if (model.mode === 'windowed' && !model.chronologyLoaded) {
    return null;
  }

  return `(${model.currentIndex + 1}/${model.entries.length})`;
}

export function resolveDrawerTitle(panelMode) {
  switch (panelMode) {
    case 'inspect':
      return 'INSPECT';
    case 'session':
      return 'SESSION';
    case 'log':
      return 'THOUGHT LOG';
    case 'jump':
      return 'JUMP';
    default:
      return '';
  }
}

export function resolveReflectHint(model) {
  if (model.reflect.status === 'loading') {
    return 'Preparing prompt...';
  }
  if (model.reflect.status === 'saving') {
    return 'Saving...';
  }
  return 'Type to respond • Enter save • Backspace delete • Esc cancel';
}

export function createJumpPalette(entries) {
  return createCommandPaletteState(
    entries.map((entry) => ({
      id: entry.id,
      label: normalizeWhitespace(entry.text),
      description: formatCompactWhen(entry.createdAt),
    })),
    DEFAULT_JUMP_HEIGHT
  );
}

export function computeLogScroll(model, height) {
  if (model.mode === 'windowed' && !model.chronologyLoaded) {
    return 0;
  }

  const selectedLine = 2 + model.currentIndex;
  const visibleHeight = Math.max(1, height);
  const target = selectedLine - Math.floor(visibleHeight / 2);
  const maxY = Math.max(0, model.entries.length + 2 - visibleHeight);
  return clamp(target, 0, maxY);
}

