import { headerBox, input, markdown, select } from '@flyingrobots/bijou';
import { initDefaultContext } from '@flyingrobots/bijou-node';

import { runBrowseTui, runBrowseTuiScript } from './browse-tui.js';
import { ensureGitRepo, hasGitRepo, pushWarpRefs } from './git.js';
import { getLocalRepoDir, getUpstreamUrl } from './paths.js';
import {
  REFLECT_PROMPT_TYPES,
  finalizeCapturedThought,
  GRAPH_NAME,
  getGraphModelStatus,
  getGraphModelStatusForRead,
  getBrowseWindow,
  getBrowseWindowForRead,
  inspectRawEntry,
  inspectRawEntryForRead,
  listReflectableRecent,
  listRecent,
  loadBrowseChronologyEntries,
  loadBrowseChronologyEntriesForRead,
  migrateGraphModel,
  openProductReadHandle,
  prepareBrowseBootstrap,
  prepareBrowseBootstrapForRead,
  rememberThoughts,
  saveRawCapture,
  previewReflect,
  getStats,
  startReflect,
  saveReflectResponse,
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
    } else if (command === 'remember') {
      exitCode = await runRemember(output, reporter, options);
    } else if (command === 'browse') {
      exitCode = await runBrowse(options.browse, output, reporter);
    } else if (command === 'inspect') {
      exitCode = await runInspect(options.inspect, output, reporter);
    } else if (command === 'migrate_graph') {
      exitCode = await runMigrateGraph(output, reporter);
    } else if (command === 'stats') {
      exitCode = await runStats(output, reporter, options);
    } else if (command === 'reflect_start') {
      exitCode = await runReflectStart(options.reflect, output, reporter, {
        reflectMode: options.reflectMode,
      });
    } else if (command === 'reflect_reply') {
      exitCode = await runReflectReply(
        options.reflectSession,
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

async function runMigrateGraph(output, reporter) {
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

  const graphStatus = repoAlreadyExists
    ? await getGraphModelStatus(repoDir)
    : {
        currentGraphModelVersion: null,
        requiredGraphModelVersion: null,
        migrationRequired: false,
      };

  reporter.event('capture.local_save.start');
  const entry = await saveRawCapture(repoDir, thought);
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

async function runReflectStart(seedEntryId, output, reporter, { reflectMode } = {}) {
  const repoDir = getLocalRepoDir();
  let resolvedSeedEntryId = seedEntryId;
  let resolvedPromptType = reflectMode;

  if (!resolvedSeedEntryId) {
    const pickedSeedEntryId = await pickReflectSeed(repoDir, output, reporter);
    if (!pickedSeedEntryId) {
      return 1;
    }
    resolvedSeedEntryId = pickedSeedEntryId;
  } else if (!hasGitRepo(repoDir)) {
    output.error('Seed entry not found', 'reflect.seed_not_found', { seedEntryId: resolvedSeedEntryId });
    return 1;
  }

  if (!await ensureGraphModelReady(repoDir, 'reflect', output, reporter)) {
    return 1;
  }

  if (!resolvedPromptType && shouldUseInteractiveReflectShell(output)) {
    resolvedPromptType = await pickReflectMode();
    if (!resolvedPromptType) {
      reporter.event('reflect.skipped', {
        seedEntryId: resolvedSeedEntryId,
        reason: 'no_prompt_type_selected',
      });
      if (!output.json) {
        output.out('Reflect skipped');
      }
      return 0;
    }
  }

  const result = await startReflect(repoDir, resolvedSeedEntryId, {
    promptType: resolvedPromptType,
  });
  if (!result.ok && result.code === 'seed_not_found') {
    output.error('Seed entry not found', 'reflect.seed_not_found', { seedEntryId: resolvedSeedEntryId });
    return 1;
  }
  if (!result.ok && result.code === 'seed_ineligible') {
    const suggestedSeeds = await suggestAlternativeReflectSeeds(repoDir, resolvedSeedEntryId);
    const message = formatIneligibleSeedMessage(result.eligibility, suggestedSeeds);
    if (output.json) {
      output.error(message, 'reflect.seed_ineligible', {
        seedEntryId: resolvedSeedEntryId,
        reason: result.eligibility,
        suggestedSeeds,
      });
    } else {
      output.error(message);
      reporter.event('reflect.seed_ineligible', {
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

  reporter.event('reflect.session_started', sessionPayload);

  reporter.event('reflect.prompt', {
    sessionId: session.sessionId,
    promptType: session.promptType,
    question: session.question,
  });

  if (shouldUseInteractiveReflectShell(output)) {
    return runInteractiveReflectShell(session, output, reporter);
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

async function runReflectReply(sessionId, response, output, reporter) {
  if (response.trim() === '') {
    output.error('Reflect response cannot be empty', 'reflect.validation_failed', {
      reason: 'empty_response',
    });
    return 1;
  }

  const repoDir = getLocalRepoDir();
  if (!hasGitRepo(repoDir)) {
    output.error('Reflect session not found', 'reflect.session_not_found', { sessionId });
    return 1;
  }

  if (!await ensureGraphModelReady(repoDir, 'reflect', output, reporter)) {
    return 1;
  }

  const saved = await saveReflectResponse(repoDir, sessionId, response);
  if (!saved) {
    output.error('Reflect session not found', 'reflect.session_not_found', { sessionId });
    return 1;
  }

  reporter.event('reflect.entry_saved', {
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

async function pickReflectSeed(repoDir, output, reporter) {
  if (!isInteractiveReflectAvailable() || output.json) {
    output.error('--reflect requires a seed entry id', 'cli.validation_failed', {
      command: 'reflect_start',
    });
    return null;
  }

  if (!hasGitRepo(repoDir)) {
    output.error('No raw captures available to reflect from', 'reflect.seed_not_found');
    return null;
  }

  const recentEntries = (await listReflectableRecent(repoDir)).slice(0, 9);
  if (recentEntries.length === 0) {
    output.error(
      'No pressure-testable captures available to reflect from',
      'reflect.seed_ineligible',
      {
        reason: {
          kind: 'no_reflectable_recent_captures',
          text: 'No recent captures looked like candidate ideas, questions, or decisions to reflect on.',
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

async function runReflectFromBrowse(seedEntryId, output, reporter, scriptedAction = null) {
  const repoDir = getLocalRepoDir();
  let promptType = null;

  if (scriptedAction && typeof scriptedAction === 'object' && scriptedAction.mode) {
    promptType = scriptedAction.mode;
  } else {
    promptType = await pickReflectMode();
  }

  if (!promptType) {
    reporter.event('reflect.skipped', {
      seedEntryId,
      reason: 'no_prompt_type_selected',
    });
    if (!output.json) {
      output.out('Reflect skipped');
    }
    return 0;
  }

  const result = await startReflect(repoDir, seedEntryId, { promptType });
  if (!result.ok && result.code === 'seed_not_found') {
    output.error('Seed entry not found', 'reflect.seed_not_found', { seedEntryId });
    return 1;
  }
  if (!result.ok && result.code === 'seed_ineligible') {
    const suggestedSeeds = await suggestAlternativeReflectSeeds(repoDir, seedEntryId);
    const message = formatIneligibleSeedMessage(result.eligibility, suggestedSeeds);
    output.error(message, 'reflect.seed_ineligible', {
      seedEntryId,
      reason: result.eligibility,
      suggestedSeeds,
    });
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

  reporter.event('reflect.session_started', sessionPayload);
  reporter.event('reflect.prompt', {
    sessionId: session.sessionId,
    promptType: session.promptType,
    question: session.question,
  });

  writeShellBlock(renderInteractiveReflectIntro(session), output);

  let response = '';
  if (scriptedAction && typeof scriptedAction === 'object') {
    response = scriptedAction.response ?? '';
  } else {
    const ctx = initDefaultContext();
    response = await input({
      title: 'Your response',
      placeholder: 'Push the idea somewhere sharper...',
      ctx,
    });
  }

  if (response.trim() === '') {
    reporter.event('reflect.skipped', {
      sessionId: session.sessionId,
      reason: 'empty_response',
    });
    writeShellBlock(renderInteractiveReflectSkipped(), output);
    return 0;
  }

  return runReflectReply(session.sessionId, response, output, reporter);
}

async function runInteractiveReflectShell(session, output, reporter) {
  writeShellBlock(renderInteractiveReflectIntro(session), output);

  const ctx = initDefaultContext();

  const response = await input({
    title: 'Your response',
    placeholder: 'Push the idea somewhere sharper...',
    ctx,
  });

  if (response.trim() === '') {
    reporter.event('reflect.skipped', {
      sessionId: session.sessionId,
      reason: 'empty_response',
    });
    writeShellBlock(renderInteractiveReflectSkipped(ctx), output);
    return 0;
  }

  return runReflectReply(session.sessionId, response, output, reporter);
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

async function runRemember(output, reporter, options) {
  const repoDir = getLocalRepoDir();
  const query = options.positionals.length > 0 ? options.positionals.join(' ') : null;
  const limit = options.rememberLimit === null ? null : Number.parseInt(options.rememberLimit, 10);
  const brief = options.rememberBrief;

  reporter.event('remember.start', {
    scopeKind: query ? 'query' : 'ambient_project',
    query: query ?? null,
    limit,
    brief,
  });

  if (!hasGitRepo(repoDir)) {
    reporter.event('remember.done', {
      scopeKind: query ? 'query' : 'ambient_project',
      count: 0,
      repoPresent: false,
    });
    if (!output.json) {
      output.out(['Remember', `Scope: ${query ? 'query' : 'current project'}`, 'No remembered thoughts found.'].join('\n'));
    }
    return 0;
  }

  if (!await ensureGraphModelReady(repoDir, 'remember', output, reporter)) {
    return 1;
  }

  const remember = await rememberThoughts(repoDir, {
    cwd: process.cwd(),
    query,
    limit,
    brief,
  });

  reporter.event('remember.done', {
    scopeKind: remember.scope.scopeKind,
    count: remember.matches.length,
    limit,
    brief,
  });

  if (output.json) {
    output.data('remember.scope', remember.scope);
    for (const [index, match] of remember.matches.entries()) {
      output.data('remember.match', {
        ...match,
        index,
      });
    }
    return 0;
  }

  const lines = [
    'Remember',
    `Scope: ${remember.scope.scopeKind === 'query' ? 'query' : 'current project'}`,
  ];

  if (remember.scope.scopeKind === 'query') {
    lines.push(`Query: ${remember.scope.queryText}`);
  }

  if (brief) {
    lines.push('Mode: brief');
  }

  if (remember.matches.length === 0) {
    lines.push('No remembered thoughts found.');
    output.out(lines.join('\n'));
    return 0;
  }

  for (const match of remember.matches) {
    lines.push(match.text);
    if (brief) {
      lines.push(`Entry ID: ${match.entryId}`);
    }
    lines.push(`Why: ${match.reasonText}`);
  }

  output.out(lines.join('\n'));
  return 0;
}

async function runBrowse(entryId, output, reporter) {
  if (!entryId) {
    if (shouldUseInteractiveBrowseShell(output)) {
      return runInteractiveBrowseShell(output, reporter);
    } else {
      output.error('--browse requires an entry id outside interactive TTY use', 'cli.validation_failed', {
        command: 'browse',
      });
    }
    return 1;
  }

  const repoDir = getLocalRepoDir();

  reporter.event('browse.start', { entryId });
  if (!hasGitRepo(repoDir)) {
    output.error('Browse entry not found', 'browse.entry_not_found', { entryId });
    return 1;
  }

  if (!await ensureGraphModelReady(repoDir, 'browse', output, reporter)) {
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
    sessionEntryCount: browseWindow.sessionEntries.length,
    sessionStepCount: browseWindow.sessionSteps.length,
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
    if (browseWindow.sessionContext) {
      output.data('browse.context', browseWindow.sessionContext);
    }
    for (const [index, entry] of browseWindow.sessionEntries.entries()) {
      output.data('browse.session_entry', {
        entryId: entry.id,
        text: entry.text,
        sortKey: entry.sortKey,
        sessionId: browseWindow.sessionContext?.sessionId ?? entry.sessionId ?? null,
        index,
      });
    }
    for (const step of browseWindow.sessionSteps) {
      output.data('browse.session_step', {
        direction: step.direction,
        entryId: step.id,
        text: step.text,
        sortKey: step.sortKey,
        sessionId: browseWindow.sessionContext?.sessionId ?? step.sessionId ?? null,
        sessionPosition: step.sessionPosition,
      });
    }
    return 0;
  }

  const lines = ['Browse', `Current: ${browseWindow.current.text}`];
  if (browseWindow.sessionContext) {
    lines.push(`Session: ${browseWindow.sessionContext.sessionId}`);
    if (browseWindow.sessionContext.sessionPosition && browseWindow.sessionContext.sessionCount) {
      lines.push(
        `Session Position: ${browseWindow.sessionContext.sessionPosition} of ${browseWindow.sessionContext.sessionCount}`
      );
    }
  }
  if (browseWindow.newer) {
    lines.push(`Newer: ${browseWindow.newer.text}`);
  }
  if (browseWindow.older) {
    lines.push(`Older: ${browseWindow.older.text}`);
  }
  for (const step of browseWindow.sessionSteps) {
    const label = step.direction === 'previous' ? 'Previous in session' : 'Next in session';
    lines.push(`${label}: ${step.text}`);
  }
  if (browseWindow.sessionEntries.length > 0) {
    lines.push('Session nearby:');
    for (const entry of browseWindow.sessionEntries) {
      lines.push(`${entry.id}: ${entry.text}`);
    }
  }
  output.out(lines.join('\n'));
  return 0;
}

async function runInteractiveBrowseShell(output, reporter) {
  const repoDir = getLocalRepoDir();

  if (!hasGitRepo(repoDir)) {
    output.error('No raw captures available to browse', 'browse.entry_not_found');
    return 1;
  }

  const read = await openProductReadHandle(repoDir);
  const graphStatus = await getGraphModelStatusForRead(read);

  if (!await ensureGraphModelReadyFromStatus(repoDir, 'browse', graphStatus, output, reporter)) {
    return 1;
  }

  const scripted = getBrowseTestScript();

  if (scripted) {
    const entries = await loadBrowseChronologyEntriesForRead(read);
    if (entries.length === 0) {
      output.error('No raw captures available to browse', 'browse.entry_not_found');
      return 1;
    }

    const initialEntryId = scripted.seedEntryId ?? entries[0].id;

    reporter.event('browse.shell_started', { seedEntryId: initialEntryId });

    const inspectById = new Map();
    for (const entry of entries) {
      inspectById.set(entry.id, await inspectRawEntryForRead(read, entry.id));
    }

    const result = await runBrowseTuiScript({
      entries,
      inspectById,
      initialEntryId,
      actions: scripted.actions ?? [],
      previewReflectEntry: (entryId, promptType) => previewReflect(repoDir, entryId, { promptType }),
      startReflectSession: async (entryId, promptType) => {
        const session = await startReflect(repoDir, entryId, { promptType });
        if (session.ok) {
          reporter.event('reflect.session_started', {
            sessionId: session.sessionId,
            seedEntryId: session.seedEntryId,
            contrastEntryId: session.contrastEntryId ?? null,
            promptType: session.promptType,
            maxSteps: session.maxSteps,
            selectionReason: session.selectionReason,
          });
          reporter.event('reflect.prompt', {
            sessionId: session.sessionId,
            promptType: session.promptType,
            question: session.question,
          });
        }
        return session;
      },
      saveReflectSessionResponse: async (sessionId, response) => {
        const saved = await saveReflectResponse(repoDir, sessionId, response);
        if (saved) {
          reporter.event('reflect.entry_saved', {
            entryId: saved.id,
            kind: saved.kind,
            seedEntryId: saved.seedEntryId,
            contrastEntryId: saved.contrastEntryId ?? null,
            sessionId: saved.sessionId,
            promptType: saved.promptType,
          });
        }
        return saved;
      },
      loadInspectEntry: (entryId) => inspectRawEntryForRead(read, entryId),
    });

    output.out(result.output);

    reporter.event('browse.shell_finished', { entryId: initialEntryId });
    return 0;
  }

  const bootstrap = await prepareBrowseBootstrapForRead(read);
  if (!bootstrap.ok) {
    output.error('No raw captures available to browse', 'browse.entry_not_found');
    return 1;
  }

  const initialEntryId = bootstrap.current.id;

  reporter.event('browse.shell_started', { seedEntryId: initialEntryId });

  const effect = await runBrowseTui({
    bootstrap,
    loadBrowseWindow: (entryId) => getBrowseWindowForRead(read, entryId),
    loadChronologyEntries: () => loadBrowseChronologyEntriesForRead(read),
    loadInspectEntry: (entryId) => inspectRawEntryForRead(read, entryId),
    previewReflectEntry: (entryId, promptType) => previewReflect(repoDir, entryId, { promptType }),
    startReflectSession: async (entryId, promptType) => {
      const session = await startReflect(repoDir, entryId, { promptType });
      if (session.ok) {
        reporter.event('reflect.session_started', {
          sessionId: session.sessionId,
          seedEntryId: session.seedEntryId,
          contrastEntryId: session.contrastEntryId ?? null,
          promptType: session.promptType,
          maxSteps: session.maxSteps,
          selectionReason: session.selectionReason,
        });
        reporter.event('reflect.prompt', {
          sessionId: session.sessionId,
          promptType: session.promptType,
          question: session.question,
        });
      }
      return session;
    },
    saveReflectSessionResponse: async (sessionId, response) => {
      const saved = await saveReflectResponse(repoDir, sessionId, response);
      if (saved) {
        reporter.event('reflect.entry_saved', {
          entryId: saved.id,
          kind: saved.kind,
          seedEntryId: saved.seedEntryId,
          contrastEntryId: saved.contrastEntryId ?? null,
          sessionId: saved.sessionId,
          promptType: saved.promptType,
        });
      }
      return saved;
    },
  });

  reporter.event('browse.shell_finished', { entryId: initialEntryId });
  return 0;
}

async function runInspect(entryId, output, reporter) {
  const repoDir = getLocalRepoDir();

  reporter.event('inspect.start', { entryId });
  if (!hasGitRepo(repoDir)) {
    output.error('Inspect entry not found', 'inspect.entry_not_found', { entryId });
    return 1;
  }

  if (!await ensureGraphModelReady(repoDir, 'inspect', output, reporter)) {
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
    thoughtId: entry.thoughtId,
    receiptCount: countInspectReceipts(entry),
  });

  if (output.json) {
    output.data('inspect.entry', entry);
    if (entry.canonicalThought) {
      output.data('inspect.identity', entry.canonicalThought);
    }
    if (entry.derivedReceipts.length > 0) {
      for (const receipt of entry.derivedReceipts) {
        output.data('inspect.receipt', receipt);
      }
    }
    if (entry.seedQuality) {
      output.data('inspect.receipt', entry.seedQuality);
    }
    if (entry.sessionAttribution) {
      output.data('inspect.receipt', entry.sessionAttribution);
    }
    return 0;
  }

  const lines = [
    'Inspect',
    'Raw',
    `Entry ID: ${entry.entryId}`,
    `Kind: ${entry.kind}`,
    `Sort Key: ${entry.sortKey}`,
    'Text:',
    entry.text,
  ];

  lines.push('Canonical Thought');
  lines.push(`Thought ID: ${entry.thoughtId}`);
  lines.push('Derived');
  if (entry.seedQuality) {
    lines.push(`Seed quality: ${entry.seedQuality.verdict}`);
    lines.push(`Why: ${entry.seedQuality.reasonText}`);
    if (entry.seedQuality.promptFamilies.length > 0) {
      lines.push(`Prompt families: ${entry.seedQuality.promptFamilies.join(', ')}`);
    }
  } else {
    lines.push('Seed quality: pending');
    lines.push('Why: Seed-quality derivation has not been materialized yet.');
  }

  if (entry.derivedReceipts.length > 0) {
    lines.push('Derived receipts:');
    for (const receipt of entry.derivedReceipts) {
      lines.push(
        `Reflect: ${receipt.entryId} (${receipt.promptType}, ${receipt.relation}, session ${receipt.sessionId})`
      );
    }
  }

  lines.push('Context');
  if (entry.sessionAttribution) {
    lines.push(`Session: ${entry.sessionAttribution.sessionId}`);
    lines.push(`Why: ${entry.sessionAttribution.reasonText}`);
  } else {
    lines.push('Session: pending');
    lines.push('Why: Session attribution has not been materialized yet.');
  }

  output.out(lines.join('\n'));
  return 0;
}

function countInspectReceipts(entry) {
  let count = entry.derivedReceipts.length;
  if (entry.seedQuality) {
    count += 1;
  }
  if (entry.sessionAttribution) {
    count += 1;
  }
  return count;
}

function parseArgs(args) {
  const positionals = [];
  const options = {
    verbose: false,
    json: false,
    stats: false,
    recent: false,
    remember: false,
    reflectFlag: false,
    reflect: null,
    reflectMode: null,
    reflectSessionFlag: false,
    reflectSession: null,
    browseFlag: false,
    browse: null,
    inspectFlag: false,
    inspect: null,
    migrateGraph: false,
    from: null,
    to: null,
    since: null,
    bucket: null,
    recentCount: null,
    recentQuery: null,
    rememberLimit: null,
    rememberBrief: false,
    optionError: null,
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
      } else if (arg === '--remember') {
        options.remember = true;
      } else if (arg === '--brief') {
        options.rememberBrief = true;
      } else if (arg.startsWith('--limit=')) {
        options.rememberLimit = arg.slice('--limit='.length);
      } else if (arg.startsWith('--count=')) {
        options.recentCount = arg.slice('--count='.length);
      } else if (arg.startsWith('--query=')) {
        options.recentQuery = arg.slice('--query='.length);
      } else if (arg.startsWith('--recent-count=')) {
        setOptionError(options, 'Use --count instead of --recent-count');
      } else if (arg.startsWith('--recent-query=')) {
        setOptionError(options, 'Use --query instead of --recent-query');
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
      } else if (arg === '--migrate-graph') {
        options.migrateGraph = true;
      } else if (arg === '--reflect') {
        options.reflectFlag = true;
        options.reflect = '';
      } else if (arg === '--brainstorm') {
        setOptionError(options, 'Use --reflect instead of --brainstorm');
      } else if (arg.startsWith('--brainstorm=')) {
        setOptionError(options, 'Use --reflect=<seedEntryId> instead of --brainstorm=<seedEntryId>');
      } else if (arg.startsWith('--reflect=')) {
        options.reflectFlag = true;
        options.reflect = arg.slice('--reflect='.length);
      } else if (arg.startsWith('--mode=')) {
        options.reflectMode = arg.slice('--mode='.length);
      } else if (arg.startsWith('--brainstorm-mode=')) {
        setOptionError(options, 'Use --mode instead of --brainstorm-mode');
      } else if (arg.startsWith('--reflect-mode=')) {
        setOptionError(options, 'Use --mode instead of --reflect-mode');
      } else if (arg === '--reflect-session') {
        options.reflectSessionFlag = true;
        options.reflectSession = '';
      } else if (arg === '--brainstorm-session') {
        setOptionError(options, 'Use --reflect-session instead of --brainstorm-session');
      } else if (arg.startsWith('--brainstorm-session=')) {
        setOptionError(options, 'Use --reflect-session=<sessionId> instead of --brainstorm-session=<sessionId>');
      } else if (arg.startsWith('--reflect-session=')) {
        options.reflectSessionFlag = true;
        options.reflectSession = arg.slice('--reflect-session='.length);
      } else if (arg.startsWith('--from=')) {
        options.from = arg.split('=')[1];
      } else if (arg.startsWith('--to=')) {
        options.to = arg.split('=')[1];
      } else if (arg.startsWith('--since=')) {
        options.since = arg.split('=')[1];
      } else if (arg.startsWith('--bucket=')) {
        options.bucket = arg.split('=')[1];
      } else {
        setOptionError(options, `Unknown option: ${arg}`);
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
  if (options.reflectSessionFlag) {
    return 'reflect_reply';
  }
  if (options.reflectFlag) {
    return 'reflect_start';
  }
  if (options.browseFlag) {
    return 'browse';
  }
  if (options.inspectFlag) {
    return 'inspect';
  }
  if (options.migrateGraph) {
    return 'migrate_graph';
  }
  if (options.remember) {
    return 'remember';
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
  if (options.optionError) {
    return options.optionError;
  }

  const hasStatsFilter = Boolean(options.from || options.to || options.since || options.bucket);
  const hasRememberEnhancement = options.rememberLimit !== null || options.rememberBrief;
  const explicitCommands = [
    options.recent,
    options.remember,
    options.browseFlag,
    options.inspectFlag,
    options.migrateGraph,
    options.stats,
    options.reflectFlag,
    options.reflectSessionFlag,
  ].filter(Boolean).length;
  const hasRecentFilter = options.recentCount !== null || options.recentQuery !== null;

  if (explicitCommands > 1) {
    return 'Commands cannot be combined';
  }

  if (command === 'recent' && options.positionals.length > 0) {
    return '--recent does not take a thought';
  }

  if (command === 'remember' && options.positionals.length > 0 && options.positionals.join(' ').trim() === '') {
    return 'Invalid remember query';
  }

  if (command === 'remember') {
    if (options.rememberLimit !== null && !/^[1-9]\d*$/.test(options.rememberLimit)) {
      return 'Invalid --limit value';
    }
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

  if (hasRememberEnhancement && command !== 'remember') {
    return '--limit and --brief require --remember';
  }

  if (command === 'remember' && hasStatsFilter) {
    return '--from, --to, --since, and --bucket require --stats';
  }

  if (command === 'browse') {
    if (!options.browse && !canInteractivelyOpenBrowseShell(options)) {
      return '--browse requires an entry id outside interactive TTY use';
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

  if (command === 'migrate_graph') {
    if (options.positionals.length > 0) {
      return '--migrate-graph does not take a thought';
    }
    if (hasStatsFilter || hasRecentFilter || options.reflectMode) {
      return '--migrate-graph cannot be combined with other command options';
    }
  }

  if (command === 'stats' && options.positionals.length > 0) {
    return '--stats does not take a thought';
  }

  if (command === 'reflect_start') {
    if (options.reflectMode && !REFLECT_PROMPT_TYPES.includes(options.reflectMode)) {
      return 'Invalid --mode value';
    }
    if (!options.reflect && !canInteractivelyPickReflectSeed(options)) {
      return '--reflect requires a seed entry id';
    }
    if (options.positionals.length > 0) {
      return '--reflect does not take a response';
    }
  }

  if (command === 'reflect_reply') {
    if (!options.reflectSession) {
      return '--reflect-session requires a session id';
    }
    if (options.positionals.length === 0) {
      return '--reflect-session requires a response';
    }
  }

  if (options.reflectMode && command !== 'reflect_start') {
    return '--mode requires --reflect';
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

async function ensureGraphModelReady(repoDir, command, output, reporter) {
  const status = await getGraphModelStatus(repoDir);
  return ensureGraphModelReadyFromStatus(repoDir, command, status, output, reporter);
}

async function ensureGraphModelReadyFromStatus(repoDir, command, status, output, reporter) {
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

function shouldUseInteractiveReflectShell(output) {
  return !output.json && isInteractiveReflectAvailable();
}

function shouldUseInteractiveBrowseShell(output) {
  return !output.json && isInteractiveReflectAvailable();
}

function isInteractiveReflectAvailable() {
  if (process.env.THINK_TEST_INTERACTIVE === '1') {
    return true;
  }

  return process.stdin.isTTY === true && process.stdout.isTTY === true;
}

function canInteractivelyOpenBrowseShell(options) {
  return !options.json && isInteractiveReflectAvailable();
}

function canInteractivelyPickReflectSeed(options) {
  return !options.json && isInteractiveReflectAvailable();
}

function canInteractivelyOfferGraphMigration(output) {
  return !output.json && isInteractiveReflectAvailable();
}

function normalizeForPicker(text) {
  return String(text).replace(/\s+/g, ' ').trim();
}

async function suggestAlternativeReflectSeeds(repoDir, excludedSeedEntryId) {
  const recentEntries = await listReflectableRecent(repoDir);
  return recentEntries
    .filter((entry) => entry.id !== excludedSeedEntryId)
    .slice(0, 2)
    .map((entry) => ({
      entryId: entry.id,
      text: normalizeForPicker(entry.text),
    }));
}

async function pickReflectMode() {
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

async function promptForGraphMigration(command, status) {
  const scriptedDecision = process.env.THINK_TEST_CONFIRM_MIGRATION;
  if (scriptedDecision === 'upgrade' || scriptedDecision === 'cancel') {
    return scriptedDecision;
  }

  const ctx = initDefaultContext();
  ctx.io.write(renderGraphMigrationIntro(command, status, ctx) + '\n');

  return select({
    title: 'Graph upgrade',
    maxVisible: 3,
    options: [
      {
        value: 'upgrade',
        label: 'Upgrade now',
        description: 'Migrate the local thought graph and continue.',
      },
      {
        value: 'cancel',
        label: 'Cancel',
        description: 'Leave the repo unchanged and stop this command.',
      },
    ],
    defaultValue: 'upgrade',
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

function renderInteractiveReflectIntro(session, ctx = initDefaultContext()) {
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

function renderInteractiveReflectSkipped(ctx = initDefaultContext()) {
  return `${headerBox('Reflect skipped', { ctx })}\n${markdown('**No reflect response was saved.**', { ctx })}`;
}

function renderGraphMigrationIntro(command, status, ctx = initDefaultContext()) {
  const header = headerBox('Upgrade thought graph', { ctx });
  const body = markdown(
    [
      '**Your thought graph uses an older model.**',
      '',
      `\`${command}\` needs graph model version ${status.requiredGraphModelVersion} before it can continue.`,
      '',
      `Current graph model version: ${status.currentGraphModelVersion}`,
    ].join('\n'),
    { ctx }
  );

  return `${header}\n${body}`;
}

function renderGraphMigrationProgress({ command, phase, progress }, ctx = initDefaultContext()) {
  const header = headerBox('Upgrading thought graph', { ctx });
  const body = markdown(
    [
      `**Continuing into \`${command}\` once migration finishes.**`,
      '',
      `Progress: \`${renderProgressBar(progress)}\``,
      `Current phase: **${phase}**`,
    ].join('\n'),
    { ctx }
  );

  return `${header}\n${body}`;
}

function renderProgressBar(progress) {
  const clamped = Math.max(0, Math.min(1, Number(progress) || 0));
  const width = 10;
  const filled = Math.round(clamped * width);
  return `[${'#'.repeat(filled)}${'-'.repeat(width - filled)}]`;
}

function writeShellBlock(content, output) {
  if (!content) {
    return;
  }

  output.out(content);
}

function getBrowseTestScript() {
  if (!process.env.THINK_TEST_BROWSE_SCRIPT) {
    return null;
  }

  if (!globalThis.__thinkBrowseTestScript) {
    globalThis.__thinkBrowseTestScript = JSON.parse(process.env.THINK_TEST_BROWSE_SCRIPT);
  }

  return globalThis.__thinkBrowseTestScript;
}

function capitalize(value) {
  const text = String(value || '');
  if (text.length === 0) {
    return text;
  }

  return text.charAt(0).toUpperCase() + text.slice(1);
}

function setOptionError(options, message) {
  if (!options.optionError) {
    options.optionError = message;
  }
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
      'reflect.validation_failed',
      'reflect.seed_not_found',
      'reflect.seed_ineligible',
      'reflect.session_not_found',
      'graph.migration_required',
      'graph.migration_cancelled',
      'graph.migration.failed',
      'browse.entry_not_found',
      'inspect.entry_not_found',
    ].includes(payload.event)
  ) {
    return 'stderr';
  }

  return 'stdout';
}
