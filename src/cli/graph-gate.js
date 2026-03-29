import { migrateGraphModel } from '../store.js';
import { canInteractivelyOfferGraphMigration } from './environment.js';
import { promptForGraphMigration, renderGraphMigrationProgress } from './interactive.js';
import { writeShellBlock } from './output.js';

export async function ensureGraphModelReady(repoDir, command, output, reporter, getGraphModelStatus) {
  const status = await getGraphModelStatus(repoDir);
  return ensureGraphModelReadyFromStatus(repoDir, command, status, output, reporter);
}

export async function ensureGraphModelReadyFromStatus(repoDir, command, status, output, reporter) {
  if (!status.migrationRequired) {
    return true;
  }

  if (canInteractivelyOfferGraphMigration(output)) {
    const decision = await promptForGraphMigration(command, status);
    if (decision === 'upgrade') {
      writeShellBlock(renderGraphMigrationProgress({
        command,
        phase: 'Applying graph migration',
        progress: 0.75,
      }), output);
      reporter.event('graph.migration.start', {
        command,
        trigger: 'interactive_gate',
        ...status,
      });
      const result = await migrateGraphModel(repoDir);
      writeShellBlock(renderGraphMigrationProgress({
        command,
        phase: 'Writing checkpoint / finishing',
        progress: 1,
      }), output);
      reporter.event('graph.migration.done', {
        command,
        trigger: 'interactive_gate',
        ...status,
        ...result,
      });
      return true;
    }

    reporter.event('graph.migration.cancelled', {
      command,
      ...status,
    });
    output.error('Graph upgrade cancelled', 'graph.migration_cancelled', {
      command,
      ...status,
    });
    return false;
  }

  output.error('Graph migration required. Run think --migrate-graph.', 'graph.migration_required', {
    command,
    ...status,
  });
  return false;
}
