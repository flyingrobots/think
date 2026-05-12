import assert from 'node:assert/strict';
import test from 'node:test';

import { extractTopics } from '../../src/store/enrichment/auto-tags.js';

// ---------------------------------------------------------------------------
// Topic extraction (pure function, no graph)
// ---------------------------------------------------------------------------

test('extractTopics returns meaningful keywords from thought text', () => {
  const topics = extractTopics('git-warp performance optimization is critical for capture latency');

  assert.ok(topics.includes('performance'), 'Expected "performance" as a topic.');
  assert.ok(topics.includes('optimization'), 'Expected "optimization" as a topic.');
  assert.ok(topics.includes('capture'), 'Expected "capture" as a topic.');
  assert.ok(topics.includes('latency'), 'Expected "latency" as a topic.');
});

test('extractTopics filters out stopwords', () => {
  const topics = extractTopics('the quick brown fox jumps over the lazy dog');

  assert.ok(!topics.includes('the'), 'Expected "the" to be filtered.');
  assert.ok(!topics.includes('over'), 'Expected "over" to be filtered.');
  assert.ok(topics.includes('quick'), 'Expected "quick" to survive.');
  assert.ok(topics.includes('fox'), 'Expected "fox" to survive.');
});

test('extractTopics filters out short tokens', () => {
  const topics = extractTopics('I am on it ok go do');

  for (const topic of topics) {
    assert.ok(topic.length >= 3, `Expected topic "${topic}" to be >= 3 chars.`);
  }
});

test('extractTopics normalizes to lowercase', () => {
  const topics = extractTopics('Think PERFORMANCE Optimization');

  for (const topic of topics) {
    assert.equal(topic, topic.toLowerCase(), `Expected topic "${topic}" to be lowercase.`);
  }
});

test('extractTopics returns empty array for empty text', () => {
  assert.deepEqual(extractTopics(''), []);
  assert.deepEqual(extractTopics('   '), []);
});

test('extractTopics deduplicates repeated words', () => {
  const topics = extractTopics('performance performance performance latency');

  const perfCount = topics.filter((t) => t === 'performance').length;
  assert.equal(perfCount, 1, 'Expected no duplicate topics.');
});

test('extractTopics handles hyphenated terms', () => {
  const topics = extractTopics('git-warp is a graph database');

  assert.ok(
    topics.includes('git-warp') || (topics.includes('git') && topics.includes('warp')),
    'Expected hyphenated terms to be handled.'
  );
});
