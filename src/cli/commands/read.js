import { parseJson } from '../../json.js';
import { runBrowseTui, runBrowseTuiScript } from '../../browse-tui.js';
import { hasGitRepo } from '../../git.js';
import { getLocalRepoDir } from '../../paths.js';
import {
  getBrowseWindow,
  getBrowseWindowForRead,
  getGraphModelStatus,
  getGraphModelStatusForRead,
  getPromptMetrics,
  getStats,
  inspectRawEntry,
  inspectRawEntryForRead,
  listRecent,
  loadBrowseChronologyEntriesForRead,
  openProductReadHandle,
  prepareBrowseBootstrapForRead,
  previewReflect,
  rememberThoughts,
  saveReflectResponse,
  startReflect,
} from '../../store.js';
import { shouldUseInteractiveBrowseShell } from '../environment.js';
import { ensureGraphModelReady, ensureGraphModelReadyFromStatus } from '../graph-gate.js';

export async function runStats(output, reporter, options) {
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

export async function runPromptMetrics(output, reporter, options) {
  reporter.event('prompt_metrics.start', { options });

  const promptMetrics = await getPromptMetrics(options);
  reporter.event('prompt_metrics.done', { sessions: promptMetrics.summary.sessions });

  if (output.json) {
    output.data('prompt_metrics.summary', promptMetrics.summary);
    for (const [index, timing] of promptMetrics.timings.entries()) {
      output.data('prompt_metrics.timing', {
        ...timing,
        index,
      });
    }
    if (promptMetrics.buckets) {
      for (const [index, bucket] of promptMetrics.buckets.entries()) {
        output.data('prompt_metrics.bucket', {
          ...bucket,
          index,
        });
      }
    }
    return 0;
  }

  const lines = ['Prompt metrics'];

  if (promptMetrics.summary.sessions === 0) {
    lines.push('No prompt metrics recorded.');
    output.out(lines.join('\n'));
    return 0;
  }

  lines.push(`Sessions: ${promptMetrics.summary.sessions}`);
  lines.push(`Submitted: ${promptMetrics.summary.submitted}`);
  lines.push(`Abandoned empty: ${promptMetrics.summary.abandonedEmpty}`);
  lines.push(`Abandoned started: ${promptMetrics.summary.abandonedStarted}`);
  lines.push(`Hotkey: ${promptMetrics.summary.hotkey}`);
  lines.push(`Menu: ${promptMetrics.summary.menu}`);

  const timingLabels = new Map([
    ['trigger_to_visible_ms', 'Trigger to visible'],
    ['typing_duration_ms', 'Typing duration'],
    ['submit_to_hide_ms', 'Submit to hide'],
    ['submit_to_local_capture_ms', 'Submit to local save'],
  ]);

  for (const timing of promptMetrics.timings) {
    if (timing.medianMs === null || timing.medianMs === undefined) {
      continue;
    }
    lines.push(`${timingLabels.get(timing.metric)} (median): ${timing.medianMs} ms`);
  }

  if (promptMetrics.buckets) {
    for (const bucket of promptMetrics.buckets) {
      const abandoned = bucket.abandonedEmpty + bucket.abandonedStarted;
      lines.push(`${bucket.key}: sessions ${bucket.sessions}, submitted ${bucket.submitted}, abandoned ${abandoned}`);
    }
  }

  output.out(lines.join('\n'));
  return 0;
}

export async function runRecent(output, reporter, options) {
  const repoDir = getLocalRepoDir();

  reporter.event('recent.start', {
    count: options.recentCount === null || options.recentCount === undefined ? null : Number(options.recentCount),
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
    count: options.recentCount === null || options.recentCount === undefined ? null : Number(options.recentCount),
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

export async function runRemember(output, reporter, options) {
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

  if (!await ensureGraphModelReady(repoDir, 'remember', output, reporter, getGraphModelStatus)) {
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

export async function runBrowse(entryId, output, reporter) {
  if (!entryId) {
    if (shouldUseInteractiveBrowseShell(output)) {
      return runInteractiveBrowseShell(output, reporter);
    } 
      output.error('--browse requires an entry id outside interactive TTY use', 'cli.validation_failed', {
        command: 'browse',
      });
    
    return 1;
  }

  const repoDir = getLocalRepoDir();

  reporter.event('browse.start', { entryId });
  if (!hasGitRepo(repoDir)) {
    output.error('Browse entry not found', 'browse.entry_not_found', { entryId });
    return 1;
  }

  if (!await ensureGraphModelReady(repoDir, 'browse', output, reporter, getGraphModelStatus)) {
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

    const scriptedEntryId = scripted.seedEntryId ?? entries[0].id;

    reporter.event('browse.shell_started', { seedEntryId: scriptedEntryId });

    const inspectById = new Map();
    for (const entry of entries) {
      // eslint-disable-next-line no-await-in-loop -- sequential graph reads for each entry
      inspectById.set(entry.id, await inspectRawEntryForRead(read, entry.id));
    }

    const result = await runBrowseTuiScript({
      entries,
      inspectById,
      initialEntryId: scriptedEntryId,
      actions: scripted.actions ?? [],
      previewReflectEntry: (thoughtEntryId, promptType) => previewReflect(repoDir, thoughtEntryId, { promptType }),
      startReflectSession: async (thoughtEntryId, promptType) => {
        const session = await startReflect(repoDir, thoughtEntryId, { promptType });
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
      loadInspectEntry: (thoughtEntryId) => inspectRawEntryForRead(read, thoughtEntryId),
    });

    output.out(result.output);

    reporter.event('browse.shell_finished', { entryId: scriptedEntryId });
    return 0;
  }

  const bootstrap = await prepareBrowseBootstrapForRead(read);
  if (!bootstrap.ok) {
    output.error('No raw captures available to browse', 'browse.entry_not_found');
    return 1;
  }

  const initialEntryId = bootstrap.current.id;

  reporter.event('browse.shell_started', { seedEntryId: initialEntryId });

  await runBrowseTui({
    bootstrap,
    loadBrowseWindow: (thoughtEntryId) => getBrowseWindowForRead(read, thoughtEntryId),
    loadChronologyEntries: () => loadBrowseChronologyEntriesForRead(read),
    loadInspectEntry: (thoughtEntryId) => inspectRawEntryForRead(read, thoughtEntryId),
    previewReflectEntry: (thoughtEntryId, promptType) => previewReflect(repoDir, thoughtEntryId, { promptType }),
    startReflectSession: async (thoughtEntryId, promptType) => {
      const session = await startReflect(repoDir, thoughtEntryId, { promptType });
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

export async function runInspect(entryId, output, reporter) {
  const repoDir = getLocalRepoDir();

  reporter.event('inspect.start', { entryId });
  if (!hasGitRepo(repoDir)) {
    output.error('Inspect entry not found', 'inspect.entry_not_found', { entryId });
    return 1;
  }

  if (!await ensureGraphModelReady(repoDir, 'inspect', output, reporter, getGraphModelStatus)) {
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
  if (entry.captureProvenance) {
    if (entry.captureProvenance.ingress) {
      lines.push(`Ingress: ${entry.captureProvenance.ingress}`);
    }
    if (entry.captureProvenance.sourceApp) {
      lines.push(`Source app: ${entry.captureProvenance.sourceApp}`);
    }
    if (entry.captureProvenance.sourceURL) {
      lines.push(`Source URL: ${entry.captureProvenance.sourceURL}`);
    }
  }
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

function getBrowseTestScript() {
  if (!process.env.THINK_TEST_BROWSE_SCRIPT) {
    return null;
  }

  if (!globalThis.__thinkBrowseTestScript) {
    globalThis.__thinkBrowseTestScript = parseJson(process.env.THINK_TEST_BROWSE_SCRIPT);
  }

  return globalThis.__thinkBrowseTestScript;
}
