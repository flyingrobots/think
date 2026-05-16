import { runDiagnostics } from '../doctor.js';
import { ValidationError, NotFoundError, GraphError } from '../errors.js';
import { ensureGitRepo, hasGitRepo, lsRemote, pushWarpRefs } from '../git.js';
import { getLocalRepoDir, getThinkDir, getUpstreamUrl } from '../paths.js';
import { normalizeCaptureProvenance } from '../capture-provenance.js';
import { getCaptureAmbientContext, getAmbientProjectContext } from '../project-context.js';
import {
  finalizeCapturedThought,
  getBrowseWindow,
  getGraphModelStatus,
  getPromptMetrics,
  getStats,
  GRAPH_NAME,
  inspectRawEntry,
  listRecent,
  migrateGraphModel,
  prepareBrowseBootstrap,
  rememberThoughts,
  saveRawCapture,
} from '../store.js';
import {
  buildAmbientRememberScope,
  buildExplicitRememberScope,
} from '../store/remember.js';
import {
  BrowseOutcome,
  CaptureOutcome,
  HealthOutcome,
  McpOutcome,
  MigrationOutcome,
  PromptMetricsOutcome,
  RecentThoughtsOutcome,
  RememberOutcome,
  StatsOutcome,
} from './result.js';

const CAPTURE_FOLLOWTHROUGH_TIMEOUT_MS = 3_000;
const CAPTURE_FOLLOWTHROUGH_DEFERRED = Object.freeze({ status: 'deferred' });
const CAPTURE_FOLLOWTHROUGH_DEFERRED_WARNING =
  'Capture followthrough deferred; raw thought saved locally before derived graph updates completed.';
const NO_GRAPH_MIGRATION_STATUS = Object.freeze({
  currentGraphModelVersion: null,
  requiredGraphModelVersion: null,
  migrationRequired: false,
});

const defaultCaptureDeps = Object.freeze({
  ensureGitRepo,
  finalizeCapturedThought,
  getAmbientProjectContext,
  getCaptureAmbientContext,
  getCwd: () => process.cwd(),
  getGraphModelStatus,
  getLocalRepoDir,
  getUpstreamUrl,
  graphName: GRAPH_NAME,
  hasGitRepo,
  pushWarpRefs,
  saveRawCapture,
  waitForFollowthrough: waitForCaptureFollowthrough,
});

export const captureThought = createCaptureThoughtService();

export function createCaptureThoughtService(deps = defaultCaptureDeps) {
  return async function captureThoughtWithDeps(text, { provenance = null } = {}) {
    const thought = normalizeThoughtText(text);
    const captureProvenance = normalizeCaptureProvenance(provenance);
    const repoDir = deps.getLocalRepoDir();
    const repoAlreadyExists = deps.hasGitRepo(repoDir);

    await deps.ensureGitRepo(repoDir);
    const entry = await deps.saveRawCapture(repoDir, thought, {
      provenance: captureProvenance,
      ambientContext: deps.getCaptureAmbientContext(deps.getCwd()),
    });
    const followthrough = await runCaptureFollowthrough(deps, repoDir, entry.id, repoAlreadyExists);
    const backupStatus = await runCaptureBackup(deps, repoDir);

    return new CaptureOutcome({
      backupStatus,
      entryId: entry.id,
      migration: followthrough.migration,
      repoBootstrapped: !repoAlreadyExists,
      status: 'saved_locally',
      warnings: followthrough.warnings,
    });
  };
}

function normalizeThoughtText(text) {
  const thought = String(text ?? '');
  if (thought.trim() === '') {
    throw new ValidationError('Thought cannot be empty');
  }
  return thought;
}

async function runCaptureFollowthrough(deps, repoDir, entryId, repoAlreadyExists) {
  const warnings = [];
  const followthroughPromise = buildCaptureFollowthrough(deps, repoDir, entryId, repoAlreadyExists);

  try {
    const followthrough = await deps.waitForFollowthrough(followthroughPromise);
    if (!isDeferredCaptureFollowthrough(followthrough)) {
      return { migration: followthrough?.migration ?? null, warnings };
    }
  } catch (error) {
    warnings.push(error instanceof Error ? error.message : String(error));
    return { migration: null, warnings };
  }

  followthroughPromise.catch(() => {});
  warnings.push(CAPTURE_FOLLOWTHROUGH_DEFERRED_WARNING);
  return { migration: null, warnings };
}

async function buildCaptureFollowthrough(deps, repoDir, entryId, repoAlreadyExists) {
  const graphStatus = repoAlreadyExists
    ? await deps.getGraphModelStatus(repoDir)
    : NO_GRAPH_MIGRATION_STATUS;

  return await deps.finalizeCapturedThought(repoDir, entryId, {
    migrateIfNeeded: graphStatus.migrationRequired,
    ambientContext: deps.getAmbientProjectContext(deps.getCwd()),
  });
}

function isDeferredCaptureFollowthrough(followthrough) {
  return followthrough?.status === CAPTURE_FOLLOWTHROUGH_DEFERRED.status;
}

async function runCaptureBackup(deps, repoDir) {
  const upstreamUrl = deps.getUpstreamUrl();
  if (!upstreamUrl) {
    return 'skipped';
  }

  const backedUp = await deps.pushWarpRefs(repoDir, upstreamUrl, deps.graphName);
  return backedUp ? 'backed_up' : 'pending';
}

async function waitForCaptureFollowthrough(followthroughPromise) {
  let timeoutId = null;
  const timeout = new Promise((resolve) => {
    timeoutId = setTimeout(
      () => resolve(CAPTURE_FOLLOWTHROUGH_DEFERRED),
      CAPTURE_FOLLOWTHROUGH_TIMEOUT_MS
    );
    timeoutId.unref?.();
  });

  try {
    return await Promise.race([followthroughPromise, timeout]);
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function listRecentThoughts({ count = null, query = null } = {}) {
  const repoDir = getLocalRepoDir();
  if (!hasGitRepo(repoDir)) {
    return new RecentThoughtsOutcome({
      entries: [],
      repoPresent: false,
      total: 0,
    });
  }

  const result = await listRecent(repoDir, { count, query });
  return new RecentThoughtsOutcome({
    entries: result.entries.map(toMcpEntry),
    repoPresent: true,
    total: result.total,
  });
}

export async function rememberThoughtsForMcp({
  cwd = process.cwd(),
  query = null,
  limit = null,
  brief = false,
} = {}) {
  const repoDir = getLocalRepoDir();
  if (!hasGitRepo(repoDir)) {
    return new RememberOutcome({
      matches: [],
      repoPresent: false,
      scope: buildRememberScope({ cwd, query, limit, brief }),
    });
  }

  await assertGraphReady('remember');

  const remember = await rememberThoughts(repoDir, {
    cwd,
    query,
    limit,
    brief,
  });

  return new RememberOutcome({
    matches: remember.matches,
    repoPresent: true,
    scope: remember.scope,
  });
}

export async function browseThought({ entryId = null } = {}) {
  const repoDir = getLocalRepoDir();
  if (!hasGitRepo(repoDir)) {
    throw new NotFoundError('No raw captures available to browse');
  }

  await assertGraphReady('browse');

  let window;
  if (entryId) {
    window = await getBrowseWindow(repoDir, entryId);
    if (!window) {
      throw new NotFoundError('Browse entry not found');
    }
  } else {
    const bootstrap = await prepareBrowseBootstrap(repoDir);
    if (!bootstrap.ok) {
      throw new NotFoundError('No raw captures available to browse');
    }
    window = bootstrap;
  }

  return new BrowseOutcome({
    current: toMcpEntry(window.current),
    newer: toMcpEntry(window.newer),
    older: toMcpEntry(window.older),
    sessionContext: window.sessionContext,
    sessionEntries: window.sessionEntries.map(toMcpEntry),
    sessionSteps: window.sessionSteps.map((step) => ({
      createdAt: step.createdAt,
      direction: step.direction,
      entryId: step.id,
      sessionId: step.sessionId ?? null,
      sessionPosition: step.sessionPosition ?? null,
      sortKey: step.sortKey,
      text: step.text,
    })),
  });
}

export async function inspectThought(entryId) {
  const repoDir = getLocalRepoDir();
  if (!hasGitRepo(repoDir)) {
    throw new NotFoundError('Inspect entry not found');
  }

  await assertGraphReady('inspect');

  const entry = await inspectRawEntry(repoDir, entryId);
  if (!entry) {
    throw new NotFoundError('Inspect entry not found');
  }

  return new McpOutcome({ entry });
}

export async function getThoughtStats({ from = null, to = null, since = null, bucket = null } = {}) {
  const repoDir = getLocalRepoDir();
  if (!hasGitRepo(repoDir)) {
    return new StatsOutcome({
      buckets: null,
      repoPresent: false,
      total: 0,
    });
  }

  const stats = await getStats(repoDir, { from, to, since, bucket });
  return new StatsOutcome({
    buckets: stats.buckets ?? null,
    repoPresent: true,
    total: stats.total,
  });
}

export async function getPromptMetricsForMcp({ from = null, to = null, since = null, bucket = null } = {}) {
  const promptMetrics = await getPromptMetrics({ from, to, since, bucket });
  return new PromptMetricsOutcome({
    buckets: promptMetrics.buckets ?? null,
    summary: promptMetrics.summary,
    timings: promptMetrics.timings,
  });
}

export async function checkThinkHealthForMcp() {
  const repoDir = getLocalRepoDir();
  const upstreamUrl = getUpstreamUrl();
  const diagnostics = await runDiagnostics({
    thinkDir: getThinkDir(),
    repoDir,
    upstreamUrl,
    getGraphModelStatus: hasGitRepo(repoDir)
      ? () => getGraphModelStatus(repoDir)
      : null,
    getEntryCount: hasGitRepo(repoDir)
      ? async () => (await getStats(repoDir, {})).total
      : null,
    checkUpstreamReachable: upstreamUrl ? () => lsRemote(upstreamUrl) : null,
  });

  return new HealthOutcome(diagnostics);
}

const defaultMigrationDeps = Object.freeze({
  getGraphModelStatus,
  getLocalRepoDir,
  hasGitRepo,
  migrateGraphModel,
});

export const migrateThoughtGraph = createMigrateThoughtGraphService();

export function createMigrateThoughtGraphService(deps = defaultMigrationDeps) {
  return async function migrateThoughtGraphWithDeps() {
    const repoDir = deps.getLocalRepoDir();
    if (!deps.hasGitRepo(repoDir)) {
      throw new GraphError('No local thought repo found to migrate');
    }

    const status = await deps.getGraphModelStatus(repoDir);
    if (!status.migrationRequired) {
      return new MigrationOutcome(createNoopMigrationResult(status));
    }

    const result = await deps.migrateGraphModel(repoDir);
    return new MigrationOutcome(result);
  };
}

async function assertGraphReady(command) {
  const repoDir = getLocalRepoDir();
  const status = await getGraphModelStatus(repoDir);
  if (!status.migrationRequired) {
    return;
  }

  const error = new GraphError('Graph migration required. Run think --migrate-graph.');
  error.code = 'graph_migration_required';
  error.command = command;
  error.remediation = 'think --migrate-graph';
  error.status = status;
  throw error;
}

function buildRememberScope({ cwd, query, limit, brief }) {
  const scope = query && String(query).trim() !== ''
    ? buildExplicitRememberScope(query)
    : buildAmbientRememberScope(cwd);

  return {
    ...scope,
    brief,
    limit,
  };
}

function createNoopMigrationResult(status) {
  return Object.freeze({
    changed: false,
    graphModelVersion: status.currentGraphModelVersion ?? status.requiredGraphModelVersion,
    edgesAdded: 0,
    edgesRemoved: 0,
    metadataUpdated: false,
  });
}

function toMcpEntry(entry) {
  if (!entry) {
    return null;
  }

  return Object.freeze({
    createdAt: entry.createdAt,
    entryId: entry.id,
    sessionId: entry.sessionId ?? null,
    sortKey: entry.sortKey,
    text: entry.text,
  });
}

/** @deprecated Use checkThinkHealthForMcp instead */
export function checkThinkHealth() {
  return checkThinkHealthForMcp();
}
