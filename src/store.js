import { createHash, randomUUID } from 'node:crypto';
import os from 'node:os';

import Plumbing from '@git-stunts/plumbing';
import { GitGraphAdapter, WarpGraph } from '@git-stunts/git-warp';

export const GRAPH_NAME = 'think';
export const REFLECT_PROMPT_TYPES = ['challenge', 'constraint', 'sharpen'];
const ENTRY_PREFIX = 'entry:';
const THOUGHT_PREFIX = 'thought:';
const SESSION_PREFIX = 'session:';
const ARTIFACT_PREFIX = 'artifact:';
const REFLECT_SESSION_PREFIX = 'reflect:';
const LEGACY_BRAINSTORM_SESSION_PREFIX = 'brainstorm:';
const TEXT_MIME = 'text/plain; charset=utf-8';
const MAX_REFLECT_STEPS = 3;
const SESSION_IDLE_GAP_MS = 5 * 60 * 1000;
const DERIVER_NAME = 'think';
const DERIVER_VERSION = '1';
const SCHEMA_VERSION = '1';
const CHALLENGE_PROMPTS = [
  'What assumption is hiding here?',
  'What would make this false in practice?',
  'What part of this is probably wishful thinking?',
];
const CONSTRAINT_PROMPTS = [
  'What if this had to work offline?',
  'What is the smallest shippable version of this?',
  'What if this had to be explained in one sentence?',
];
const SHARPEN_PROMPTS = [
  'What is the actual core claim here?',
  'What is the smallest concrete next move?',
  'What should be cut from this idea?',
];
const REFLECT_MARKERS = [
  /\?/,
  /\b(i wonder|maybe|should|could|would|what if|how might|want to|need to|problem|question|decision|tradeoff|constraint|risk)\b/,
];

export async function captureThought(repoDir, thought) {
  const graph = await openGraph(repoDir);
  const entry = createEntry(thought, graph.writerId, { kind: 'capture', source: 'capture' });

  await graph.patch(async patch => {
    patch
      .addNode(entry.id)
      .setProperty(entry.id, 'kind', entry.kind)
      .setProperty(entry.id, 'source', entry.source)
      .setProperty(entry.id, 'channel', entry.channel)
      .setProperty(entry.id, 'writerId', entry.writerId)
      .setProperty(entry.id, 'createdAt', entry.createdAt)
      .setProperty(entry.id, 'sortKey', entry.sortKey);

    await patch.attachContent(entry.id, thought, { mime: TEXT_MIME });
  });

  await ensureFirstDerivedArtifacts(graph, {
    ...entry,
    text: thought,
  });

  return entry;
}

export async function startReflect(repoDir, seedEntryId, { promptType = null } = {}) {
  const graph = await openGraph(repoDir);
  const planned = await planReflect(graph, seedEntryId, { promptType });

  if (!planned.ok) {
    return planned;
  }

  const promptPlan = planned.promptPlan;
  const session = createReflectSession(graph.writerId, {
    seedEntryId,
    contrastEntryId: null,
    promptType: promptPlan.promptType,
    question: promptPlan.question,
    selectionReason: promptPlan.selectionReason,
  });

  await graph.patch(async patch => {
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
  const graph = await openGraph(repoDir);
  const planned = await planReflect(graph, seedEntryId, { promptType });

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
  const graph = await openGraph(repoDir);
  const session = await getReflectSession(graph, sessionId);

  if (!session) {
    return null;
  }

  const entry = createEntry(response, graph.writerId, {
    kind: 'reflect',
    source: 'reflect',
  });

  entry.seedEntryId = session.seedEntryId;
  entry.contrastEntryId = session.contrastEntryId;
  entry.sessionId = session.id;
  entry.promptType = session.promptType;

  await graph.patch(async patch => {
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

export async function getStats(repoDir, { from, to, since, bucket } = {}) {
  const graph = await openGraph(repoDir);
  const entries = [];

  const now = getCurrentTime();
  const sinceDate = since ? parseSince(since, now) : null;
  const fromDate = from ? new Date(from) : null;
  const toDate = to ? new Date(to) : null;

  if (toDate && to.length <= 10) {
    toDate.setUTCHours(23, 59, 59, 999);
  }

  for (const entry of await listEntriesByKind(graph, 'capture')) {
    const createdAt = new Date(entry.createdAt);

    if (sinceDate && createdAt < sinceDate) continue;
    if (fromDate && createdAt < fromDate) continue;
    if (toDate && createdAt > toDate) continue;

    entries.push({ createdAt });
  }

  if (!bucket) {
    return { total: entries.length };
  }

  const buckets = {};
  for (const entry of entries) {
    const key = formatBucketKey(entry.createdAt, bucket);
    buckets[key] = (buckets[key] || 0) + 1;
  }

  return {
    total: entries.length,
    buckets: Object.entries(buckets)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, count]) => ({ key, count })),
  };
}

export async function listRecent(repoDir, { count = null, query = null } = {}) {
  const graph = await openGraph(repoDir);
  const captures = await listEntriesByKind(graph, 'capture');

  const recent = captures
    .map(entry => ({
      id: entry.id,
      text: entry.text,
      sortKey: entry.sortKey,
      createdAt: entry.createdAt,
      sessionId: entry.sessionId ?? null,
    }))
    .sort(compareEntriesNewestFirst);

  const filtered = query
    ? recent.filter((entry) => matchesRecentQuery(entry.text, query))
    : recent;

  if (count == null) {
    return filtered;
  }

  return filtered.slice(0, count);
}

export async function listReflectableRecent(repoDir) {
  const recent = await listRecent(repoDir);
  return recent.filter((entry) => assessReflectability(entry.text).eligible);
}

export async function getBrowseWindow(repoDir, entryId) {
  const graph = await openGraph(repoDir);
  let currentEntry = await getStoredEntry(graph, entryId);

  if (!currentEntry || currentEntry.kind !== 'capture') {
    return null;
  }

  await ensureFirstDerivedArtifacts(graph, currentEntry);
  currentEntry = await getStoredEntry(graph, entryId);

  const recent = (await listEntriesByKind(graph, 'capture'))
    .map((entry) => ({
      id: entry.id,
      text: entry.text,
      sortKey: entry.sortKey,
      createdAt: entry.createdAt,
      sessionId: entry.sessionId ?? null,
    }))
    .sort(compareEntriesNewestFirst);

  const index = recent.findIndex((entry) => entry.id === entryId);

  if (index === -1) {
    return null;
  }

  const sessionAttribution = await getSessionAttributionReceipt(graph, currentEntry);
  const sessionEntries = sessionAttribution
    ? recent.filter((entry) =>
        entry.id !== entryId && entry.sessionId === sessionAttribution.sessionId)
    : [];

  return {
    current: recent[index],
    newer: index > 0 ? recent[index - 1] : null,
    older: index + 1 < recent.length ? recent[index + 1] : null,
    sessionContext: sessionAttribution
      ? {
          entryId,
          sessionId: sessionAttribution.sessionId,
          reasonKind: sessionAttribution.reasonKind,
          reasonText: sessionAttribution.reasonText,
        }
      : null,
    sessionEntries,
  };
}

export async function inspectRawEntry(repoDir, entryId) {
  const graph = await openGraph(repoDir);
  let entry = await getStoredEntry(graph, entryId);

  if (!entry || entry.kind !== 'capture') {
    return null;
  }

  await ensureFirstDerivedArtifacts(graph, entry);
  entry = await getStoredEntry(graph, entryId);

  const canonicalThought = await getCanonicalThought(graph, entry);
  const seedQuality = await getSeedQualityReceipt(graph, entry);
  const sessionAttribution = await getSessionAttributionReceipt(graph, entry);
  const derivedReceipts = await listDirectDerivedReceipts(graph, entryId);

  return {
    entryId: entry.id,
    thoughtId: canonicalThought?.thoughtId ?? createThoughtId(entry.text),
    kind: 'raw_capture',
    text: entry.text,
    sortKey: entry.sortKey,
    createdAt: entry.createdAt,
    canonicalThought,
    seedQuality,
    sessionAttribution,
    derivedReceipts,
  };
}

export function assessReflectability(text) {
  const seedQuality = deriveSeedQuality(createThoughtId(text), text);

  if (seedQuality.verdict === 'likely_reflectable') {
    return {
      eligible: true,
      kind: 'pressure_testable',
      text: 'This entry looks like a candidate idea, question, or decision that can be pressure-tested.',
    };
  }

  return {
    eligible: false,
    kind: 'not_pressure_testable',
    text: 'This entry looks more like a note than a pressure-testable idea.',
    suggestion: 'Pick a different seed or capture a sharper claim first.',
  };
}

async function openGraph(repoDir) {
  const plumbing = Plumbing.createDefault({ cwd: repoDir });
  const persistence = new GitGraphAdapter({ plumbing });

  return WarpGraph.open({
    persistence,
    graphName: GRAPH_NAME,
    writerId: createWriterId(),
  });
}

async function getStoredEntry(graph, nodeId) {
  const props = await graph.getNodeProps(nodeId);
  if (!props) {
    return null;
  }

  return {
    id: nodeId,
    kind: props.kind,
    source: props.source,
    channel: props.channel,
    writerId: props.writerId,
    createdAt: props.createdAt,
    sortKey: String(props.sortKey || ''),
    thoughtId: props.thoughtId ?? null,
    seedEntryId: props.seedEntryId ?? null,
    contrastEntryId: props.contrastEntryId ?? null,
    sessionId: props.sessionId ?? null,
    promptType: props.promptType ?? null,
    question: props.question ?? null,
    selectionReason: props.selectionReasonKind
      ? {
          kind: props.selectionReasonKind,
          text: props.selectionReasonText ?? '',
        }
      : null,
    stepCount: Number(props.stepCount ?? 0),
    maxSteps: Number(props.maxSteps ?? 0),
    text: await readNodeText(graph, nodeId),
  };
}

async function getReflectSession(graph, sessionId) {
  const session = await getStoredEntry(graph, sessionId);
  if (!session || (session.kind !== 'reflect_session' && session.kind !== 'brainstorm_session')) {
    return null;
  }

  return session;
}

async function listEntriesByKind(graph, kind) {
  const nodeIds = await graph.getNodes();
  const entries = [];

  for (const nodeId of nodeIds) {
    if (
      !nodeId.startsWith(ENTRY_PREFIX)
      && !nodeId.startsWith(REFLECT_SESSION_PREFIX)
      && !nodeId.startsWith(LEGACY_BRAINSTORM_SESSION_PREFIX)
    ) {
      continue;
    }

    const entry = await getStoredEntry(graph, nodeId);
    if (!entry || entry.kind !== kind) {
      continue;
    }

    entries.push(entry);
  }

  return entries;
}

async function listDirectDerivedReceipts(graph, seedEntryId) {
  const reflectEntries = await listEntriesByKind(graph, 'reflect');

  return reflectEntries
    .filter((entry) => entry.seedEntryId === seedEntryId)
    .sort(compareEntriesNewestFirst)
    .map((entry) => ({
      relation: 'seed_of',
      kind: entry.kind,
      entryId: entry.id,
      sessionId: entry.sessionId,
      promptType: entry.promptType,
      createdAt: entry.createdAt,
    }));
}

async function readNodeText(graph, nodeId) {
  const content = await graph.getContent(nodeId);
  return content ? new TextDecoder().decode(content) : '';
}

function createEntry(text, writerId, { kind, source }) {
  const timestamp = getCurrentTime();
  const unique = randomUUID();
  const createdAt = timestamp.toISOString();
  const sortKey = `${String(timestamp.getTime()).padStart(13, '0')}-${unique}`;

  return {
    id: `${ENTRY_PREFIX}${sortKey}`,
    kind,
    source,
    channel: 'cli',
    writerId,
    createdAt,
    sortKey,
    text,
  };
}

function createReflectSession(writerId, {
  seedEntryId,
  contrastEntryId,
  promptType,
  question,
  selectionReason,
}) {
  const timestamp = getCurrentTime();
  const createdAt = timestamp.toISOString();
  const unique = randomUUID();
  const sortKey = `${String(timestamp.getTime()).padStart(13, '0')}-${unique}`;

  return {
    id: `${REFLECT_SESSION_PREFIX}${unique}`,
    kind: 'reflect_session',
    source: 'reflect',
    channel: 'cli',
    writerId,
    createdAt,
    sortKey,
    seedEntryId,
    contrastEntryId,
    promptType,
    question,
    selectionReason,
    maxSteps: MAX_REFLECT_STEPS,
  };
}

async function ensureFirstDerivedArtifacts(graph, entry) {
  if (!entry || entry.kind !== 'capture') {
    return null;
  }

  const thoughtId = createThoughtId(entry.text);
  const seedQuality = deriveSeedQuality(thoughtId, entry.text);
  const sessionAttribution = await deriveSessionAttribution(graph, entry);

  const [
    thoughtNodeExists,
    seedQualityExists,
    sessionNodeExists,
    sessionArtifactExists,
    entryProps,
  ] = await Promise.all([
    hasNode(graph, thoughtId),
    hasNode(graph, seedQuality.artifactId),
    hasNode(graph, sessionAttribution.sessionId),
    hasNode(graph, sessionAttribution.artifactId),
    graph.getNodeProps(entry.id),
  ]);

  const needsCaptureThoughtLink = entryProps?.thoughtId !== thoughtId;
  const needsCaptureSessionLink = entryProps?.sessionId !== sessionAttribution.sessionId;

  if (
    thoughtNodeExists
    && seedQualityExists
    && sessionNodeExists
    && sessionArtifactExists
    && !needsCaptureThoughtLink
    && !needsCaptureSessionLink
  ) {
    return {
      thoughtId,
      seedQuality,
      sessionAttribution,
    };
  }

  await graph.patch(async (patch) => {
    if (!thoughtNodeExists) {
      patch
        .addNode(thoughtId)
        .setProperty(thoughtId, 'kind', 'thought')
        .setProperty(thoughtId, 'fingerprint', thoughtId.slice(THOUGHT_PREFIX.length))
        .setProperty(thoughtId, 'createdAt', entry.createdAt)
        .setProperty(thoughtId, 'schemaVersion', SCHEMA_VERSION);

      await patch.attachContent(thoughtId, entry.text, { mime: TEXT_MIME });
    }

    if (needsCaptureThoughtLink) {
      patch.setProperty(entry.id, 'thoughtId', thoughtId);
    }

    if (!seedQualityExists) {
      addArtifactNode(patch, seedQuality);
    }

    if (!sessionNodeExists) {
      patch
        .addNode(sessionAttribution.sessionId)
        .setProperty(sessionAttribution.sessionId, 'kind', 'session')
        .setProperty(sessionAttribution.sessionId, 'createdAt', sessionAttribution.sessionCreatedAt)
        .setProperty(sessionAttribution.sessionId, 'startSortKey', sessionAttribution.sessionStartSortKey)
        .setProperty(sessionAttribution.sessionId, 'schemaVersion', SCHEMA_VERSION);
    }

    if (needsCaptureSessionLink) {
      patch.setProperty(entry.id, 'sessionId', sessionAttribution.sessionId);
    }

    if (!sessionArtifactExists) {
      addArtifactNode(patch, sessionAttribution);
    }
  });

  return {
    thoughtId,
    seedQuality,
    sessionAttribution,
  };
}

function addArtifactNode(patch, artifact) {
  patch
    .addNode(artifact.artifactId)
    .setProperty(artifact.artifactId, 'kind', artifact.kind)
    .setProperty(artifact.artifactId, 'primaryInputKind', artifact.primaryInputKind)
    .setProperty(artifact.artifactId, 'primaryInputId', artifact.primaryInputId)
    .setProperty(artifact.artifactId, 'deriver', artifact.deriver)
    .setProperty(artifact.artifactId, 'deriverVersion', artifact.deriverVersion)
    .setProperty(artifact.artifactId, 'schemaVersion', artifact.schemaVersion)
    .setProperty(artifact.artifactId, 'createdAt', artifact.createdAt);

  if (artifact.kind === 'seed_quality') {
    patch
      .setProperty(artifact.artifactId, 'verdict', artifact.verdict)
      .setProperty(artifact.artifactId, 'reasonKind', artifact.reasonKind)
      .setProperty(artifact.artifactId, 'reasonText', artifact.reasonText)
      .setProperty(artifact.artifactId, 'promptFamiliesJson', JSON.stringify(artifact.promptFamilies));
    return;
  }

  if (artifact.kind === 'session_attribution') {
    patch
      .setProperty(artifact.artifactId, 'sessionId', artifact.sessionId)
      .setProperty(artifact.artifactId, 'reasonKind', artifact.reasonKind)
      .setProperty(artifact.artifactId, 'reasonText', artifact.reasonText);
  }
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
    const question = pickDeterministicPrompt(CHALLENGE_PROMPTS, normalized);
    return {
      promptType: 'challenge',
      selectionReason: {
        kind: 'seed_only_challenge',
        text: 'Used a deterministic challenge prompt from the seed thought alone.',
      },
      question,
    };
  }

  const question = pickDeterministicPrompt(CONSTRAINT_PROMPTS, normalized);
  return {
    promptType: 'constraint',
    selectionReason: {
      kind: 'seed_only_constraint',
      text: 'Used a deterministic constraint prompt from the seed thought alone.',
    },
    question,
  };
}

async function planReflect(graph, seedEntryId, { promptType = null } = {}) {
  const seedEntry = await getStoredEntry(graph, seedEntryId);

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

function normalizeSeed(text) {
  return String(text).trim().toLowerCase();
}

function createThoughtId(text) {
  const fingerprint = createHash('sha256')
    .update(String(text), 'utf8')
    .digest('hex');

  return `thought:${fingerprint}`;
}

function createArtifactId(kind, primaryInputId, discriminator = '') {
  const fingerprint = createHash('sha256')
    .update([kind, primaryInputId, discriminator, DERIVER_VERSION, SCHEMA_VERSION].join('\0'), 'utf8')
    .digest('hex');

  return `${ARTIFACT_PREFIX}${fingerprint}`;
}

function deriveSeedQuality(thoughtId, text) {
  const normalized = normalizeSeed(text);
  const eligible = REFLECT_MARKERS.some((pattern) => pattern.test(normalized));

  return {
    artifactId: createArtifactId('seed_quality', thoughtId),
    kind: 'seed_quality',
    primaryInputKind: 'thought',
    primaryInputId: thoughtId,
    verdict: eligible ? 'likely_reflectable' : 'weak_note',
    reasonKind: eligible ? 'proposal_or_question_markers' : 'status_like_note',
    reasonText: eligible
      ? 'Contains explicit proposal, uncertainty, or decision language that can be pressure-tested.'
      : 'Reads more like a status, narrative, or observational note than a pressure-testable idea.',
    promptFamilies: eligible ? [...REFLECT_PROMPT_TYPES] : [],
    deriver: DERIVER_NAME,
    deriverVersion: DERIVER_VERSION,
    schemaVersion: SCHEMA_VERSION,
    createdAt: getCurrentTime().toISOString(),
  };
}

async function deriveSessionAttribution(graph, entry) {
  const captures = await listEntriesByKind(graph, 'capture');
  const ordered = captures
    .filter((candidate) => candidate.id !== entry.id)
    .concat([{ ...entry }])
    .sort(compareEntriesOldestFirst);

  let sessionStart = ordered[0];
  let previous = null;

  for (const capture of ordered) {
    if (previous) {
      const gapMs = Date.parse(capture.createdAt) - Date.parse(previous.createdAt);
      if (gapMs > SESSION_IDLE_GAP_MS) {
        sessionStart = capture;
      }
    }

    if (capture.id === entry.id) {
      const withinBucket = previous
        && (Date.parse(capture.createdAt) - Date.parse(previous.createdAt)) <= SESSION_IDLE_GAP_MS;
      const sessionId = `${SESSION_PREFIX}${sessionStart.sortKey}`;

      return {
        artifactId: createArtifactId('session_attribution', entry.id, sessionId),
        kind: 'session_attribution',
        primaryInputKind: 'capture',
        primaryInputId: entry.id,
        sessionId,
        sessionCreatedAt: sessionStart.createdAt,
        sessionStartSortKey: sessionStart.sortKey,
        reasonKind: withinBucket ? 'temporal_proximity' : 'new_session_bucket',
        reasonText: withinBucket
          ? 'Captured within 5 minutes of neighboring entries in the same session bucket.'
          : 'Started a new session bucket because no neighboring capture fell within the 5 minute idle-gap threshold.',
        deriver: DERIVER_NAME,
        deriverVersion: DERIVER_VERSION,
        schemaVersion: SCHEMA_VERSION,
        createdAt: getCurrentTime().toISOString(),
      };
    }

    previous = capture;
  }

  const fallbackSessionId = `${SESSION_PREFIX}${entry.sortKey}`;
  return {
    artifactId: createArtifactId('session_attribution', entry.id, fallbackSessionId),
    kind: 'session_attribution',
    primaryInputKind: 'capture',
    primaryInputId: entry.id,
    sessionId: fallbackSessionId,
    sessionCreatedAt: entry.createdAt,
    sessionStartSortKey: entry.sortKey,
    reasonKind: 'new_session_bucket',
    reasonText: 'Started a new session bucket because no neighboring capture fell within the 5 minute idle-gap threshold.',
    deriver: DERIVER_NAME,
    deriverVersion: DERIVER_VERSION,
    schemaVersion: SCHEMA_VERSION,
    createdAt: getCurrentTime().toISOString(),
  };
}

async function getCanonicalThought(graph, entry) {
  const thoughtId = entry.thoughtId ?? createThoughtId(entry.text);
  const thoughtProps = await graph.getNodeProps(thoughtId);

  return {
    entryId: entry.id,
    thoughtId,
    relation: 'expresses',
    stored: Boolean(thoughtProps),
  };
}

async function getSeedQualityReceipt(graph, entry) {
  const thoughtId = entry.thoughtId ?? createThoughtId(entry.text);
  const artifactId = createArtifactId('seed_quality', thoughtId);
  const props = await graph.getNodeProps(artifactId);
  if (!props) {
    return null;
  }

  return {
    artifactId,
    kind: 'seed_quality',
    primaryInputKind: props.primaryInputKind,
    primaryInputId: props.primaryInputId,
    verdict: props.verdict,
    reasonKind: props.reasonKind,
    reasonText: props.reasonText,
    promptFamilies: parseJsonArray(props.promptFamiliesJson),
    deriver: props.deriver,
    deriverVersion: props.deriverVersion,
    schemaVersion: props.schemaVersion,
    createdAt: props.createdAt,
  };
}

async function getSessionAttributionReceipt(graph, entry) {
  const derived = await deriveSessionAttribution(graph, entry);
  const props = await graph.getNodeProps(derived.artifactId);
  if (!props) {
    return null;
  }

  return {
    artifactId: derived.artifactId,
    kind: 'session_attribution',
    primaryInputKind: props.primaryInputKind,
    primaryInputId: props.primaryInputId,
    sessionId: props.sessionId,
    reasonKind: props.reasonKind,
    reasonText: props.reasonText,
    deriver: props.deriver,
    deriverVersion: props.deriverVersion,
    schemaVersion: props.schemaVersion,
    createdAt: props.createdAt,
  };
}

async function hasNode(graph, nodeId) {
  return Boolean(await graph.getNodeProps(nodeId));
}

function parseJsonArray(value) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function stableHash(value) {
  let hash = 0;
  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash;
}

function compareEntriesNewestFirst(left, right) {
  if (left.sortKey === right.sortKey) {
    return right.id.localeCompare(left.id);
  }

  return right.sortKey.localeCompare(left.sortKey);
}

function compareEntriesOldestFirst(left, right) {
  if (left.sortKey === right.sortKey) {
    return left.id.localeCompare(right.id);
  }

  return left.sortKey.localeCompare(right.sortKey);
}

function matchesRecentQuery(text, query) {
  return String(text).toLowerCase().includes(String(query).trim().toLowerCase());
}

function getCurrentTime() {
  if (process.env.THINK_TEST_NOW) {
    const ms = parseInt(process.env.THINK_TEST_NOW, 10);
    if (!isNaN(ms)) {
      return new Date(ms);
    }
  }
  return new Date();
}

function parseSince(since, now) {
  const match = since.match(/^(\d+)([hdw])$/);
  if (!match) return null;

  const value = parseInt(match[1], 10);
  const unit = match[2];

  const ms = {
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
  }[unit];

  return new Date(now.getTime() - value * ms);
}

function formatBucketKey(date, bucket) {
  const iso = date.toISOString();
  if (bucket === 'hour') return iso.substring(0, 13) + ':00';
  if (bucket === 'day') return iso.substring(0, 10);
  if (bucket === 'week') {
    const day = new Date(date);
    day.setUTCHours(0, 0, 0, 0);
    day.setUTCDate(day.getUTCDate() - day.getUTCDay());
    return day.toISOString().substring(0, 10);
  }
  return iso.substring(0, 10);
}

function createWriterId() {
  const hostname = os.hostname().toLowerCase().replace(/[^a-z0-9._-]+/g, '-');
  const safeHostname = hostname || 'unknown-host';
  return `local.${safeHostname}.cli`;
}
