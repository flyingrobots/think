import { randomUUID } from 'node:crypto';
import os from 'node:os';

import Plumbing from '@git-stunts/plumbing';
import { GitGraphAdapter, WarpGraph } from '@git-stunts/git-warp';

export const GRAPH_NAME = 'think';
const ENTRY_PREFIX = 'entry:';
const BRAINSTORM_SESSION_PREFIX = 'brainstorm:';
const TEXT_MIME = 'text/plain; charset=utf-8';
const MAX_BRAINSTORM_STEPS = 3;
const MIN_SHARED_TERMS_FOR_CONTRAST = 2;
const BRAINSTORM_STOPWORDS = new Set([
  'about',
  'after',
  'again',
  'agent',
  'agents',
  'along',
  'also',
  'because',
  'being',
  'capture',
  'captures',
  'continue',
  'could',
  'first',
  'from',
  'have',
  'idea',
  'ideas',
  'just',
  'later',
  'mode',
  'modes',
  'more',
  'most',
  'need',
  'needs',
  'other',
  'place',
  'really',
  'said',
  'same',
  'should',
  'since',
  'something',
  'still',
  'that',
  'their',
  'there',
  'these',
  'thing',
  'think',
  'thought',
  'thoughts',
  'this',
  'through',
  'using',
  'want',
  'what',
  'when',
  'with',
  'work',
  'works',
  'would',
]);

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

  return entry;
}

export async function startBrainstorm(repoDir, seedEntryId) {
  const graph = await openGraph(repoDir);
  const seedEntry = await getStoredEntry(graph, seedEntryId);

  if (!seedEntry || seedEntry.kind !== 'capture') {
    return null;
  }

  const otherCaptures = (await listEntriesByKind(graph, 'capture'))
    .filter(entry => entry.id !== seedEntryId)
    .sort(compareEntriesNewestFirst);

  const promptPlan = selectBrainstormPrompt(seedEntry, otherCaptures);
  const session = createBrainstormSession(graph.writerId, {
    seedEntryId,
    contrastEntryId: promptPlan.contrastEntry?.id ?? null,
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
    sessionId: session.id,
    seedEntryId: session.seedEntryId,
    contrastEntryId: session.contrastEntryId,
    promptType: session.promptType,
    question: session.question,
    maxSteps: session.maxSteps,
    selectionReason: session.selectionReason,
    seedEntry,
    contrastEntry: promptPlan.contrastEntry ?? null,
  };
}

export async function saveBrainstormResponse(repoDir, sessionId, response) {
  const graph = await openGraph(repoDir);
  const session = await getBrainstormSession(graph, sessionId);

  if (!session) {
    return null;
  }

  const entry = createEntry(response, graph.writerId, {
    kind: 'brainstorm',
    source: 'brainstorm',
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

export async function listRecent(repoDir) {
  const graph = await openGraph(repoDir);
  const captures = await listEntriesByKind(graph, 'capture');

  return captures
    .map(entry => ({
      id: entry.id,
      text: entry.text,
      sortKey: entry.sortKey,
    }))
    .sort(compareEntriesNewestFirst);
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

async function getBrainstormSession(graph, sessionId) {
  const session = await getStoredEntry(graph, sessionId);
  if (!session || session.kind !== 'brainstorm_session') {
    return null;
  }

  return session;
}

async function listEntriesByKind(graph, kind) {
  const nodeIds = await graph.getNodes();
  const entries = [];

  for (const nodeId of nodeIds) {
    if (!nodeId.startsWith(ENTRY_PREFIX) && !nodeId.startsWith(BRAINSTORM_SESSION_PREFIX)) {
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

function createBrainstormSession(writerId, {
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
    id: `${BRAINSTORM_SESSION_PREFIX}${unique}`,
    kind: 'brainstorm_session',
    source: 'brainstorm',
    channel: 'cli',
    writerId,
    createdAt,
    sortKey,
    seedEntryId,
    contrastEntryId,
    promptType,
    question,
    selectionReason,
    maxSteps: MAX_BRAINSTORM_STEPS,
  };
}

function selectBrainstormPrompt(seedEntry, candidateCaptures) {
  const bestContrast = selectMeaningfulContrast(seedEntry, candidateCaptures);

  if (!bestContrast) {
    return {
      promptType: 'constraint',
      contrastEntry: null,
      selectionReason: {
        kind: 'contrast_unavailable',
        text: 'No structurally meaningful contrast was available, so brainstorm fell back to a sharpening constraint.',
      },
      question: 'What constraint would make this idea sharper right now?',
    };
  }

  const contrastEntry = bestContrast.entry;
  const sharedTerms = bestContrast.sharedTerms.slice(0, 3);
  return {
    promptType: 'contrast',
    contrastEntry,
    selectionReason: {
      kind: 'shared_terms',
      text: `Shares terms: ${sharedTerms.join(', ')}`,
    },
    question: `What changes if you apply the logic of "${contrastEntry.text}" to "${seedEntry.text}"?`,
  };
}

function selectMeaningfulContrast(seedEntry, candidateCaptures) {
  const seedTerms = extractLoadBearingTerms(seedEntry.text);
  if (seedTerms.size === 0) {
    return null;
  }

  let best = null;
  for (const candidate of candidateCaptures) {
    const candidateTerms = extractLoadBearingTerms(candidate.text);
    const sharedTerms = [...seedTerms].filter(term => candidateTerms.has(term));

    if (sharedTerms.length < MIN_SHARED_TERMS_FOR_CONTRAST) {
      continue;
    }

    if (!best || sharedTerms.length > best.sharedTerms.length) {
      best = {
        entry: candidate,
        sharedTerms,
      };
    }
  }

  return best;
}

function extractLoadBearingTerms(text) {
  return new Set(
    String(text)
      .toLowerCase()
      .split(/[^a-z0-9]+/g)
      .filter(Boolean)
      .filter(term => term.length >= 4)
      .filter(term => !BRAINSTORM_STOPWORDS.has(term))
  );
}

function compareEntriesNewestFirst(left, right) {
  if (left.sortKey === right.sortKey) {
    return right.id.localeCompare(left.id);
  }

  return right.sortKey.localeCompare(left.sortKey);
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
