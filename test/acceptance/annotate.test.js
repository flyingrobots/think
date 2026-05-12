import assert from 'node:assert/strict';
import test from 'node:test';

import {
  runThink,
  createThinkContext,
} from '../fixtures/think.js';

import {
  assertSuccess,
  assertFailure,
  assertContains,
  parseJsonLines,
} from '../support/assertions.js';

test('think --annotate attaches a note to an existing capture', async () => {
  const context = await createThinkContext();

  assertSuccess(runThink(context, ['original thought']), 'Expected capture to succeed.');

  const recent = runThink(context, ['--json', '--recent']);
  const events = parseJsonLines(recent.stdout);
  const { entryId } = events.find((e) => e.event === 'recent.entry');

  const annotate = runThink(context, [`--annotate=${entryId}`, 'this was wrong']);
  assertSuccess(annotate, 'Expected annotation to succeed.');
  assertContains(annotate, 'Annotated', 'Expected success message.');
});

test('think --json --annotate emits structured annotation result', async () => {
  const context = await createThinkContext();

  assertSuccess(runThink(context, ['a thought']), 'Expected capture to succeed.');

  const recent = runThink(context, ['--json', '--recent']);
  const events = parseJsonLines(recent.stdout);
  const { entryId } = events.find((e) => e.event === 'recent.entry');

  const annotate = runThink(context, ['--json', `--annotate=${entryId}`, 'my note']);
  assertSuccess(annotate, 'Expected JSON annotation to succeed.');

  const result = parseJsonLines(annotate.stdout);
  const annotateEvent = result.find((e) => e.event === 'annotate.done');
  assert.ok(annotateEvent, 'Expected annotate.done event.');
  assert.ok(annotateEvent.annotationId, 'Expected annotationId in result.');
  assert.equal(annotateEvent.targetEntryId, entryId, 'Expected targetEntryId to match.');
});

test('think --annotate rejects empty annotation text', async () => {
  const context = await createThinkContext();

  assertSuccess(runThink(context, ['thought']), 'Expected capture to succeed.');

  const annotate = runThink(context, ['--annotate=entry:fake', '']);
  assertFailure(annotate, 'Expected empty annotation to fail.');
});

test('think --annotate shows annotation in --inspect output', async () => {
  const context = await createThinkContext();

  assertSuccess(runThink(context, ['inspectable thought']), 'Expected capture to succeed.');

  const recent = runThink(context, ['--json', '--recent']);
  const events = parseJsonLines(recent.stdout);
  const { entryId } = events.find((e) => e.event === 'recent.entry');

  assertSuccess(
    runThink(context, [`--annotate=${entryId}`, 'later reflection']),
    'Expected annotation to succeed.'
  );

  const inspect = runThink(context, [`--inspect=${entryId}`]);
  assertSuccess(inspect, 'Expected inspect to succeed.');
  assertContains(inspect, 'later reflection', 'Expected annotation text in inspect output.');
});
