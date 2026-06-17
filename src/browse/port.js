export const BROWSE_DATA_STATUSES = Object.freeze([
  'ready',
  'empty',
  'repo_missing',
  'migration_required',
  'error',
]);

const BROWSE_DEFAULT_MESSAGES = Object.freeze({
  empty: 'No raw captures available to browse',
  repo_missing: 'No thought repo found for this mind',
  migration_required: 'Graph migration required before Browse can open',
  error: 'Browse could not open',
});

export function createBrowseInitialView(input = {}) {
  return Object.freeze(normalizeBrowseInitialViewInput(input));
}

export function browseInitialViewFromBootstrap(bootstrap, { mindName = 'default' } = {}) {
  return createBrowseInitialView(browseInitialViewInputFromBootstrap(bootstrap, mindName));
}

function browseInitialViewInputFromBootstrap(bootstrap, mindName) {
  if (!bootstrap) {
    return {
      status: 'error',
      mindName,
      message: 'Mind could not be prepared for browse',
      reason: 'missing_bootstrap',
    };
  }

  if (!bootstrap.ok) {
    return {
      status: 'empty',
      mindName,
      message: 'No raw captures available to browse',
      reason: bootstrap.reason ?? 'no_entries',
    };
  }

  return {
    status: 'ready',
    mindName,
    current: bootstrap.current,
    older: bootstrap.older,
    newer: bootstrap.newer,
    sessionContext: bootstrap.sessionContext,
  };
}

export function createMemoryBrowseDataPort(initialView) {
  const view = initialView?.ok === undefined
    ? createBrowseInitialView(initialView)
    : browseInitialViewFromBootstrap(initialView);

  return Object.freeze({
    loadInitialView() {
      return Promise.resolve(view);
    },
  });
}

export function normalizeBrowseEntry(entry) {
  if (!entry) {
    return null;
  }

  return Object.freeze({
    id: String(entry.id ?? ''),
    text: String(entry.text ?? ''),
    createdAt: entry.createdAt ? String(entry.createdAt) : null,
    sortKey: entry.sortKey ? String(entry.sortKey) : null,
    sessionId: entry.sessionId ? String(entry.sessionId) : null,
  });
}

function normalizeBrowseInitialViewInput(input) {
  const status = normalizeBrowseStatus(input.status);

  return {
    status,
    mindName: normalizeBrowseMindName(input.mindName),
    current: normalizeBrowseEntry(input.current),
    older: normalizeBrowseEntry(input.older),
    newer: normalizeBrowseEntry(input.newer),
    sessionContext: input.sessionContext ?? null,
    message: normalizeBrowseMessage(input.message, status),
    reason: normalizeOptionalString(input.reason),
    graphStatus: input.graphStatus ?? null,
  };
}

function normalizeBrowseStatus(status) {
  return BROWSE_DATA_STATUSES.includes(status) ? status : 'error';
}

function normalizeBrowseMindName(mindName = 'default') {
  return String(mindName || 'default');
}

function normalizeBrowseMessage(message, status) {
  return message ? String(message) : defaultBrowseMessage(status);
}

function normalizeOptionalString(value) {
  return value ? String(value) : null;
}

function defaultBrowseMessage(status) {
  return BROWSE_DEFAULT_MESSAGES[status] ?? null;
}
