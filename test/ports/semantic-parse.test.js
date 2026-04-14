import assert from 'node:assert/strict';
import test from 'node:test';

import { classifyThought } from '../../src/store/enrichment/semantic-parse.js';

// ---------------------------------------------------------------------------
// Classification (pure function, no graph)
// ---------------------------------------------------------------------------

test('classifyThought detects questions', () => {
  const result = classifyThought('How do I improve capture latency?');
  assert.ok(result.classifications.includes('question'));
});

test('classifyThought detects decisions', () => {
  const result = classifyThought('I decided to use git-warp for storage');
  assert.ok(result.classifications.includes('decision'));
});

test('classifyThought detects observations', () => {
  const result = classifyThought('I noticed the splash shader is slow on large terminals');
  assert.ok(result.classifications.includes('observation'));
});

test('classifyThought detects action items', () => {
  const result = classifyThought('Need to fix the browse fade-in single color issue');
  assert.ok(result.classifications.includes('action_item'));
});

test('classifyThought detects ideas', () => {
  const result = classifyThought('What if we added a thought graph visualization?');
  assert.ok(result.classifications.includes('idea'));
});

test('classifyThought detects references', () => {
  const result = classifyThought('See https://github.com/flyingrobots/think for details');
  assert.ok(result.classifications.includes('reference'));
});

test('classifyThought returns unclassified when no pattern matches', () => {
  const result = classifyThought('turkey is good in burritos');
  assert.deepEqual(result.classifications, ['unclassified']);
});

test('classifyThought supports multi-class', () => {
  const result = classifyThought('Should we refactor this? Need to fix the tests too.');
  assert.ok(result.classifications.includes('question'), 'Expected question from "Should".');
  assert.ok(result.classifications.includes('action_item'), 'Expected action_item from "Need to".');
  assert.ok(result.classifications.length >= 2, 'Expected at least 2 classifications.');
});

test('classifyThought returns markers for each match', () => {
  const result = classifyThought('How do I fix this?');
  assert.ok(Array.isArray(result.markers), 'Expected markers array.');
  assert.ok(result.markers.length > 0, 'Expected at least one marker.');
});

test('classifyThought handles empty text', () => {
  const result = classifyThought('');
  assert.deepEqual(result.classifications, ['unclassified']);
});
