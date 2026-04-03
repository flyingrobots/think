import { input, select } from '@flyingrobots/bijou';
import { initDefaultContext } from '@flyingrobots/bijou-node';

import { hasGitRepo } from '../../git.js';
import { getLocalRepoDir } from '../../paths.js';
import {
  listReflectableRecent,
  saveReflectResponse,
  startReflect,
} from '../../store.js';
import { ensureGraphModelReady } from '../graph-gate.js';
import {
  formatIneligibleSeedMessage,
  normalizeForPicker,
  pickReflectMode,
  renderInteractiveReflectIntro,
  renderInteractiveReflectSkipped,
  renderInteractiveSeedIntro,
} from '../interactive.js';
import {
  isInteractiveReflectAvailable,
  shouldUseInteractiveReflectShell,
} from '../environment.js';
import { writeShellBlock } from '../output.js';

export async function runReflectStart(seedEntryId, output, reporter, { reflectMode } = {}) {
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

  if (!await ensureGraphModelReady(repoDir, 'reflect', output, reporter, async () => {
    const { getGraphModelStatus } = await import('../../store.js');
    return getGraphModelStatus(repoDir);
  })) {
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

export async function runReflectReply(sessionId, response, output, reporter) {
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

  if (!await ensureGraphModelReady(repoDir, 'reflect', output, reporter, async () => {
    const { getGraphModelStatus } = await import('../../store.js');
    return getGraphModelStatus(repoDir);
  })) {
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

async function pickReflectSeed(repoDir, output, _reporter) {
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
  ctx.io.write(`${renderInteractiveSeedIntro(ctx)  }\n`);

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

function capitalize(value) {
  const text = String(value || '');
  if (text.length === 0) {
    return text;
  }

  return text.charAt(0).toUpperCase() + text.slice(1);
}
