import assert from 'node:assert/strict';
import test from 'node:test';

import Plumbing from '@git-stunts/plumbing';
import { GitGraphAdapter, WarpGraph } from '@git-stunts/git-warp';

import { createThinkContext, runThink } from '../fixtures/think.js';
import { formatResult } from '../fixtures/runtime.js';
import { assertContains, assertFailure, assertSuccess, parseJsonLines } from '../support/assertions.js';

test('new capture writes graph-native relationship edges while preserving compatibility properties', async () => {
  const context = await createThinkContext();
  const thought = 'Graph migration should add edges without stranding current local repos.';

  const capture = runThink(context, ['--verbose', thought]);
  assertSuccess(capture, `Expected capture to succeed.\n${formatResult(capture)}`);

  const events = parseJsonLines(
    capture.stderr,
    'Expected verbose capture to emit valid JSONL trace events.'
  );
  const saved = getEvent(events, 'capture.local_save.done', 'Expected verbose capture to expose the saved raw entry id.');

  const graph = await openThinkGraph(context.localRepoDir);
  const captureProps = await graph.getNodeProps(saved.entryId);
  assert.ok(captureProps, 'Expected captured entry node to exist in the graph.');
  assert.equal(typeof captureProps.thoughtId, 'string', 'Expected compatibility thoughtId property to remain present.');
  assert.equal(typeof captureProps.sessionId, 'string', 'Expected compatibility sessionId property to remain present.');

  const edges = await graph.getEdges();
  assertEdge(
    edges,
    saved.entryId,
    captureProps.thoughtId,
    'expresses',
    'Expected new captures to add an explicit expresses edge to the canonical thought node.'
  );
  assertEdge(
    edges,
    saved.entryId,
    captureProps.sessionId,
    'captured_in',
    'Expected new captures to add an explicit captured_in edge to the attributed session node.'
  );

  const artifactNodes = await listArtifactNodes(graph);
  const seedQuality = artifactNodes.find((node) => node.kind === 'seed_quality' && node.primaryInputId === captureProps.thoughtId);
  assert.ok(seedQuality, 'Expected the first derived bundle to include a seed_quality artifact.');
  assert.equal(seedQuality.primaryInputKind, 'thought', 'Expected seed_quality to keep compatibility provenance fields.');
  assertEdge(
    edges,
    seedQuality.id,
    captureProps.thoughtId,
    'derived_from',
    'Expected thought-derived artifacts to add explicit derived_from edges.'
  );

  const sessionAttribution = artifactNodes.find((node) => node.kind === 'session_attribution' && node.primaryInputId === saved.entryId);
  assert.ok(sessionAttribution, 'Expected the first derived bundle to include a session_attribution artifact.');
  assert.equal(sessionAttribution.primaryInputKind, 'capture', 'Expected session_attribution to keep compatibility provenance fields.');
  assertEdge(
    edges,
    sessionAttribution.id,
    saved.entryId,
    'contextualizes',
    'Expected capture-context artifacts to add explicit contextualizes edges.'
  );
});

test('think --migrate-graph upgrades a version-1 property-linked repo additively', async () => {
  const context = await createThinkContext();
  const legacyThought = 'Legacy property-linked graph data should migrate additively.';
  const { entryId } = captureWithEntryId(context, legacyThought);

  const graph = await openThinkGraph(context.localRepoDir);
  await stripGraphNativeEdges(graph);

  const beforeEdges = await graph.getEdges();
  assert.ok(!beforeEdges.some((edge) => edge.label === 'expresses'),
    'Expected the pre-migration fixture to behave like a version-1 property-linked repo.');

  const migrate = runThink(context, ['--migrate-graph']);
  assertSuccess(migrate, `Expected graph migration to succeed.\n${formatResult(migrate)}`);
  assertContains(migrate, 'Graph migration complete', 'Expected migration to report explicit success.');
  assertContains(migrate, 'graph model version 2', 'Expected migration to report the upgraded graph model generation.');

  const migratedGraph = await openThinkGraph(context.localRepoDir);
  const afterEdges = await migratedGraph.getEdges();
  const captureProps = await migratedGraph.getNodeProps(entryId);
  assert.ok(captureProps, 'Expected the legacy capture node to remain present after migration.');
  assert.equal(typeof captureProps.thoughtId, 'string', 'Expected migration to preserve compatibility thoughtId properties.');
  assert.equal(typeof captureProps.sessionId, 'string', 'Expected migration to preserve compatibility sessionId properties.');
  assertEdge(
    afterEdges,
    entryId,
    captureProps.thoughtId,
    'expresses',
    'Expected migration to add expresses edges for legacy capture nodes.'
  );
  assertEdge(
    afterEdges,
    entryId,
    captureProps.sessionId,
    'captured_in',
    'Expected migration to add captured_in edges for legacy capture nodes.'
  );

  const metadata = await migratedGraph.getNodeProps('meta:graph');
  assert.ok(metadata, 'Expected migration to materialize graph metadata.');
  assert.equal(metadata.graphModelVersion, 2, 'Expected migration to upgrade the repo graph model generation to 2.');
});

test('think --migrate-graph is idempotent and safe to rerun', async () => {
  const context = await createThinkContext();
  captureWithEntryId(context, 'Idempotent graph migration matters for interrupted local repair.');

  const first = runThink(context, ['--migrate-graph']);
  assertSuccess(first, `Expected first graph migration to succeed.\n${formatResult(first)}`);

  let graph = await openThinkGraph(context.localRepoDir);
  const afterFirst = await graph.getEdges();
  const firstCounts = countRelationshipEdges(afterFirst);

  const second = runThink(context, ['--migrate-graph']);
  assertSuccess(second, `Expected repeated graph migration to succeed.\n${formatResult(second)}`);
  assertContains(second, 'No graph migration changes were needed',
    'Expected rerunning migration to report that the repo was already up to date.');

  graph = await openThinkGraph(context.localRepoDir);
  const afterSecond = await graph.getEdges();
  const secondCounts = countRelationshipEdges(afterSecond);

  assert.deepEqual(
    secondCounts,
    firstCounts,
    'Expected rerunning graph migration not to duplicate graph-native relationship edges.'
  );
});

test('capture on a version-1 repo still succeeds and only migrates after the raw local save', async () => {
  const context = await createThinkContext();
  const { entryId: legacyEntryId } = captureWithEntryId(
    context,
    'Legacy capture data should not block preserving the next thought.'
  );

  let graph = await openThinkGraph(context.localRepoDir);
  const legacyCaptureProps = await graph.getNodeProps(legacyEntryId);
  assert.ok(legacyCaptureProps, 'Expected the seeded legacy capture to exist before downgrade.');
  await downgradeGraphToV1(graph);

  const capture = runThink(
    context,
    ['--verbose', 'This fresh capture should survive even if the graph still needs migration.']
  );
  assertSuccess(capture, `Expected capture on a version-1 repo to succeed.\n${formatResult(capture)}`);
  assertContains(capture, 'Saved locally', 'Expected raw capture success to still be reported on an outdated repo.');

  const events = parseJsonLines(
    capture.stderr,
    'Expected verbose capture to emit valid JSONL trace events during post-capture migration.'
  );
  const localSaveDoneIndex = getEventIndex(
    events,
    'capture.local_save.done',
    'Expected capture to report the raw local save before any migration follow-through.'
  );
  const migrationStartIndex = getEventIndex(
    events,
    'graph.migration.start',
    'Expected post-capture graph migration to expose a start event.'
  );
  const migrationDoneIndex = getEventIndex(
    events,
    'graph.migration.done',
    'Expected post-capture graph migration to expose a done event.'
  );

  assert.ok(
    localSaveDoneIndex < migrationStartIndex,
    `Expected raw local save to complete before migration starts.\n${formatResult(capture)}`
  );
  assert.ok(
    migrationStartIndex < migrationDoneIndex,
    `Expected migration start to precede migration completion.\n${formatResult(capture)}`
  );

  graph = await openThinkGraph(context.localRepoDir);
  const metadata = await graph.getNodeProps('meta:graph');
  assert.ok(metadata, 'Expected post-capture migration to leave graph metadata materialized.');
  assert.equal(metadata.graphModelVersion, 2, 'Expected post-capture migration to upgrade the repo back to graph model version 2.');

  const edges = await graph.getEdges();
  assertEdge(
    edges,
    legacyEntryId,
    legacyCaptureProps.thoughtId,
    'expresses',
    'Expected post-capture migration to backfill missing expresses edges for older captures too.'
  );
});

test('graph-native commands fail clearly on an outdated repo outside interactive use', async () => {
  const context = await createThinkContext();
  const { entryId } = captureWithEntryId(
    context,
    'Outdated graph gates should fail clearly for graph-native commands.'
  );

  const graph = await openThinkGraph(context.localRepoDir);
  await downgradeGraphToV1(graph);

  const cases = [
    ['--remember'],
    [`--browse=${entryId}`],
    [`--inspect=${entryId}`],
    [`--reflect=${entryId}`],
  ];

  for (const args of cases) {
    const result = runThink(context, args);
    assertFailure(
      result,
      `Expected ${args.join(' ')} to fail clearly when the repo still uses graph model version 1.`
    );
    assertContains(
      result,
      'Graph migration required. Run think --migrate-graph.',
      `Expected ${args.join(' ')} to direct the user toward explicit migration.`
    );
  }
});

test('think --json emits explicit graph migration required errors for outdated graph-native commands', async () => {
  const context = await createThinkContext();
  const { entryId } = captureWithEntryId(
    context,
    'Agent callers need a structured migration-required contract.'
  );

  const graph = await openThinkGraph(context.localRepoDir);
  await downgradeGraphToV1(graph);

  const inspect = runThink(context, ['--json', `--inspect=${entryId}`]);
  assertFailure(inspect, 'Expected JSON inspect to fail on an outdated graph model.');

  const errorEvents = parseJsonLines(
    inspect.stderr,
    'Expected JSON inspect failure to emit valid JSONL migration-required events.'
  );
  const migrationRequired = getEvent(
    errorEvents,
    'graph.migration_required',
    'Expected JSON inspect to emit a machine-readable graph.migration_required event.'
  );

  assert.equal(migrationRequired.command, 'inspect', 'Expected migration-required payload to name the blocked command.');
  assert.equal(migrationRequired.currentGraphModelVersion, 1, 'Expected migration-required payload to report the current graph model generation.');
  assert.equal(migrationRequired.requiredGraphModelVersion, 2, 'Expected migration-required payload to report the required graph model generation.');
  assert.equal(
    migrationRequired.message,
    'Graph migration required. Run think --migrate-graph.',
    'Expected migration-required payload to reuse the human-readable upgrade instruction.'
  );

  const failure = getEvent(
    errorEvents,
    'cli.failure',
    'Expected JSON inspect migration gating to terminate through the normal CLI failure event.'
  );
  assert.equal(failure.command, 'inspect', 'Expected CLI failure payload to preserve the blocked command identity.');
});

function captureWithEntryId(context, thought) {
  const capture = runThink(context, ['--verbose', thought]);
  assertSuccess(capture, `Expected capture to succeed for thought: ${thought}\n${formatResult(capture)}`);

  const events = parseJsonLines(
    capture.stderr,
    'Expected verbose capture to emit valid JSONL trace events.'
  );
  const saved = getEvent(events, 'capture.local_save.done', 'Expected verbose capture to expose the saved raw entry id.');
  return {
    entryId: saved.entryId,
    result: capture,
  };
}

async function openThinkGraph(repoDir) {
  const plumbing = Plumbing.createDefault({ cwd: repoDir });
  const persistence = new GitGraphAdapter({ plumbing });
  return WarpGraph.open({
    persistence,
    graphName: 'think',
    writerId: 'graph-migration-spec',
  });
}

async function listArtifactNodes(graph) {
  const nodeIds = await graph.getNodes();
  const artifacts = [];

  for (const nodeId of nodeIds) {
    if (!nodeId.startsWith('artifact:')) {
      continue;
    }
    const props = await graph.getNodeProps(nodeId);
    if (!props) {
      continue;
    }
    artifacts.push({
      id: nodeId,
      kind: props.kind,
      primaryInputKind: props.primaryInputKind,
      primaryInputId: props.primaryInputId,
    });
  }

  return artifacts;
}

async function stripGraphNativeEdges(graph) {
  const edges = await graph.getEdges();
  const migrationEdges = edges.filter((edge) => (
    edge.label === 'expresses'
    || edge.label === 'captured_in'
    || edge.label === 'derived_from'
    || edge.label === 'contextualizes'
  ));

  if (migrationEdges.length === 0) {
    return;
  }

  await graph.patch((patch) => {
    for (const edge of migrationEdges) {
      patch.removeEdge(edge.from, edge.to, edge.label);
    }
  });
}

async function downgradeGraphToV1(graph) {
  await stripGraphNativeEdges(graph);

  const graphMeta = await graph.getNodeProps('meta:graph');
  if (!graphMeta) {
    return;
  }

  await graph.patch((patch) => {
    patch
      .setProperty('meta:graph', 'graphModelVersion', 1)
      .setProperty('meta:graph', 'updatedAt', new Date('2026-01-01T00:00:00.000Z').toISOString());
  });
}

function countRelationshipEdges(edges) {
  return edges
    .filter((edge) => (
      edge.label === 'expresses'
      || edge.label === 'captured_in'
      || edge.label === 'derived_from'
      || edge.label === 'contextualizes'
    ))
    .reduce((counts, edge) => {
      counts[edge.label] = (counts[edge.label] ?? 0) + 1;
      return counts;
    }, {});
}

function assertEdge(edges, from, to, label, message) {
  assert.ok(
    edges.some((edge) => edge.from === from && edge.to === to && edge.label === label),
    message
  );
}

function getEvent(events, name, message) {
  const event = events.find((candidate) => candidate.event === name);
  assert.ok(event, message);
  return event;
}

function getEventIndex(events, name, message) {
  const index = events.findIndex((candidate) => candidate.event === name);
  assert.notEqual(index, -1, message);
  return index;
}
