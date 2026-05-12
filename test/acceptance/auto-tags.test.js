import assert from 'node:assert/strict';
import test from 'node:test';

import {
  runThink,
  createThinkContext,
} from '../fixtures/think.js';

import {
  assertSuccess,
  assertContains,
  parseJsonLines,
} from '../support/assertions.js';

test('think --topics lists promoted topics after multiple captures share a keyword', async () => {
  const context = await createThinkContext();

  // Capture two thoughts that share "performance"
  assertSuccess(runThink(context, ['capture latency and performance optimization']));
  assertSuccess(runThink(context, ['performance benchmarks show improvement']));

  // Run enrichment to extract tags
  const enrich = runThink(context, ['--enrich']);
  assertSuccess(enrich, 'Expected enrichment to succeed.');

  // Check topics
  const topics = runThink(context, ['--topics']);
  assertSuccess(topics, 'Expected --topics to succeed.');
  assertContains(topics, 'performance', 'Expected "performance" to be a promoted topic.');
});

test('think --json --topics emits JSONL topic list', async () => {
  const context = await createThinkContext();

  assertSuccess(runThink(context, ['architecture decisions for the store layer']));
  assertSuccess(runThink(context, ['architecture review completed']));
  assertSuccess(runThink(context, ['--enrich']));

  const topics = runThink(context, ['--json', '--topics']);
  assertSuccess(topics, 'Expected JSON topics to succeed.');

  const events = parseJsonLines(topics.stdout);
  const topicEvents = events.filter((e) => e.event === 'topics.topic');
  assert.ok(topicEvents.length > 0, 'Expected at least one topic event.');

  for (const event of topicEvents) {
    assert.ok(event.name, 'Expected topic to have a name.');
    assert.ok(typeof event.thoughtCount === 'number', 'Expected topic to have a thoughtCount.');
  }
});
