import { ensureGitRepo, hasGitRepo, pushWarpRefs } from '../../git.js';
import { captureProvenanceFromEnvironment } from '../../capture-provenance.js';
import { getCaptureAmbientContext, getAmbientProjectContext } from '../../project-context.js';
import { getLocalRepoDir, getUpstreamUrl } from '../../paths.js';
import {
  finalizeCapturedThought,
  getGraphModelStatus,
  GRAPH_NAME,
  migrateGraphModel,
  saveRawCapture,
} from '../../store.js';

const CAPTURE_FOLLOWTHROUGH_TIMEOUT_MS = 3_000;
const CAPTURE_FOLLOWTHROUGH_DEFERRED = Object.freeze({ status: 'deferred' });
const NO_GRAPH_MIGRATION_STATUS = Object.freeze({
  currentGraphModelVersion: null,
  requiredGraphModelVersion: null,
  migrationRequired: false,
});

export async function runCapture(thought, output, reporter) {
  if (thought.trim() === '') {
    if (output.json) {
      output.error('Thought cannot be empty', 'capture.validation_failed', { reason: 'empty_thought' });
    } else {
      output.error('Thought cannot be empty');
      reporter.event('capture.validation_failed', { reason: 'empty_thought' });
    }
    return 1;
  }

  const repoDir = getLocalRepoDir();
  const repoAlreadyExists = hasGitRepo(repoDir);
  reporter.event('repo.ensure.start', { repoAlreadyExists });
  await ensureGitRepo(repoDir);
  reporter.event(repoAlreadyExists ? 'repo.ensure.done' : 'repo.bootstrap.done', { repoDir });

  const provenance = captureProvenanceFromEnvironment(process.env);
  const ambientContext = getCaptureAmbientContext(process.cwd());

  reporter.event('capture.local_save.start');
  const entry = await saveRawCapture(repoDir, thought, { provenance, ambientContext });
  reporter.event('capture.local_save.done', { entryId: entry.id });

  output.out('Saved locally', 'capture.status', {
    status: 'saved_locally',
    entryId: entry.id,
  });

  await runCaptureFollowthrough(repoDir, entry.id, repoAlreadyExists, reporter);

  return await runBackup(repoDir, output, reporter);
}

async function runCaptureFollowthrough(repoDir, entryId, repoAlreadyExists, reporter) {
  try {
    const graphStatusPromise = repoAlreadyExists
      ? getGraphModelStatus(repoDir)
      : Promise.resolve(NO_GRAPH_MIGRATION_STATUS);
    const graphStatus = await waitForCaptureFollowthrough(graphStatusPromise);
    if (graphStatus === CAPTURE_FOLLOWTHROUGH_DEFERRED) {
      graphStatusPromise.catch(() => {});
      reporter.event('capture.followthrough.deferred', {
        command: 'capture',
        trigger: 'post_capture',
        entryId,
        timeoutMs: CAPTURE_FOLLOWTHROUGH_TIMEOUT_MS,
      });
      return;
    }

    if (graphStatus.migrationRequired) {
      reporter.event('graph.migration.deferred', {
        command: 'capture',
        trigger: 'post_capture',
        entryId,
        currentGraphModelVersion: graphStatus.currentGraphModelVersion,
        requiredGraphModelVersion: graphStatus.requiredGraphModelVersion,
      });
    }

    const followthroughPromise = finalizeCapturedThought(repoDir, entryId, {
      migrateIfNeeded: false,
      ambientContext: getAmbientProjectContext(process.cwd()),
    });
    const followthrough = await waitForCaptureFollowthrough(followthroughPromise);
    if (followthrough === CAPTURE_FOLLOWTHROUGH_DEFERRED) {
      followthroughPromise.catch(() => {});
      reporter.event('capture.followthrough.deferred', {
        command: 'capture',
        trigger: 'post_capture',
        entryId,
        timeoutMs: CAPTURE_FOLLOWTHROUGH_TIMEOUT_MS,
      });
    }
  } catch (error) {
    reporter.event('graph.migration.failed', {
      command: 'capture',
      trigger: 'post_capture',
      entryId,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

async function runBackup(repoDir, output, reporter) {
  const upstreamUrl = getUpstreamUrl();
  if (!upstreamUrl) {
    reporter.event('backup.skipped');
    return 0;
  }

  reporter.event('backup.start');
  const backedUp = await pushWarpRefs(repoDir, upstreamUrl, GRAPH_NAME, { reporter });
  output.out(backedUp ? 'Backed up' : 'Backup pending', 'backup.status', {
    status: backedUp ? 'backed_up' : 'pending',
  });
  reporter.event(backedUp ? 'backup.success' : 'backup.pending');
  return 0;
}

async function waitForCaptureFollowthrough(followthroughPromise) {
  let timeoutId = null;
  const timeout = new Promise((resolve) => {
    timeoutId = setTimeout(() => resolve(CAPTURE_FOLLOWTHROUGH_DEFERRED), CAPTURE_FOLLOWTHROUGH_TIMEOUT_MS);
    timeoutId.unref?.();
  });

  try {
    return await Promise.race([followthroughPromise, timeout]);
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function runIngest(stdin, output, reporter) {
  const thought = await readStdinText(stdin);

  if (thought === '') {
    if (output.json) {
      output.error('No stdin content to ingest', 'capture.validation_failed', {
        reason: 'empty_stdin',
      });
    } else {
      output.error('No stdin content to ingest');
      reporter.event('capture.validation_failed', { reason: 'empty_stdin' });
    }
    return 1;
  }

  return runCapture(thought, output, reporter);
}

export async function runMigrateGraph(output, reporter) {
  const repoDir = getLocalRepoDir();

  reporter.event('migrate_graph.start');
  if (!hasGitRepo(repoDir)) {
    output.error('No local thought repo found to migrate', 'migrate_graph.repo_not_found');
    return 1;
  }

  const status = await getGraphModelStatus(repoDir);
  const result = status.migrationRequired
    ? await migrateGraphModel(repoDir)
    : createNoopMigrationResult(status);
  reporter.event('migrate_graph.done', result);

  if (output.json) {
    output.data('migrate_graph.result', result);
    return 0;
  }

  if (!result.changed) {
    output.out('No graph migration changes were needed.');
    return 0;
  }

  const lines = [
    'Graph migration complete',
    `Repo is now graph model version ${result.graphModelVersion}`,
    `Edges added: ${result.edgesAdded}`,
  ];
  if (result.metadataUpdated) {
    lines.push('Graph metadata updated.');
  }
  output.out(lines.join('\n'));
  return 0;
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

async function readStdinText(stdin) {
  if (!stdin || stdin.isTTY) {
    return '';
  }

  stdin.setEncoding('utf8');
  let text = '';

  for await (const chunk of stdin) {
    text += chunk;
  }

  return text;
}
