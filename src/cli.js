import { ensureGitRepo, hasGitRepo, pushWarpRefs } from './git.js';
import { getLocalRepoDir, getUpstreamUrl } from './paths.js';
import { captureThought, GRAPH_NAME, listRecent } from './store.js';
import { createVerboseReporter } from './verbose.js';

export async function main(argv, { stdout, stderr }) {
  const options = parseArgs(argv.slice(2));
  const command = isRecentCommand(options.positionals) ? 'recent' : 'capture';
  const reporter = createVerboseReporter(stderr, options.verbose);

  try {
    reporter.event('cli.start', { command });

    if (command === 'recent') {
      const exitCode = await runRecent(stdout, reporter);
      reporter.event(exitCode === 0 ? 'cli.success' : 'cli.failure', { command, exitCode });
      return exitCode;
    }

    const thought = options.positionals.length <= 1 ? (options.positionals[0] ?? '') : options.positionals.join(' ');
    const exitCode = await runCapture(thought, stdout, stderr, reporter);
    reporter.event(exitCode === 0 ? 'cli.success' : 'cli.failure', { command, exitCode });
    return exitCode;
  } catch (error) {
    reporter.event('cli.error', {
      command,
      message: error instanceof Error ? error.message : String(error),
    });
    stderr.write('Something went wrong\n');
    return 1;
  }
}

async function runCapture(thought, stdout, stderr, reporter) {
  if (thought.trim() === '') {
    stderr.write('Thought cannot be empty\n');
    reporter.event('capture.validation_failed', { reason: 'empty_thought' });
    return 1;
  }

  const repoDir = getLocalRepoDir();
  const repoAlreadyExists = hasGitRepo(repoDir);
  reporter.event('repo.ensure.start', {
    repoAlreadyExists,
  });
  await ensureGitRepo(repoDir);
  reporter.event(repoAlreadyExists ? 'repo.ensure.done' : 'repo.bootstrap.done', {
    repoDir,
  });

  reporter.event('capture.local_save.start');
  const entry = await captureThought(repoDir, thought);
  reporter.event('capture.local_save.done', {
    entryId: entry.id,
  });

  stdout.write('Saved locally\n');

  const upstreamUrl = getUpstreamUrl();
  if (!upstreamUrl) {
    reporter.event('backup.skipped');
    return 0;
  }

  reporter.event('backup.start');
  const backedUp = await pushWarpRefs(repoDir, upstreamUrl, GRAPH_NAME, { reporter });
  stdout.write(backedUp ? 'Backed up\n' : 'Backup pending\n');
  reporter.event(backedUp ? 'backup.success' : 'backup.pending');
  return 0;
}

async function runRecent(stdout, reporter) {
  const repoDir = getLocalRepoDir();
  await ensureGitRepo(repoDir);

  reporter.event('recent.start');
  const entries = await listRecent(repoDir);
  reporter.event('recent.done', {
    count: entries.length,
  });
  if (entries.length > 0) {
    stdout.write(`${entries.map(entry => entry.text).join('\n')}\n`);
  }

  return 0;
}

function parseArgs(args) {
  const positionals = [];
  let verbose = false;
  let parsingFlags = true;

  for (const arg of args) {
    if (parsingFlags && arg === '--') {
      parsingFlags = false;
      continue;
    }

    if (parsingFlags && arg === '--verbose') {
      verbose = true;
      continue;
    }

    positionals.push(arg);
  }

  return {
    verbose,
    positionals,
  };
}

function isRecentCommand(positionals) {
  return positionals.length === 1 && positionals[0] === 'recent';
}
