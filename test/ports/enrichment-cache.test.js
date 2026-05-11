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
