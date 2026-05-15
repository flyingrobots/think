import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createCaptureThoughtService,
  createMigrateThoughtGraphService,
} from '../../src/mcp/service.js';

test('MCP capture returns saved locally when post-save followthrough defers', async () => {
  const calls = [];
  const captureThought = createCaptureThoughtService(createDeferredFollowthroughDeps(calls));

  const outcome = await captureThought('Claude should get a fast raw save', {
    provenance: { ingress: 'selected_text', sourceApp: 'Claude' },
  });

  assert.deepEqual(calls, [
    'repoDir',
    'hasGitRepo',
    'ensureGitRepo',
    'getCwd',
    'getCaptureAmbientContext',
    'saveRawCapture',
    'getGraphModelStatus',
    'waitForFollowthrough',
    'getUpstreamUrl',
  ]);
  assert.equal(outcome.structuredContent.status, 'saved_locally');
  assert.equal(outcome.structuredContent.entryId, 'entry:test-claude');
  assert.equal(outcome.structuredContent.backupStatus, 'skipped');
  assert.equal(outcome.structuredContent.migration, null);
  assert.equal(outcome.structuredContent.warnings.length, 1);
});

test('MCP migrate_graph returns a no-op when the graph model is current', async () => {
  const calls = [];
  const migrateThoughtGraph = createMigrateThoughtGraphService({
    getGraphModelStatus: () => record(calls, 'getGraphModelStatus', {
      currentGraphModelVersion: 4,
      requiredGraphModelVersion: 4,
      migrationRequired: false,
    }),
    getLocalRepoDir: () => record(calls, 'repoDir', '/tmp/think-claude'),
    hasGitRepo: () => record(calls, 'hasGitRepo', true),
    migrateGraphModel: () => record(calls, 'migrateGraphModel'),
  });

  const outcome = await migrateThoughtGraph();

  assert.deepEqual(calls, ['repoDir', 'hasGitRepo', 'getGraphModelStatus']);
  assert.deepEqual(outcome.structuredContent, {
    changed: false,
    edgesAdded: 0,
    edgesRemoved: 0,
    graphModelVersion: 4,
    metadataUpdated: false,
  });
});

function createDeferredFollowthroughDeps(calls) {
  return {
    ensureGitRepo: (repoDir) => record(calls, 'ensureGitRepo', repoDir),
    finalizeCapturedThought: () => record(calls, 'finalizeCapturedThought'),
    getAmbientProjectContext: () => record(calls, 'getAmbientProjectContext'),
    getCaptureAmbientContext: (cwd) => ({ cwd: record(calls, 'getCaptureAmbientContext', cwd) }),
    getCwd: () => record(calls, 'getCwd', '/tmp/project'),
    getGraphModelStatus: () => {
      record(calls, 'getGraphModelStatus');
      return new Promise(() => {});
    },
    getLocalRepoDir: () => record(calls, 'repoDir', '/tmp/think-claude'),
    getUpstreamUrl: () => record(calls, 'getUpstreamUrl', ''),
    graphName: 'think',
    hasGitRepo: () => record(calls, 'hasGitRepo', true),
    pushWarpRefs: () => record(calls, 'pushWarpRefs', true),
    saveRawCapture: () => record(calls, 'saveRawCapture', { id: 'entry:test-claude' }),
    waitForFollowthrough: () => record(calls, 'waitForFollowthrough', { status: 'deferred' }),
  };
}

function record(calls, label, value) {
  calls.push(label);
  return value;
}
