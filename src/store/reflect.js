import {
  CHALLENGE_PROMPTS,
  CONSTRAINT_PROMPTS,
  MAX_REFLECT_STEPS,
  SHARPEN_PROMPTS,
} from './constants.js';
import {
  createEntry,
  createReflectSession,
  normalizeSeed,
  stableHash,
} from './model.js';
import {
  appendIndexedMemoryObject,
  updateIndexedMemoryObject,
} from './native-index.js';
import { openNativeMemory } from './native-runtime.js';
import {
  getReflectSession,
  getStoredEntry,
  openProductReadHandle,
} from './runtime.js';
import { assessReflectability } from './derivation.js';

export async function startReflect(repoDir, seedEntryId, {
  promptType = null,
} = {}) {
  const memory = await openNativeMemory(repoDir);
  const read = await openProductReadHandle(repoDir);
  const planned = await planReflect(read, seedEntryId, { promptType });
  if (!planned.ok) {
    return planned;
  }

  const { promptPlan } = planned;
  const session = createReflectSession(memory.writerId, {
    seedEntryId,
    contrastEntryId: null,
    promptType: promptPlan.promptType,
    question: promptPlan.question,
    selectionReason: promptPlan.selectionReason,
  });

  await appendIndexedMemoryObject(repoDir, {
    id: session.id,
    kind: session.kind,
    facts: {
      kind: session.kind,
      source: session.source,
      channel: session.channel,
      writerId: session.writerId,
      createdAt: session.createdAt,
      sortKey: session.sortKey,
      seedEntryId: session.seedEntryId,
      contrastEntryId: session.contrastEntryId,
      promptType: session.promptType,
      question: session.question,
      selectionReasonKind: session.selectionReason.kind,
      selectionReasonText: session.selectionReason.text,
      maxSteps: session.maxSteps,
      stepCount: 0,
    },
  });

  return Object.freeze({
    ok: true,
    sessionId: session.id,
    seedEntryId: session.seedEntryId,
    contrastEntryId: session.contrastEntryId,
    promptType: session.promptType,
    question: session.question,
    maxSteps: session.maxSteps,
    selectionReason: session.selectionReason,
    seedEntry: planned.seedEntry,
    contrastEntry: null,
  });
}

export async function previewReflect(repoDir, seedEntryId, {
  promptType = null,
} = {}) {
  const read = await openProductReadHandle(repoDir);
  const planned = await planReflect(read, seedEntryId, { promptType });
  if (!planned.ok) {
    return planned;
  }
  return Object.freeze({
    ok: true,
    seedEntryId,
    contrastEntryId: null,
    promptType: planned.promptPlan.promptType,
    question: planned.promptPlan.question,
    maxSteps: MAX_REFLECT_STEPS,
    selectionReason: planned.promptPlan.selectionReason,
    seedEntry: planned.seedEntry,
    contrastEntry: null,
  });
}

export async function saveReflectResponse(repoDir, sessionId, response) {
  const memory = await openNativeMemory(repoDir);
  const read = await openProductReadHandle(repoDir);
  const session = await getReflectSession(read, sessionId);
  if (!session) {
    return null;
  }

  const entry = createEntry(response, memory.writerId, {
    kind: 'reflect',
    source: 'reflect',
    seedEntryId: session.seedEntryId,
    contrastEntryId: session.contrastEntryId,
    sessionId: session.id,
    promptType: session.promptType,
  });

  await appendIndexedMemoryObject(repoDir, {
    id: entry.id,
    kind: entry.kind,
    facts: {
      kind: entry.kind,
      text: entry.text,
      source: entry.source,
      channel: entry.channel,
      writerId: entry.writerId,
      createdAt: entry.createdAt,
      sortKey: entry.sortKey,
      seedEntryId: entry.seedEntryId,
      contrastEntryId: entry.contrastEntryId,
      sessionId: entry.sessionId,
      promptType: entry.promptType,
    },
  });
  await updateIndexedMemoryObject(repoDir, {
    id: session.id,
    kind: session.kind,
    facts: {
      stepCount: session.stepCount + 1,
      updatedAt: entry.createdAt,
    },
  });

  return entry;
}

function selectReflectPrompt(seedEntry, requestedPromptType = null) {
  const normalized = normalizeSeed(seedEntry.text);
  if (requestedPromptType === 'challenge') {
    return buildPromptPlan('challenge', 'requested_challenge', CHALLENGE_PROMPTS, normalized);
  }
  if (requestedPromptType === 'constraint') {
    return buildPromptPlan('constraint', 'requested_constraint', CONSTRAINT_PROMPTS, normalized);
  }
  if (requestedPromptType === 'sharpen') {
    return buildPromptPlan('sharpen', 'requested_sharpen', SHARPEN_PROMPTS, normalized);
  }
  return stableHash(normalized) % 2 === 0
    ? buildPromptPlan('challenge', 'seed_only_challenge', CHALLENGE_PROMPTS, normalized)
    : buildPromptPlan('constraint', 'seed_only_constraint', CONSTRAINT_PROMPTS, normalized);
}

async function planReflect(read, seedEntryId, {
  promptType = null,
} = {}) {
  const seedEntry = await getStoredEntry(read, seedEntryId);
  if (!seedEntry || seedEntry.kind !== 'capture') {
    return Object.freeze({ ok: false, code: 'seed_not_found' });
  }
  const eligibility = assessReflectability(seedEntry.text);
  if (!eligibility.eligible) {
    return Object.freeze({
      ok: false,
      code: 'seed_ineligible',
      seedEntryId,
      seedEntry,
      eligibility,
    });
  }
  return Object.freeze({
    ok: true,
    seedEntry,
    promptPlan: selectReflectPrompt(seedEntry, promptType),
  });
}

function buildPromptPlan(promptType, reasonKind, prompts, normalizedSeed) {
  return Object.freeze({
    promptType,
    selectionReason: Object.freeze({
      kind: reasonKind,
      text: selectionReasonText(promptType, reasonKind),
    }),
    question: prompts[stableHash(normalizedSeed) % prompts.length],
  });
}

function selectionReasonText(promptType, reasonKind) {
  return reasonKind.startsWith('requested_')
    ? `Used the requested ${promptType} prompt family for this reflect session.`
    : `Used a deterministic ${promptType} prompt from the seed thought alone.`;
}
