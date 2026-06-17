export function createBrowseModel({
  mindName = 'default',
  columns = 80,
  rows = 24,
} = {}) {
  return Object.freeze({
    status: 'loading',
    mindName: String(mindName || 'default'),
    view: null,
    errorMessage: null,
    loadingStep: 0,
    columns: normalizeDimension(columns, 80),
    rows: normalizeDimension(rows, 24),
  });
}

export function applyBrowseLoaded(model, view) {
  const status = view?.status ?? 'error';
  return Object.freeze({
    ...model,
    status,
    mindName: String(view?.mindName || model.mindName || 'default'),
    view: view ?? null,
    errorMessage: null,
  });
}

export function applyBrowseFailed(model, error) {
  return Object.freeze({
    ...model,
    status: 'error',
    view: null,
    errorMessage: formatErrorMessage(error),
  });
}

export function advanceBrowseLoading(model) {
  if (model.status !== 'loading') {
    return model;
  }

  return Object.freeze({
    ...model,
    loadingStep: model.loadingStep + 1,
  });
}

export function resizeBrowseModel(model, columns, rows) {
  return Object.freeze({
    ...model,
    columns: normalizeDimension(columns, model.columns || 80),
    rows: normalizeDimension(rows, model.rows || 24),
  });
}

function normalizeDimension(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0
    ? Math.floor(number)
    : fallback;
}

function formatErrorMessage(error) {
  if (!error) {
    return 'Browse could not open';
  }
  if (error instanceof Error) {
    return error.message || 'Browse could not open';
  }
  return String(error);
}
