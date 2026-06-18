const EMPTY_HISTORY_ITEMS = Object.freeze([]);

const DEFAULT_HISTORY_READ_RESULT = Object.freeze({
  ok: false,
  reason: null,
  message: null,
  current: null,
  newer: null,
  older: null,
  sessionContext: null,
  sessionEntries: EMPTY_HISTORY_ITEMS,
  sessionSteps: EMPTY_HISTORY_ITEMS,
  graphStatus: null,
});

export function createHistoryReadResult(input = {}) {
  return Object.freeze({
    ...DEFAULT_HISTORY_READ_RESULT,
    ...input,
  });
}

export function createHistoryReadyWindow(input = {}) {
  return createHistoryReadResult({ ok: true, ...input });
}

export function createHistoryUnavailable(input = {}) {
  return createHistoryReadResult({ ok: false, ...input });
}
