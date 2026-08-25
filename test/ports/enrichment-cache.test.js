import assert from 'node:assert/strict';
import test from 'node:test';

import { ensureGitRepo } from '../../src/git.js';
import {
  finalizeCapturedThought,
  saveRawCapture,
} from '../../src/store.js';
import {
  invalidateSearchIndex,
  loadSearchIndex,
} from '../../src/store/queries.js';
import { runEnrichmentPipeline } from '../../src/store/enrichment/runner.js';
import {
  getSingleNeighborId,
  listEntriesByKind,
  openProductReadHandle,
} from '../../src/store/runtime.js';
import { createTempDir } from '../fixtures/tmp.js';

test('enrichment invalidates the per-repo search index after creating keyword nodes', async () => {
  const repoDir = await createTempDir('think-enrichment-index-');
  await ensureGitRepo(repoDir);

  const entry = await saveRawCapture(
    repoDir,
    'git-warp performance optimization should make browse startup faster'
  );
  await finalizeCapturedThought(repoDir, entry.id);

  const before = await loadSearchIndex(repoDir);
  assert.deepEqual(
    before.search('performance'),
    [],
    'Expected the pre-enrichment search index to start empty.'
  );

  const result = await runEnrichmentPipeline(repoDir);
  assert.equal(
    result.receiptsCreated,
    2,
    'Expected enrichment to count both auto_tags and semantic_parse receipts.'
  );

  await assertNativeCaptureRootedEnrichment(repoDir, entry);
  await assertRepeatedEnrichmentIsNoop(repoDir);

  const after = await loadSearchIndex(repoDir);
  assert.ok(
    after.search('performance').includes('performance'),
    'Expected loadSearchIndex to reload keywords after enrichment invalidates the stale trie.'
  );
});

test('search indexes are cached independently per repo', async () => {
  const performanceRepoDir = await createEnrichedRepo(
    'think-enrichment-performance-',
    'performance optimization keeps browse startup fast'
  );
  const latencyRepoDir = await createEnrichedRepo(
    'think-enrichment-latency-',
    'latency budget work should protect capture responsiveness'
  );

  const performanceTrie = await loadSearchIndex(performanceRepoDir);
  const latencyTrie = await loadSearchIndex(latencyRepoDir);

  assert.ok(
    performanceTrie.search('performance').includes('performance'),
    'Expected the first repo index to include its own keyword.'
  );
  assert.deepEqual(
    performanceTrie.search('latency'),
    [],
    'Expected the first repo index not to leak keywords from the second repo.'
  );
  assert.ok(
    latencyTrie.search('latency').includes('latency'),
    'Expected the second repo index to include its own keyword.'
  );
  assert.deepEqual(
    latencyTrie.search('performance'),
    [],
    'Expected the second repo index not to reuse the first repo trie.'
  );
});

async function createEnrichedRepo(prefix, thought) {
  const repoDir = await createTempDir(prefix);
  await ensureGitRepo(repoDir);
  invalidateSearchIndex(repoDir);

  const entry = await saveRawCapture(repoDir, thought);
  await finalizeCapturedThought(repoDir, entry.id);
  await runEnrichmentPipeline(repoDir);

  return repoDir;
}

async function assertRepeatedEnrichmentIsNoop(repoDir) {
  assert.deepEqual(
    await runEnrichmentPipeline(repoDir),
    {
      capturesProcessed: 0,
      topicNodesCreated: 0,
      keywordNodesCreated: 0,
      aboutEdgesAdded: 0,
      mentionsEdgesAdded: 0,
      classifiedEdgesAdded: 0,
      receiptsCreated: 0,
      promotedTopics: [],
    },
    'Expected the persisted native capture cursor to make a repeated enrichment run a no-op.'
  );
  const tagReceipts = await listEntriesByKind(
    await openProductReadHandle(repoDir),
    'auto_tags'
  );
  assert.equal(
    tagReceipts.length,
    1,
    'Expected repeated enrichment not to duplicate its native receipt.'
  );
}

async function assertNativeCaptureRootedEnrichment(repoDir, entry) {
  const read = await openProductReadHandle(repoDir);
  const tagReceipts = await listEntriesByKind(read, 'auto_tags');
  assert.equal(tagReceipts.length, 1, 'Expected one native auto-tags receipt for the capture.');
  assert.equal(tagReceipts[0].primaryInputKind, 'capture');
  assert.equal(tagReceipts[0].primaryInputId, entry.id);
  assert.equal(
    await getSingleNeighborId(read, tagReceipts[0].id, 'outgoing', 'derived_from'),
    entry.id,
    'Expected the native receipt to derive from the stored capture object.'
  );
  assert.equal(
    await read.memory.exists(entry.thoughtId),
    false,
    'Expected content identity to remain a capture fact rather than a legacy thought node.'
  );
}
