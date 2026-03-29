import {
  CHALLENGE_PROMPTS,
  CONSTRAINT_PROMPTS,
  MAX_REFLECT_STEPS,
  SHARPEN_PROMPTS,
  TEXT_MIME,
} from './constants.js';
import {
  createEntry,
  createReflectSession,
  normalizeSeed,
  stableHash,
} from './model.js';
import {
  createProductReadHandle,
  getReflectSession,
  getStoredEntry,
  openWarpApp,
} from './runtime.js';
import { assessReflectability } from './derivation.js';

export async function startReflect(repoDir, seedEntryId, { promptType = null } = {}) {
  const app = await openWarpApp(repoDir);
  const read = await createProductReadHandle(app);
  const planned = await planReflect(read, seedEntryId, { promptType });

  if (!planned.ok) {
    return planned;
  }

  const promptPlan = planned.promptPlan;
  const session = createReflectSession(app.writerId, {
    seedEntryId,
    contrastEntryId: null,
    promptType: promptPlan.promptType,
    question: promptPlan.question,
    selectionReason: promptPlan.selectionReason,
  });

  await app.patch(async patch => {
    patch
      .addNode(session.id)
      .setProperty(session.id, 'kind', session.kind)
      .setProperty(session.id, 'source', session.source)
      .setProperty(session.id, 'channel', session.channel)
      .setProperty(session.id, 'writerId', session.writerId)
      .setProperty(session.id, 'createdAt', session.createdAt)
      .setProperty(session.id, 'sortKey', session.sortKey)
      .setProperty(session.id, 'seedEntryId', session.seedEntryId)
      .setProperty(session.id, 'promptType', session.promptType)
      .setProperty(session.id, 'question', session.question)
      .setProperty(session.id, 'selectionReasonKind', session.selectionReason.kind)
      .setProperty(session.id, 'selectionReasonText', session.selectionReason.text)
      .setProperty(session.id, 'maxSteps', session.maxSteps)
      .setProperty(session.id, 'stepCount', 0);

    patch.addEdge(session.id, session.seedEntryId, 'seeded_by');

    if (session.contrastEntryId) {
      patch.setProperty(session.id, 'contrastEntryId', session.contrastEntryId);
    }
  });

  return {
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
  };
}

export async function previewReflect(repoDir, seedEntryId, { promptType = null } = {}) {
  const app = await openWarpApp(repoDir);
  const read = await createProductReadHandle(app);
  const planned = await planReflect(read, seedEntryId, { promptType });

  if (!planned.ok) {
    return planned;
  }

  return {
    ok: true,
    seedEntryId,
    contrastEntryId: null,
    promptType: planned.promptPlan.promptType,
    question: planned.promptPlan.question,
    maxSteps: MAX_REFLECT_STEPS,
    selectionReason: planned.promptPlan.selectionReason,
    seedEntry: planned.seedEntry,
    contrastEntry: null,
  };
}

export async function saveReflectResponse(repoDir, sessionId, response) {
  const app = await openWarpApp(repoDir);
  const read = await createProductReadHandle(app);
  const session = await getReflectSession(read, sessionId);

  if (!session) {
    return null;
  }

  const entry = createEntry(response, app.writerId, {
    kind: 'reflect',
    source: 'reflect',
  });

  entry.seedEntryId = session.seedEntryId;
  entry.contrastEntryId = session.contrastEntryId;
  entry.sessionId = session.id;
  entry.promptType = session.promptType;

  await app.patch(async patch => {
    patch
      .addNode(entry.id)
      .setProperty(entry.id, 'kind', entry.kind)
      .setProperty(entry.id, 'source', entry.source)
      .setProperty(entry.id, 'channel', entry.channel)
      .setProperty(entry.id, 'writerId', entry.writerId)
      .setProperty(entry.id, 'createdAt', entry.createdAt)
      .setProperty(entry.id, 'sortKey', entry.sortKey)
      .setProperty(entry.id, 'seedEntryId', entry.seedEntryId)
      .setProperty(entry.id, 'sessionId', entry.sessionId)
      .setProperty(entry.id, 'promptType', entry.promptType);

    patch
      .addEdge(entry.id, entry.sessionId, 'produced_in')
      .addEdge(entry.id, entry.seedEntryId, 'responds_to');

    if (entry.contrastEntryId) {
      patch.setProperty(entry.id, 'contrastEntryId', entry.contrastEntryId);
    }

    patch
      .setProperty(session.id, 'stepCount', session.stepCount + 1)
      .setProperty(session.id, 'updatedAt', entry.createdAt);

    await patch.attachContent(entry.id, response, { mime: TEXT_MIME });
  });

  return entry;
}

function selectReflectPrompt(seedEntry, requestedPromptType = null) {
  const normalized = normalizeSeed(seedEntry.text);

  if (requestedPromptType === 'challenge') {
    return {
      promptType: 'challenge',
      selectionReason: {
        kind: 'requested_challenge',
        text: 'Used the requested challenge prompt family for this reflect session.',
      },
      question: pickDeterministicPrompt(CHALLENGE_PROMPTS, normalized),
    };
  }

  if (requestedPromptType === 'constraint') {
    return {
      promptType: 'constraint',
      selectionReason: {
        kind: 'requested_constraint',
        text: 'Used the requested constraint prompt family for this reflect session.',
      },
      question: pickDeterministicPrompt(CONSTRAINT_PROMPTS, normalized),
    };
  }

  if (requestedPromptType === 'sharpen') {
    return {
      promptType: 'sharpen',
      selectionReason: {
        kind: 'requested_sharpen',
        text: 'Used the requested sharpen prompt family for this reflect session.',
      },
      question: pickDeterministicPrompt(SHARPEN_PROMPTS, normalized),
    };
  }

  const familyIndex = stableHash(normalized) % 2;

  if (familyIndex === 0) {
    return {
      promptType: 'challenge',
      selectionReason: {
        kind: 'seed_only_challenge',
        text: 'Used a deterministic challenge prompt from the seed thought alone.',
      },
      question: pickDeterministicPrompt(CHALLENGE_PROMPTS, normalized),
    };
  }

  return {
    promptType: 'constraint',
    selectionReason: {
      kind: 'seed_only_constraint',
      text: 'Used a deterministic constraint prompt from the seed thought alone.',
    },
    question: pickDeterministicPrompt(CONSTRAINT_PROMPTS, normalized),
  };
}

async function planReflect(read, seedEntryId, { promptType = null } = {}) {
  const seedEntry = await getStoredEntry(read, seedEntryId);

  if (!seedEntry || seedEntry.kind !== 'capture') {
    return {
      ok: false,
      code: 'seed_not_found',
    };
  }

  const eligibility = assessReflectability(seedEntry.text);
  if (!eligibility.eligible) {
    return {
      ok: false,
      code: 'seed_ineligible',
      seedEntryId,
      seedEntry,
      eligibility,
    };
  }

  return {
    ok: true,
    seedEntry,
    promptPlan: selectReflectPrompt(seedEntry, promptType),
  };
}

function pickDeterministicPrompt(prompts, normalizedSeed) {
  const index = stableHash(normalizedSeed) % prompts.length;
  return prompts[index];
}
