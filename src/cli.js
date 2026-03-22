import { ensureGitRepo, hasGitRepo, pushWarpRefs } from './git.js';
import { getLocalRepoDir, getUpstreamUrl } from './paths.js';
import { captureThought, GRAPH_NAME, listRecent, getStats } from './store.js';
import { createVerboseReporter } from './verbose.js';

export async function main(argv, { stdout, stderr }) {
  const options = parseArgs(argv.slice(2));
  const command = resolveCommand(options);
  const reporter = createVerboseReporter(stderr, options.verbose);
  const validationError = validateOptions(options, command);

  try {
    reporter.event('cli.start', { command });

    if (validationError) {
      stderr.write(`${validationError}\n`);
      reporter.event('cli.validation_failed', { command, message: validationError });
      reporter.event('cli.failure', { command, exitCode: 1 });
      return 1;
    }

    if (command === 'recent') {
      const exitCode = await runRecent(stdout, reporter);
      reporter.event(exitCode === 0 ? 'cli.success' : 'cli.failure', { command, exitCode });
      return exitCode;
    }

    if (command === 'stats') {
      const exitCode = await runStats(stdout, reporter, options);
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

async function runStats(stdout, reporter, options) {
  const repoDir = getLocalRepoDir();

  reporter.event('stats.start', { options });
  if (!hasGitRepo(repoDir)) {
    reporter.event('stats.done', { total: 0, repoPresent: false });
    stdout.write('Total thoughts: 0\n');
    return 0;
  }

  const stats = await getStats(repoDir, options);
  reporter.event('stats.done', { total: stats.total });

  stdout.write(`Total thoughts: ${stats.total}\n`);

  if (stats.buckets) {
    for (const bucket of stats.buckets) {
      stdout.write(`${bucket.key}: ${bucket.count}\n`);
    }
  }

  return 0;
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

  reporter.event('recent.start');
  if (!hasGitRepo(repoDir)) {
    reporter.event('recent.done', {
      count: 0,
      repoPresent: false,
    });
    return 0;
  }

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
  const options = {
    verbose: false,
    stats: false,
    recent: false,
    from: null,
    to: null,
    since: null,
    bucket: null,
  };
  let parsingFlags = true;

  for (const arg of args) {
    if (parsingFlags && arg === '--') {
      parsingFlags = false;
      continue;
    }

    if (parsingFlags && arg.startsWith('--')) {
      if (arg === '--verbose') {
        options.verbose = true;
      } else if (arg === '--stats') {
        options.stats = true;
      } else if (arg === '--recent') {
        options.recent = true;
      } else if (arg.startsWith('--from=')) {
        options.from = arg.split('=')[1];
      } else if (arg.startsWith('--to=')) {
        options.to = arg.split('=')[1];
      } else if (arg.startsWith('--since=')) {
        options.since = arg.split('=')[1];
      } else if (arg.startsWith('--bucket=')) {
        options.bucket = arg.split('=')[1];
      }
      continue;
    }

    positionals.push(arg);
  }

  return {
    ...options,
    positionals,
  };
}

function resolveCommand(options) {
  if (options.stats) {
    return 'stats';
  }
  if (options.recent) {
    return 'recent';
  }
  return 'capture';
}

function validateOptions(options, command) {
  const hasStatsFilter = Boolean(options.from || options.to || options.since || options.bucket);

  if (command === 'recent' && options.positionals.length > 0) {
    return '--recent does not take a thought';
  }

  if (command === 'stats' && options.positionals.length > 0) {
    return '--stats does not take a thought';
  }

  if (command !== 'stats' && hasStatsFilter) {
    return '--from, --to, --since, and --bucket require --stats';
  }

  if (command !== 'stats') {
    return null;
  }

  if (options.from && Number.isNaN(Date.parse(options.from))) {
    return 'Invalid --from value';
  }

  if (options.to && Number.isNaN(Date.parse(options.to))) {
    return 'Invalid --to value';
  }

  if (options.since && !/^\d+[hdw]$/.test(options.since)) {
    return 'Invalid --since value';
  }

  if (options.bucket && !['hour', 'day', 'week'].includes(options.bucket)) {
    return 'Invalid --bucket value';
  }

  return null;
}
