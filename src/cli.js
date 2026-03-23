import { input, note, select } from '@flyingrobots/bijou';
import { initDefaultContext } from '@flyingrobots/bijou-node';

import { ensureGitRepo, hasGitRepo, pushWarpRefs } from './git.js';
import { getLocalRepoDir, getUpstreamUrl } from './paths.js';
import {
  captureThought,
  GRAPH_NAME,
  listRecent,
  getStats,
  startBrainstorm,
  saveBrainstormResponse,
} from './store.js';
import { createVerboseReporter } from './verbose.js';

export async function main(argv, { stdout, stderr }) {
  const options = parseArgs(argv.slice(2));
  const command = resolveCommand(options);
  const reporter = createVerboseReporter(
    options.json
      ? (payload) => {
          const stream = resolveJsonStream(payload) === 'stderr' ? stderr : stdout;
          stream.write(`${JSON.stringify(payload)}\n`);
        }
      : stderr,
    options.verbose || options.json
  );
  const output = createOutput({ stdout, stderr, reporter, json: options.json });
  const validationError = validateOptions(options, command);

  try {
    reporter.event('cli.start', { command });

    if (validationError) {
      if (options.json) {
        output.error(validationError, 'cli.validation_failed', { command });
      } else {
        output.error(validationError);
        reporter.event('cli.validation_failed', { command, message: validationError });
      }
      reporter.event('cli.failure', { command, exitCode: 1 });
      return 1;
    }

    let exitCode = 0;
    if (command === 'recent') {
      exitCode = await runRecent(output, reporter);
    } else if (command === 'stats') {
      exitCode = await runStats(output, reporter, options);
    } else if (command === 'brainstorm_start') {
      exitCode = await runBrainstormStart(options.brainstorm, output, reporter);
    } else if (command === 'brainstorm_reply') {
      exitCode = await runBrainstormReply(
        options.brainstormSession,
        options.positionals.join(' '),
        output,
        reporter
      );
    } else {
      const thought = options.positionals.length <= 1
        ? (options.positionals[0] ?? '')
        : options.positionals.join(' ');
      exitCode = await runCapture(thought, output, reporter);
    }

    reporter.event(exitCode === 0 ? 'cli.success' : 'cli.failure', { command, exitCode });
    return exitCode;
  } catch (error) {
    reporter.event('cli.error', {
      command,
      message: error instanceof Error ? error.message : String(error),
    });
    if (!options.json) {
      output.error('Something went wrong');
    }
    return 1;
  }
}

async function runStats(output, reporter, options) {
  const repoDir = getLocalRepoDir();

  reporter.event('stats.start', { options });
  if (!hasGitRepo(repoDir)) {
    reporter.event('stats.done', { total: 0, repoPresent: false });
    output.out('Total thoughts: 0', 'stats.total', { total: 0 });
    return 0;
  }

  const stats = await getStats(repoDir, options);
  reporter.event('stats.done', { total: stats.total });

  output.out(`Total thoughts: ${stats.total}`, 'stats.total', { total: stats.total });

  if (stats.buckets) {
    for (const [index, bucket] of stats.buckets.entries()) {
      output.out(`${bucket.key}: ${bucket.count}`, 'stats.bucket', {
        key: bucket.key,
        count: bucket.count,
        index,
      });
    }
  }

  return 0;
}

async function runCapture(thought, output, reporter) {
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

  reporter.event('capture.local_save.start');
  const entry = await captureThought(repoDir, thought);
  reporter.event('capture.local_save.done', { entryId: entry.id });

  output.out('Saved locally', 'capture.status', {
    status: 'saved_locally',
    entryId: entry.id,
  });

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

async function runBrainstormStart(seedEntryId, output, reporter) {
  const repoDir = getLocalRepoDir();
  let resolvedSeedEntryId = seedEntryId;

  if (!resolvedSeedEntryId) {
    const pickedSeedEntryId = await pickBrainstormSeed(repoDir, output, reporter);
    if (!pickedSeedEntryId) {
      return 1;
    }
    resolvedSeedEntryId = pickedSeedEntryId;
  } else if (!hasGitRepo(repoDir)) {
    output.error('Seed entry not found', 'brainstorm.seed_not_found', { seedEntryId: resolvedSeedEntryId });
    return 1;
  }

  const session = await startBrainstorm(repoDir, resolvedSeedEntryId);
  if (!session) {
    output.error('Seed entry not found', 'brainstorm.seed_not_found', { seedEntryId: resolvedSeedEntryId });
    return 1;
  }

  const sessionPayload = {
    sessionId: session.sessionId,
    seedEntryId: session.seedEntryId,
    contrastEntryId: session.contrastEntryId ?? null,
    promptType: session.promptType,
    maxSteps: session.maxSteps,
    selectionReason: session.selectionReason,
  };

  reporter.event('brainstorm.session_started', sessionPayload);

  if (session.contrastEntry) {
    reporter.event('brainstorm.contrast', {
      entryId: session.contrastEntry.id,
      text: session.contrastEntry.text,
      selectionReason: session.selectionReason,
    });
  }

  reporter.event('brainstorm.prompt', {
    sessionId: session.sessionId,
    promptType: session.promptType,
    question: session.question,
  });

  if (shouldUseInteractiveBrainstormShell(output)) {
    return runInteractiveBrainstormShell(session, output, reporter);
  }

  if (!output.json) {
    const lines = ['Brainstorm'];
    if (session.contrastEntry) {
      lines.push(`Contrast: ${session.contrastEntry.text}`);
      lines.push(`Why selected: ${session.selectionReason.text}`);
    } else {
      lines.push(`Constraint: ${session.selectionReason.text}`);
    }
    lines.push(`Question: ${session.question}`);
    output.out(lines.join('\n'));
  }

  return 0;
}

async function runBrainstormReply(sessionId, response, output, reporter) {
  if (response.trim() === '') {
    output.error('Brainstorm response cannot be empty', 'brainstorm.validation_failed', {
      reason: 'empty_response',
    });
    return 1;
  }

  const repoDir = getLocalRepoDir();
  if (!hasGitRepo(repoDir)) {
    output.error('Brainstorm session not found', 'brainstorm.session_not_found', { sessionId });
    return 1;
  }

  const saved = await saveBrainstormResponse(repoDir, sessionId, response);
  if (!saved) {
    output.error('Brainstorm session not found', 'brainstorm.session_not_found', { sessionId });
    return 1;
  }

  reporter.event('brainstorm.entry_saved', {
    entryId: saved.id,
    kind: saved.kind,
    seedEntryId: saved.seedEntryId,
    contrastEntryId: saved.contrastEntryId ?? null,
    sessionId: saved.sessionId,
    promptType: saved.promptType,
  });

  if (!output.json) {
    output.out('Brainstorm saved');
  }

  return 0;
}

async function pickBrainstormSeed(repoDir, output, reporter) {
  if (!isInteractiveBrainstormAvailable() || output.json) {
    output.error('--brainstorm requires a seed entry id', 'cli.validation_failed', {
      command: 'brainstorm_start',
    });
    return null;
  }

  if (!hasGitRepo(repoDir)) {
    output.error('No raw captures available to brainstorm from', 'brainstorm.seed_not_found');
    return null;
  }

  const recentEntries = (await listRecent(repoDir)).slice(0, 9);
  if (recentEntries.length === 0) {
    output.error('No raw captures available to brainstorm from', 'brainstorm.seed_not_found');
    return null;
  }

  const ctx = initDefaultContext();
  await note({
    title: 'Choose a seed thought',
    message: 'Pick one recent raw capture to pressure-test.',
    ctx,
  });

  return select({
    title: 'Seed thought',
    maxVisible: 7,
    options: recentEntries.map((entry, index) => ({
      value: entry.id,
      label: truncateForPicker(entry.text),
      description: index === 0 ? 'most recent' : undefined,
    })),
    defaultValue: recentEntries[0].id,
    ctx,
  });
}

async function runInteractiveBrainstormShell(session, output, reporter) {
  const ctx = initDefaultContext();
  const receiptLine = session.contrastEntry
    ? `Contrast: ${session.contrastEntry.text}\nWhy selected: ${session.selectionReason.text}`
    : `Constraint: ${session.selectionReason.text}`;

  await note({
    title: 'Brainstorm',
    message: `${receiptLine}\nQuestion: ${session.question}`,
    ctx,
  });

  const response = await input({
    title: 'Response',
    placeholder: 'Push the idea somewhere sharper...',
    ctx,
  });

  if (response.trim() === '') {
    reporter.event('brainstorm.skipped', {
      sessionId: session.sessionId,
      reason: 'empty_response',
    });
    await note({
      title: 'Brainstorm skipped',
      message: 'No brainstorm response was saved.',
      ctx,
    });
    return 0;
  }

  return runBrainstormReply(session.sessionId, response, output, reporter);
}

async function runRecent(output, reporter) {
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
  reporter.event('recent.done', { count: entries.length });
  if (entries.length > 0) {
    if (output.json) {
      for (const [index, entry] of entries.entries()) {
        output.data('recent.entry', {
          entryId: entry.id,
          text: entry.text,
          sortKey: entry.sortKey,
          index,
        });
      }
    } else {
      output.out(entries.map(entry => entry.text).join('\n'));
    }
  }

  return 0;
}

function parseArgs(args) {
  const positionals = [];
  const options = {
    verbose: false,
    json: false,
    stats: false,
    recent: false,
    brainstormFlag: false,
    brainstorm: null,
    brainstormSessionFlag: false,
    brainstormSession: null,
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
      } else if (arg === '--json') {
        options.json = true;
      } else if (arg === '--stats') {
        options.stats = true;
      } else if (arg === '--recent') {
        options.recent = true;
      } else if (arg === '--brainstorm') {
        options.brainstormFlag = true;
        options.brainstorm = '';
      } else if (arg.startsWith('--brainstorm=')) {
        options.brainstormFlag = true;
        options.brainstorm = arg.slice('--brainstorm='.length);
      } else if (arg === '--brainstorm-session') {
        options.brainstormSessionFlag = true;
        options.brainstormSession = '';
      } else if (arg.startsWith('--brainstorm-session=')) {
        options.brainstormSessionFlag = true;
        options.brainstormSession = arg.slice('--brainstorm-session='.length);
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
  if (options.brainstormSessionFlag) {
    return 'brainstorm_reply';
  }
  if (options.brainstormFlag) {
    return 'brainstorm_start';
  }
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
  const explicitCommands = [
    options.recent,
    options.stats,
    options.brainstormFlag,
    options.brainstormSessionFlag,
  ].filter(Boolean).length;

  if (explicitCommands > 1) {
    return 'Commands cannot be combined';
  }

  if (command === 'recent' && options.positionals.length > 0) {
    return '--recent does not take a thought';
  }

  if (command === 'stats' && options.positionals.length > 0) {
    return '--stats does not take a thought';
  }

  if (command === 'brainstorm_start') {
    if (!options.brainstorm && !canInteractivelyPickBrainstormSeed(options)) {
      return '--brainstorm requires a seed entry id';
    }
    if (options.positionals.length > 0) {
      return '--brainstorm does not take a response';
    }
  }

  if (command === 'brainstorm_reply') {
    if (!options.brainstormSession) {
      return '--brainstorm-session requires a session id';
    }
    if (options.positionals.length === 0) {
      return '--brainstorm-session requires a response';
    }
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

function createOutput({ stdout, stderr, reporter, json }) {
  return {
    json,
    out(message, eventName, data = {}) {
      if (json) {
        reporter.event(eventName ?? 'cli.output', {
          ...data,
          message,
        });
        return;
      }

      stdout.write(message.endsWith('\n') ? message : `${message}\n`);
    },
    error(message, eventName, data = {}) {
      if (json) {
        reporter.event(eventName ?? 'cli.error_output', {
          ...data,
          message,
        });
        return;
      }

      stderr.write(message.endsWith('\n') ? message : `${message}\n`);
    },
    data(eventName, data = {}) {
      if (!json) {
        return;
      }

      reporter.event(eventName, data);
    },
  };
}

function shouldUseInteractiveBrainstormShell(output) {
  return !output.json && isInteractiveBrainstormAvailable();
}

function isInteractiveBrainstormAvailable() {
  return process.stdin.isTTY === true && process.stdout.isTTY === true;
}

function canInteractivelyPickBrainstormSeed(options) {
  return !options.json && isInteractiveBrainstormAvailable();
}

function truncateForPicker(text, maxWidth = 72) {
  const normalized = String(text).replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxWidth) {
    return normalized;
  }
  return `${normalized.slice(0, maxWidth - 1)}…`;
}

function resolveJsonStream(payload) {
  if (payload.event === 'backup.status' && payload.status === 'pending') {
    return 'stderr';
  }

  if (
    [
      'cli.validation_failed',
      'cli.failure',
      'cli.error',
      'capture.validation_failed',
      'backup.pending',
      'backup.failure',
      'backup.timeout',
      'backup.retry',
      'brainstorm.validation_failed',
      'brainstorm.seed_not_found',
      'brainstorm.session_not_found',
    ].includes(payload.event)
  ) {
    return 'stderr';
  }

  return 'stdout';
}
