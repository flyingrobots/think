import { ensureGitRepo, hasGitRepo, pushWarpRefs } from '../git.js';
import { getLocalRepoDir, getUpstreamUrl } from '../paths.js';
import { capturePolicy } from '../policies.js';
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

export async function captureThought(text) {
  const thought = String(text ?? '');
  if (thought.trim() === '') {
    throw new Error('Thought cannot be empty');
  }

  const repoDir = getLocalRepoDir();
  const repoAlreadyExists = hasGitRepo(repoDir);

  await ensureGitRepo(repoDir);

  const graphStatus = repoAlreadyExists
    ? await getGraphModelStatus(repoDir)
    : {
        currentGraphModelVersion: null,
        requiredGraphModelVersion: null,
        migrationRequired: false,
      };

  const { entry, migration, warnings } = await capturePolicy.execute(async () => {
    const saved = await saveRawCapture(repoDir, thought);
    let mig = null;
    const warns = [];

    try {
      const followthrough = await finalizeCapturedThought(repoDir, saved.id, {
        migrateIfNeeded: graphStatus.migrationRequired,
      });
      mig = followthrough.migration ?? null;
    } catch (error) {
      warns.push(error instanceof Error ? error.message : String(error));
    }

    return { entry: saved, migration: mig, warnings: warns };
  });

  const upstreamUrl = getUpstreamUrl();
  let backupStatus = 'skipped';
  if (upstreamUrl) {
    const backedUp = await pushWarpRefs(repoDir, upstreamUrl, GRAPH_NAME);
    backupStatus = backedUp ? 'backed_up' : 'pending';
  }

  return {
    backupStatus,
    entryId: entry.id,
    migration,
    repoBootstrapped: !repoAlreadyExists,
    status: 'saved_locally',
    warnings,
  };
}

export async function listRecentThoughts({ count = null, query = null } = {}) {
  const repoDir = getLocalRepoDir();
  if (!hasGitRepo(repoDir)) {
    return {
      entries: [],
      repoPresent: false,
    };
  }

  const entries = await listRecent(repoDir, { count, query });
  return {
    entries: entries.map(toRecentEntry),
    repoPresent: true,
  };
}

export async function rememberThoughtsForMcp({
  cwd = process.cwd(),
  query = null,
  limit = null,
  brief = false,
} = {}) {
  const repoDir = getLocalRepoDir();
  if (!hasGitRepo(repoDir)) {
    return {
      matches: [],
      repoPresent: false,
      scope: buildRememberScope({ cwd, query, limit, brief }),
    };
  }

  await assertGraphReady('remember');

  const remember = await rememberThoughts(repoDir, {
    cwd,
    query,
    limit,
    brief,
  });

  return {
    matches: remember.matches,
    repoPresent: true,
    scope: remember.scope,
  };
}

export async function browseThought({ entryId = null } = {}) {
  const repoDir = getLocalRepoDir();
  if (!hasGitRepo(repoDir)) {
    throw new Error('No raw captures available to browse');
  }

  await assertGraphReady('browse');

  let window;
  if (entryId) {
    window = await getBrowseWindow(repoDir, entryId);
    if (!window) {
      throw new Error('Browse entry not found');
    }
  } else {
    const bootstrap = await prepareBrowseBootstrap(repoDir);
    if (!bootstrap.ok) {
      throw new Error('No raw captures available to browse');
    }
    window = bootstrap;
  }

  return {
    current: toBrowseEntry(window.current),
    newer: toBrowseEntry(window.newer),
    older: toBrowseEntry(window.older),
    sessionContext: window.sessionContext,
    sessionEntries: window.sessionEntries.map(toBrowseEntry),
    sessionSteps: window.sessionSteps.map((step) => ({
      createdAt: step.createdAt,
      direction: step.direction,
      entryId: step.id,
      sessionId: step.sessionId ?? null,
      sessionPosition: step.sessionPosition ?? null,
      sortKey: step.sortKey,
      text: step.text,
    })),
  };
}

export async function inspectThought(entryId) {
  const repoDir = getLocalRepoDir();
  if (!hasGitRepo(repoDir)) {
    throw new Error('Inspect entry not found');
  }

  await assertGraphReady('inspect');

  const entry = await inspectRawEntry(repoDir, entryId);
  if (!entry) {
    throw new Error('Inspect entry not found');
  }

  return { entry };
}

export async function getThoughtStats({ from = null, to = null, since = null, bucket = null } = {}) {
  const repoDir = getLocalRepoDir();
  if (!hasGitRepo(repoDir)) {
    return {
      buckets: null,
      repoPresent: false,
      total: 0,
    };
  }

  const stats = await getStats(repoDir, { from, to, since, bucket });
  return {
    buckets: stats.buckets ?? null,
    repoPresent: true,
    total: stats.total,
  };
}

export async function getPromptMetricsForMcp({ from = null, to = null, since = null, bucket = null } = {}) {
  const promptMetrics = await getPromptMetrics({ from, to, since, bucket });
  return {
    buckets: promptMetrics.buckets ?? null,
    summary: promptMetrics.summary,
    timings: promptMetrics.timings,
  };
}

// eslint-disable-next-line require-await -- wraps store call that returns a promise (git-warp)
export async function migrateThoughtGraph() {
  const repoDir = getLocalRepoDir();
  if (!hasGitRepo(repoDir)) {
    throw new Error('No local thought repo found to migrate');
  }

  return migrateGraphModel(repoDir);
}

async function assertGraphReady(command) {
  const repoDir = getLocalRepoDir();
  const status = await getGraphModelStatus(repoDir);
  if (!status.migrationRequired) {
    return;
  }

  const error = new Error('Graph migration required. Run think --migrate-graph.');
  error.code = 'graph_migration_required';
  error.command = command;
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

function toBrowseEntry(entry) {
  if (!entry) {
    return null;
  }

  return {
    createdAt: entry.createdAt,
    entryId: entry.id,
    sessionId: entry.sessionId ?? null,
    sortKey: entry.sortKey,
    text: entry.text,
  };
}

function toRecentEntry(entry) {
  return {
    createdAt: entry.createdAt,
    entryId: entry.id,
    sessionId: entry.sessionId ?? null,
    sortKey: entry.sortKey,
    text: entry.text,
  };
}
