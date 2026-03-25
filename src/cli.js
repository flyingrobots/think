import { headerBox, input, markdown, select } from '@flyingrobots/bijou';
import { initDefaultContext } from '@flyingrobots/bijou-node';

import { ensureGitRepo, hasGitRepo, pushWarpRefs } from './git.js';
import { getLocalRepoDir, getUpstreamUrl } from './paths.js';
import {
  BRAINSTORM_PROMPT_TYPES,
  captureThought,
  GRAPH_NAME,
  getBrowseWindow,
  inspectRawEntry,
  listBrainstormableRecent,
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
      exitCode = await runRecent(output, reporter, options);
    } else if (command === 'browse') {
      exitCode = await runBrowse(options.browse, output, reporter);
    } else if (command === 'inspect') {
      exitCode = await runInspect(options.inspect, output, reporter);
    } else if (command === 'stats') {
      exitCode = await runStats(output, reporter, options);
    } else if (command === 'brainstorm_start') {
      exitCode = await runBrainstormStart(options.brainstorm, output, reporter, {
        brainstormMode: options.brainstormMode,
      });
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

async function runBrainstormStart(seedEntryId, output, reporter, { brainstormMode } = {}) {
  const repoDir = getLocalRepoDir();
  let resolvedSeedEntryId = seedEntryId;
  let resolvedPromptType = brainstormMode;

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

  if (!resolvedPromptType && shouldUseInteractiveBrainstormShell(output)) {
    resolvedPromptType = await pickBrainstormMode();
    if (!resolvedPromptType) {
      reporter.event('brainstorm.skipped', {
        seedEntryId: resolvedSeedEntryId,
        reason: 'no_prompt_type_selected',
      });
      if (!output.json) {
        output.out('Reflect skipped');
      }
      return 0;
    }
  }

  const result = await startBrainstorm(repoDir, resolvedSeedEntryId, {
    promptType: resolvedPromptType,
  });
  if (!result.ok && result.code === 'seed_not_found') {
    output.error('Seed entry not found', 'brainstorm.seed_not_found', { seedEntryId: resolvedSeedEntryId });
    return 1;
  }
  if (!result.ok && result.code === 'seed_ineligible') {
    const suggestedSeeds = await suggestAlternativeSeeds(repoDir, resolvedSeedEntryId);
    const message = formatIneligibleSeedMessage(result.eligibility, suggestedSeeds);
    if (output.json) {
      output.error(message, 'brainstorm.seed_ineligible', {
        seedEntryId: resolvedSeedEntryId,
        reason: result.eligibility,
        suggestedSeeds,
      });
    } else {
      output.error(message);
      reporter.event('brainstorm.seed_ineligible', {
        seedEntryId: resolvedSeedEntryId,
        reason: result.eligibility,
        suggestedSeeds,
      });
    }
    return 1;
  }
  const session = result;

  const sessionPayload = {
    sessionId: session.sessionId,
    seedEntryId: session.seedEntryId,
    contrastEntryId: session.contrastEntryId ?? null,
    promptType: session.promptType,
    maxSteps: session.maxSteps,
    selectionReason: session.selectionReason,
  };

  reporter.event('brainstorm.session_started', sessionPayload);

  reporter.event('brainstorm.prompt', {
    sessionId: session.sessionId,
    promptType: session.promptType,
    question: session.question,
  });

  if (shouldUseInteractiveBrainstormShell(output)) {
    return runInteractiveBrainstormShell(session, output, reporter);
  }

  if (!output.json) {
    const lines = ['Reflect'];
    lines.push(`Mode: ${capitalize(session.promptType)}`);
    lines.push(`Why selected: ${session.selectionReason.text}`);
    lines.push(`Question: ${session.question}`);
    output.out(lines.join('\n'));
  }

  return 0;
}

async function runBrainstormReply(sessionId, response, output, reporter) {
  if (response.trim() === '') {
    output.error('Reflect response cannot be empty', 'brainstorm.validation_failed', {
      reason: 'empty_response',
    });
    return 1;
  }

  const repoDir = getLocalRepoDir();
  if (!hasGitRepo(repoDir)) {
    output.error('Reflect session not found', 'brainstorm.session_not_found', { sessionId });
    return 1;
  }

  const saved = await saveBrainstormResponse(repoDir, sessionId, response);
  if (!saved) {
    output.error('Reflect session not found', 'brainstorm.session_not_found', { sessionId });
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
    output.out('Reflect saved');
  }

  return 0;
}

async function pickBrainstormSeed(repoDir, output, reporter) {
  if (!isInteractiveBrainstormAvailable() || output.json) {
    output.error('--reflect requires a seed entry id', 'cli.validation_failed', {
      command: 'brainstorm_start',
    });
    return null;
  }

  if (!hasGitRepo(repoDir)) {
    output.error('No raw captures available to brainstorm from', 'brainstorm.seed_not_found');
    return null;
  }

  const recentEntries = (await listBrainstormableRecent(repoDir)).slice(0, 9);
  if (recentEntries.length === 0) {
    output.error(
      'No pressure-testable captures available to brainstorm from',
      'brainstorm.seed_ineligible',
      {
        reason: {
          kind: 'no_brainstormable_recent_captures',
          text: 'No recent captures looked like candidate ideas, questions, or decisions to pressure-test.',
        },
      }
    );
    return null;
  }

  const ctx = initDefaultContext();
  ctx.io.write(renderInteractiveSeedIntro(ctx) + '\n');

  return select({
    title: 'Seed thought',
    maxVisible: 7,
    options: recentEntries.map((entry, index) => ({
      value: entry.id,
      label: normalizeForPicker(entry.text),
      description: index === 0 ? 'most recent' : undefined,
    })),
    defaultValue: recentEntries[0].id,
    ctx,
  });
}

async function runInteractiveBrainstormShell(session, output, reporter) {
  const ctx = initDefaultContext();
  ctx.io.write(renderInteractiveBrainstormIntro(session, ctx) + '\n');

  const response = await input({
    title: 'Your response',
    placeholder: 'Push the idea somewhere sharper...',
    ctx,
  });

  if (response.trim() === '') {
    reporter.event('brainstorm.skipped', {
      sessionId: session.sessionId,
      reason: 'empty_response',
    });
    ctx.io.write(`${headerBox('Brainstorm skipped', { ctx })}\n`);
    ctx.io.write(`${markdown('**No brainstorm response was saved.**', { ctx })}\n`);
    return 0;
  }

  return runBrainstormReply(session.sessionId, response, output, reporter);
}

async function runRecent(output, reporter, options) {
  const repoDir = getLocalRepoDir();

  reporter.event('recent.start', {
    count: options.recentCount == null ? null : Number(options.recentCount),
    query: options.recentQuery ?? null,
  });
  if (!hasGitRepo(repoDir)) {
    reporter.event('recent.done', {
      count: 0,
      repoPresent: false,
    });
    return 0;
  }

  const entries = await listRecent(repoDir, {
    count: options.recentCount == null ? null : Number(options.recentCount),
    query: options.recentQuery,
  });
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

async function runBrowse(entryId, output, reporter) {
  const repoDir = getLocalRepoDir();

  reporter.event('browse.start', { entryId });
  if (!hasGitRepo(repoDir)) {
    output.error('Browse entry not found', 'browse.entry_not_found', { entryId });
    return 1;
  }

  const browseWindow = await getBrowseWindow(repoDir, entryId);
  if (!browseWindow) {
    output.error('Browse entry not found', 'browse.entry_not_found', { entryId });
    return 1;
  }

  const browseEntries = [
    { role: 'current', ...browseWindow.current },
    ...(browseWindow.newer ? [{ role: 'newer', ...browseWindow.newer }] : []),
    ...(browseWindow.older ? [{ role: 'older', ...browseWindow.older }] : []),
  ];

  reporter.event('browse.done', {
    entryId,
    count: browseEntries.length,
  });

  if (output.json) {
    for (const entry of browseEntries) {
      output.data('browse.entry', {
        role: entry.role,
        entryId: entry.id,
        text: entry.text,
        sortKey: entry.sortKey,
      });
    }
    return 0;
  }

  const lines = ['Browse', `Current: ${browseWindow.current.text}`];
  if (browseWindow.newer) {
    lines.push(`Newer: ${browseWindow.newer.text}`);
  }
  if (browseWindow.older) {
    lines.push(`Older: ${browseWindow.older.text}`);
  }
  output.out(lines.join('\n'));
  return 0;
}

async function runInspect(entryId, output, reporter) {
  const repoDir = getLocalRepoDir();

  reporter.event('inspect.start', { entryId });
  if (!hasGitRepo(repoDir)) {
    output.error('Inspect entry not found', 'inspect.entry_not_found', { entryId });
    return 1;
  }

  const entry = await inspectRawEntry(repoDir, entryId);
  if (!entry) {
    output.error('Inspect entry not found', 'inspect.entry_not_found', { entryId });
    return 1;
  }

  reporter.event('inspect.done', {
    entryId: entry.entryId,
    kind: entry.kind,
  });

  if (output.json) {
    output.data('inspect.entry', entry);
    return 0;
  }

  output.out([
    'Inspect',
    `Entry ID: ${entry.entryId}`,
    `Kind: ${entry.kind}`,
    `Sort Key: ${entry.sortKey}`,
    'Text:',
    entry.text,
  ].join('\n'));
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
    brainstormMode: null,
    brainstormSessionFlag: false,
    brainstormSession: null,
    browseFlag: false,
    browse: null,
    inspectFlag: false,
    inspect: null,
    from: null,
    to: null,
    since: null,
    bucket: null,
    recentCount: null,
    recentQuery: null,
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
      } else if (arg.startsWith('--count=')) {
        options.recentCount = arg.slice('--count='.length);
      } else if (arg.startsWith('--query=')) {
        options.recentQuery = arg.slice('--query='.length);
      } else if (arg.startsWith('--recent-count=')) {
        options.recentCount = arg.slice('--recent-count='.length);
      } else if (arg.startsWith('--recent-query=')) {
        options.recentQuery = arg.slice('--recent-query='.length);
      } else if (arg === '--browse') {
        options.browseFlag = true;
        options.browse = '';
      } else if (arg.startsWith('--browse=')) {
        options.browseFlag = true;
        options.browse = arg.slice('--browse='.length);
      } else if (arg === '--inspect') {
        options.inspectFlag = true;
        options.inspect = '';
      } else if (arg.startsWith('--inspect=')) {
        options.inspectFlag = true;
        options.inspect = arg.slice('--inspect='.length);
      } else if (arg === '--brainstorm' || arg === '--reflect') {
        options.brainstormFlag = true;
        options.brainstorm = '';
      } else if (arg.startsWith('--brainstorm=')) {
        options.brainstormFlag = true;
        options.brainstorm = arg.slice('--brainstorm='.length);
      } else if (arg.startsWith('--reflect=')) {
        options.brainstormFlag = true;
        options.brainstorm = arg.slice('--reflect='.length);
      } else if (arg.startsWith('--mode=')) {
        options.brainstormMode = arg.slice('--mode='.length);
      } else if (arg.startsWith('--brainstorm-mode=')) {
        options.brainstormMode = arg.slice('--brainstorm-mode='.length);
      } else if (arg.startsWith('--reflect-mode=')) {
        options.brainstormMode = arg.slice('--reflect-mode='.length);
      } else if (arg === '--brainstorm-session' || arg === '--reflect-session') {
        options.brainstormSessionFlag = true;
        options.brainstormSession = '';
      } else if (arg.startsWith('--brainstorm-session=')) {
        options.brainstormSessionFlag = true;
        options.brainstormSession = arg.slice('--brainstorm-session='.length);
      } else if (arg.startsWith('--reflect-session=')) {
        options.brainstormSessionFlag = true;
        options.brainstormSession = arg.slice('--reflect-session='.length);
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
  if (options.browseFlag) {
    return 'browse';
  }
  if (options.inspectFlag) {
    return 'inspect';
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
    options.browseFlag,
    options.inspectFlag,
    options.stats,
    options.brainstormFlag,
    options.brainstormSessionFlag,
  ].filter(Boolean).length;
  const hasRecentFilter = options.recentCount !== null || options.recentQuery !== null;

  if (explicitCommands > 1) {
    return 'Commands cannot be combined';
  }

  if (command === 'recent' && options.positionals.length > 0) {
    return '--recent does not take a thought';
  }

  if (command === 'recent') {
    if (options.recentCount !== null && !/^[1-9]\d*$/.test(options.recentCount)) {
      return 'Invalid --count value';
    }
    if (options.recentQuery !== null && options.recentQuery.trim() === '') {
      return 'Invalid --query value';
    }
  }

  if (hasRecentFilter && command !== 'recent') {
    return '--count and --query require --recent';
  }

  if (command === 'browse') {
    if (!options.browse) {
      return '--browse requires an entry id';
    }
    if (options.positionals.length > 0) {
      return '--browse does not take a thought';
    }
  }

  if (command === 'inspect') {
    if (!options.inspect) {
      return '--inspect requires an entry id';
    }
    if (options.positionals.length > 0) {
      return '--inspect does not take a thought';
    }
  }

  if (command === 'stats' && options.positionals.length > 0) {
    return '--stats does not take a thought';
  }

  if (command === 'brainstorm_start') {
    if (options.brainstormMode && !BRAINSTORM_PROMPT_TYPES.includes(options.brainstormMode)) {
      return 'Invalid --mode value';
    }
    if (!options.brainstorm && !canInteractivelyPickBrainstormSeed(options)) {
      return '--reflect requires a seed entry id';
    }
    if (options.positionals.length > 0) {
      return '--reflect does not take a response';
    }
  }

  if (command === 'brainstorm_reply') {
    if (!options.brainstormSession) {
      return '--reflect-session requires a session id';
    }
    if (options.positionals.length === 0) {
      return '--reflect-session requires a response';
    }
  }

  if (options.brainstormMode && command !== 'brainstorm_start') {
    return '--mode requires --reflect or --brainstorm';
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

function normalizeForPicker(text) {
  return String(text).replace(/\s+/g, ' ').trim();
}

async function suggestAlternativeSeeds(repoDir, excludedSeedEntryId) {
  const recentEntries = await listBrainstormableRecent(repoDir);
  return recentEntries
    .filter((entry) => entry.id !== excludedSeedEntryId)
    .slice(0, 2)
    .map((entry) => ({
      entryId: entry.id,
      text: normalizeForPicker(entry.text),
    }));
}

async function pickBrainstormMode() {
  const ctx = initDefaultContext();
  ctx.io.write(renderInteractiveModeIntro(ctx) + '\n');

  return select({
    title: 'Pressure mode',
    maxVisible: 4,
    options: [
      {
        value: 'challenge',
        label: 'Challenge',
        description: 'Test assumptions and failure modes',
      },
      {
        value: 'constraint',
        label: 'Constraint',
        description: 'Force practical limits and scope',
      },
      {
        value: 'sharpen',
        label: 'Sharpen',
        description: 'Clarify the core claim or next move',
      },
    ],
    defaultValue: 'challenge',
    ctx,
  });
}

function formatIneligibleSeedMessage(eligibility, suggestedSeeds) {
  const lines = [
    eligibility.text,
    eligibility.suggestion,
  ];

  if (suggestedSeeds.length > 0) {
    lines.push('');
    lines.push('Try one of these instead:');
    for (const seed of suggestedSeeds) {
      lines.push(`- ${seed.text}`);
    }
  }

  return lines.join('\n');
}

function renderInteractiveSeedIntro(ctx) {
  const header = headerBox('Choose a thought to reflect on', { ctx });
  const body = markdown('**Pick one recent capture that looks like an idea, question, or decision to reflect on.**', { ctx });
  return `${header}\n${body}`;
}

function renderInteractiveModeIntro(ctx) {
  const header = headerBox('Choose how to reflect', { ctx });
  const body = markdown('**Choose how you want to push the seed thought.**', { ctx });
  return `${header}\n${body}`;
}

function renderInteractiveBrainstormIntro(session, ctx) {
  const header = headerBox('Reflect', { ctx });
  const sections = [
    '## Seed',
    session.seedEntry.text,
    '',
    '## Mode',
    `**${capitalize(session.promptType)}**`,
    '',
    '## Why This Question',
    session.selectionReason.text,
    '',
    '## Question',
    `**${session.question}**`,
  ];

  return `${header}\n${markdown(sections.join('\n'), { ctx })}`;
}

function capitalize(value) {
  const text = String(value || '');
  if (text.length === 0) {
    return text;
  }

  return text.charAt(0).toUpperCase() + text.slice(1);
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
      'brainstorm.seed_ineligible',
      'brainstorm.session_not_found',
      'browse.entry_not_found',
      'inspect.entry_not_found',
    ].includes(payload.event)
  ) {
    return 'stderr';
  }

  return 'stdout';
}
