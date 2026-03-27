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
