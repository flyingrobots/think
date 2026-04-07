import { ensureGitRepo, hasGitRepo, pushWarpRefs } from '../../git.js';
import { captureProvenanceFromEnvironment } from '../../capture-provenance.js';
import { getLocalRepoDir, getUpstreamUrl } from '../../paths.js';
import {
  finalizeCapturedThought,
  getGraphModelStatus,
  GRAPH_NAME,
  migrateGraphModel,
  saveRawCapture,
} from '../../store.js';

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

  const graphStatus = repoAlreadyExists
    ? await getGraphModelStatus(repoDir)
    : {
        currentGraphModelVersion: null,
        requiredGraphModelVersion: null,
        migrationRequired: false,
      };
  const provenance = captureProvenanceFromEnvironment(process.env);

  reporter.event('capture.local_save.start');
  const entry = await saveRawCapture(repoDir, thought, { provenance });
  reporter.event('capture.local_save.done', { entryId: entry.id });

  output.out('Saved locally', 'capture.status', {
    status: 'saved_locally',
    entryId: entry.id,
  });

  try {
    if (graphStatus.migrationRequired) {
      reporter.event('graph.migration.start', {
        command: 'capture',
        trigger: 'post_capture',
        entryId: entry.id,
        currentGraphModelVersion: graphStatus.currentGraphModelVersion,
        requiredGraphModelVersion: graphStatus.requiredGraphModelVersion,
      });
    }

    const followthrough = await finalizeCapturedThought(repoDir, entry.id, {
      migrateIfNeeded: graphStatus.migrationRequired,
    });

    if (graphStatus.migrationRequired) {
      reporter.event('graph.migration.done', {
        command: 'capture',
        trigger: 'post_capture',
        entryId: entry.id,
        currentGraphModelVersion: graphStatus.currentGraphModelVersion,
        requiredGraphModelVersion: graphStatus.requiredGraphModelVersion,
        ...(followthrough.migration ?? {
          changed: false,
          graphModelVersion: graphStatus.currentGraphModelVersion,
          edgesAdded: 0,
          metadataUpdated: false,
        }),
      });
    }
  } catch (error) {
    reporter.event('graph.migration.failed', {
      command: 'capture',
      trigger: 'post_capture',
      entryId: entry.id,
      message: error instanceof Error ? error.message : String(error),
    });
  }

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

  const result = await migrateGraphModel(repoDir);
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
