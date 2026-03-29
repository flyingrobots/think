import {
  DERIVER_NAME,
  DERIVER_VERSION,
  GRAPH_META_ID,
  GRAPH_MODEL_VERSION,
  REFLECT_MARKERS,
  REFLECT_PROMPT_TYPES,
  SCHEMA_VERSION,
  SESSION_IDLE_GAP_MS,
  SESSION_PREFIX,
} from './constants.js';
import {
  compareEntriesNewestFirst,
  compareEntriesOldestFirst,
  createArtifactId,
  createThoughtId,
  getCurrentTime,
  normalizeSeed,
} from './model.js';
import {
  getLatestCaptureId,
  getProducedInSessionId,
  getStoredEntry,
  hasNode,
  listEntriesByKind,
} from './runtime.js';

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

export async function ensureFirstDerivedArtifacts(app, read, entry) {
  if (!entry || entry.kind !== 'capture') {
    return null;
  }

  const thoughtId = createThoughtId(entry.text);
  const seedQuality = deriveSeedQuality(thoughtId, entry.text);
  const sessionAttribution = await deriveSessionAttribution(read, entry);

  const [
    thoughtNodeExists,
    seedQualityExists,
    sessionNodeExists,
    sessionArtifactExists,
    entryProps,
    graphMetaProps,
  ] = await Promise.all([
    hasNode(read, thoughtId),
    hasNode(read, seedQuality.artifactId),
    hasNode(read, sessionAttribution.sessionId),
    hasNode(read, sessionAttribution.artifactId),
    read.view.getNodeProps(entry.id),
    read.view.getNodeProps(GRAPH_META_ID),
  ]);

  const needsCaptureThoughtLink = entryProps?.thoughtId !== thoughtId;
  const needsCaptureSessionLink = entryProps?.sessionId !== sessionAttribution.sessionId;
  const needsGraphMetadata = !graphMetaProps || graphMetaProps.graphModelVersion !== GRAPH_MODEL_VERSION;

  if (
    thoughtNodeExists
    && seedQualityExists
    && sessionNodeExists
    && sessionArtifactExists
    && !needsCaptureThoughtLink
    && !needsCaptureSessionLink
    && !needsGraphMetadata
  ) {
    return {
      thoughtId,
      seedQuality,
      sessionAttribution,
    };
  }

  await app.patch(async (patch) => {
    ensureGraphMetadataNode(patch, graphMetaProps);

    if (!thoughtNodeExists) {
      patch
        .addNode(thoughtId)
        .setProperty(thoughtId, 'kind', 'thought')
        .setProperty(thoughtId, 'fingerprint', thoughtId.slice('thought:'.length))
        .setProperty(thoughtId, 'createdAt', entry.createdAt)
        .setProperty(thoughtId, 'schemaVersion', SCHEMA_VERSION);

      await patch.attachContent(thoughtId, entry.text, { mime: 'text/plain; charset=utf-8' });
    }

    if (needsCaptureThoughtLink) {
      patch.setProperty(entry.id, 'thoughtId', thoughtId);
    }
    patch.addEdge(entry.id, thoughtId, 'expresses');

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
    patch.addEdge(entry.id, sessionAttribution.sessionId, 'captured_in');

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

export async function ensureCaptureReadEdges(app, read, entryId) {
  const entry = await getStoredEntry(read, entryId);
  if (!entry || entry.kind !== 'capture') {
    return;
  }

  const latestCaptureId = await getLatestCaptureId(read);
  if (latestCaptureId === entry.id) {
    return;
  }

  const latestEntry = latestCaptureId ? await getStoredEntry(read, latestCaptureId) : null;
  if (latestEntry && compareEntriesNewestFirst(entry, latestEntry) >= 0) {
    return;
  }

  const latestCaptureNodes = await read.view.query()
    .match(GRAPH_META_ID)
    .outgoing('latest_capture')
    .run();

  await app.patch((patch) => {
    for (const node of latestCaptureNodes.nodes ?? []) {
      patch.removeEdge(GRAPH_META_ID, node.id, 'latest_capture');
    }

    patch.addEdge(GRAPH_META_ID, entry.id, 'latest_capture');
    if (latestEntry) {
      patch.addEdge(entry.id, latestEntry.id, 'older');
    }
  });
}

export async function listDirectDerivedReceipts(read, seedEntryId) {
  const receipts = [];
  const seenEntryIds = new Set();
  const graphNativeNeighbors = await read.view.query()
    .match(seedEntryId)
    .incoming('responds_to')
    .run();

  for (const neighbor of graphNativeNeighbors.nodes ?? []) {
    const entry = await getStoredEntry(read, neighbor.id, neighbor.props ?? null);
    if (!entry || entry.kind !== 'reflect' || seenEntryIds.has(entry.id)) {
      continue;
    }

    seenEntryIds.add(entry.id);
    receipts.push({
      relation: 'seed_of',
      kind: entry.kind,
      entryId: entry.id,
      sessionId: await getProducedInSessionId(read, entry),
      promptType: entry.promptType,
      createdAt: entry.createdAt,
      sortKey: entry.sortKey,
    });
  }

  const reflectEntries = await listEntriesByKind(read, 'reflect');
  for (const entry of reflectEntries) {
    if (entry.seedEntryId !== seedEntryId || seenEntryIds.has(entry.id)) {
      continue;
    }

    receipts.push({
      relation: 'seed_of',
      kind: entry.kind,
      entryId: entry.id,
      sessionId: entry.sessionId,
      promptType: entry.promptType,
      createdAt: entry.createdAt,
      sortKey: entry.sortKey,
    });
  }

  return receipts
    .sort(compareEntriesNewestFirst)
    .map(({ sortKey, ...receipt }) => receipt);
}

export function deriveSeedQuality(thoughtId, text) {
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

export async function deriveSessionAttribution(read, entry) {
  const captures = await listEntriesByKind(read, 'capture');
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

export async function getCanonicalThought(read, entry) {
  const thoughtId = entry.thoughtId ?? createThoughtId(entry.text);
  const thoughtProps = await read.view.getNodeProps(thoughtId);

  return {
    entryId: entry.id,
    thoughtId,
    relation: 'expresses',
    stored: Boolean(thoughtProps),
  };
}

export async function getSeedQualityReceipt(read, entry) {
  const thoughtId = entry.thoughtId ?? createThoughtId(entry.text);
  const artifactId = createArtifactId('seed_quality', thoughtId);
  const props = await read.view.getNodeProps(artifactId);
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

export async function getSessionAttributionReceipt(read, entry) {
  const thoughtId = entry.sessionId ?? null;
  const artifactId = thoughtId
    ? createArtifactId('session_attribution', entry.id, thoughtId)
    : (await deriveSessionAttribution(read, entry)).artifactId;
  const props = await read.view.getNodeProps(artifactId);
  if (!props) {
    return null;
  }

  return {
    artifactId,
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

export async function getSessionAttributionReceiptIfPresent(read, entry) {
  if (!entry.sessionId) {
    return null;
  }

  const artifactId = createArtifactId('session_attribution', entry.id, entry.sessionId);
  const props = await read.view.getNodeProps(artifactId);
  if (!props) {
    return null;
  }

  return {
    artifactId,
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
    patch.addEdge(artifact.artifactId, artifact.primaryInputId, 'derived_from');
    return;
  }

  if (artifact.kind === 'session_attribution') {
    patch
      .setProperty(artifact.artifactId, 'sessionId', artifact.sessionId)
      .setProperty(artifact.artifactId, 'reasonKind', artifact.reasonKind)
      .setProperty(artifact.artifactId, 'reasonText', artifact.reasonText);
    patch.addEdge(artifact.artifactId, artifact.primaryInputId, 'contextualizes');
  }
}

function ensureGraphMetadataNode(patch, graphMetaProps) {
  if (!graphMetaProps) {
    patch
      .addNode(GRAPH_META_ID)
      .setProperty(GRAPH_META_ID, 'kind', 'graph_meta')
      .setProperty(GRAPH_META_ID, 'createdAt', getCurrentTime().toISOString());
  }

  patch
    .setProperty(GRAPH_META_ID, 'graphModelVersion', GRAPH_MODEL_VERSION)
    .setProperty(GRAPH_META_ID, 'updatedAt', getCurrentTime().toISOString());
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
