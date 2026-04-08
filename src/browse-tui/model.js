import { createJumpPalette } from './resolve.js';

const DEFAULT_COLUMNS = 120;
const DEFAULT_ROWS = 32;

export function createWindowedBrowseModel({
  bootstrap,
  inspectCache,
  loadBrowseWindow,
  loadChronologyEntries,
}) {
  return {
    mode: 'windowed',
    entries: bootstrap?.current ? [bootstrap.current] : [],
    inspectCache,
    inspectLoadingEntryId: null,
    currentIndex: 0,
    currentWindow: bootstrap ?? null,
    chronologyLoaded: false,
    chronologyLoading: false,
    loadBrowseWindow,
    loadChronologyEntries,
    columns: process.stdout.columns ?? DEFAULT_COLUMNS,
    rows: process.stdout.rows ?? DEFAULT_ROWS,
    contentScrollY: 0,
    panelMode: 'none',
    jumpPalette: createJumpPalette([]),
    previousPanelMode: 'none',
    notice: null,
    reflect: {
      status: 'idle',
      entryId: null,
      promptType: null,
      question: '',
      draft: '',
    },
  };
}

export function createBrowseModel({ entries, inspectCache, initialEntryId }) {
  return {
    mode: 'scripted',
    entries,
    inspectCache,
    inspectLoadingEntryId: null,
    currentIndex: resolveInitialIndex(entries, initialEntryId),
    panelMode: 'none',
    columns: process.stdout.columns ?? DEFAULT_COLUMNS,
    rows: process.stdout.rows ?? DEFAULT_ROWS,
    contentScrollY: 0,
    jumpPalette: createJumpPalette(entries),
    previousPanelMode: 'none',
    notice: null,
    reflect: {
      status: 'idle',
      entryId: null,
      promptType: null,
      question: '',
      draft: '',
    },
  };
}

export function resizeBrowseModel(model, columns, rows) {
  return {
    ...model,
    columns,
    rows,
  };
}

function resolveInitialIndex(entries, initialEntryId) {
  if (!initialEntryId) {
    return 0;
  }

  const index = entries.findIndex((entry) => entry.id === initialEntryId);
  return index === -1 ? 0 : index;
}
