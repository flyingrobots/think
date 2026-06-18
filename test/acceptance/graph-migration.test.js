import assert from 'node:assert/strict';
import test from 'node:test';

import { createThinkContext, runThink } from '../fixtures/think.js';
import {
  assertContains,
  assertNotContains,
  assertSuccess,
  combinedOutput,
  parseJsonLines,
} from '../support/assertions.js';

test('think --migrate-graph is idempotent on current History data', async () => {
  const context = await createThinkContext();
  captureWithEntryId(context, 'First current History capture.');
  captureWithEntryId(context, 'Second current History capture.');

  const first = runThink(context, ['--migrate-graph']);
  const second = runThink(context, ['--migrate-graph']);

  assertSuccess(first, 'Expected explicit migration to succeed on current History data.');
  assertSuccess(second, 'Expected repeated migration to remain safe.');
  assertContains(second, 'No graph migration changes were needed',
    'Expected repeated migration to report an idempotent no-op.');
});

test('capture followthrough does not report migration failures', async () => {
  const context = await createThinkContext();
  const first = captureWithEntryId(context, 'History captures should preserve chronology.');
  const second = captureWithEntryId(context, 'History captures should advance chronology.');

  assertNotContains(first.result, 'graph.migration.failed',
    'Expected first capture followthrough to avoid migration failure events.');
  assertNotContains(second.result, 'graph.migration.failed',
    'Expected second capture followthrough to avoid migration failure events.');

  const recent = runThink(context, ['--recent', '--count=2']);
  assertSuccess(recent, 'Expected recent reads to succeed after append-only latest pointers.');
  assertChronology(combinedOutput(recent), [
    'History captures should advance chronology.',
    'History captures should preserve chronology.',
  ]);
});

test('inspect and browse read captured History without graph fixture access', async () => {
  const context = await createThinkContext();
  const { entryId } = captureWithEntryId(
    context,
    'History inspection should use supported worldline reads.'
  );

  const inspect = runThink(context, ['--json', `--inspect=${entryId}`]);
  const browse = runThink(context, ['--json', `--browse=${entryId}`]);

  assertSuccess(inspect, 'Expected JSON inspect to read captured History.');
  assertSuccess(browse, 'Expected JSON browse to read captured History.');
  assertEvent(parseJsonLines(inspect.stdout), 'inspect.entry');
  assertEvent(parseJsonLines(browse.stdout), 'browse.entry');
});

test('reflect starts from an eligible captured History seed', async () => {
  const context = await createThinkContext();
  const { entryId } = captureWithEntryId(
    context,
    'We should make History reads use worldline APIs instead of graph fixtures.'
  );

  const reflect = runThink(context, ['--json', `--reflect=${entryId}`]);
  const events = parseJsonLines(`${reflect.stdout}${reflect.stderr}`);

  assertSuccess(reflect, 'Expected reflect start to read the seed through History.');
  assert.equal(assertEvent(events, 'reflect.session_started').seedEntryId, entryId);
  assertEvent(events, 'reflect.prompt');
});

function captureWithEntryId(context, thought) {
  const result = runThink(context, ['--json', thought]);
  const events = parseJsonLines(`${result.stdout}${result.stderr}`);
  const saved = assertEvent(events, 'capture.local_save.done');

  assertSuccess(result, `Expected capture to succeed for: ${thought}`);
  assert.ok(saved.entryId, 'Expected capture event to expose an entry id.');
  return { result, entryId: saved.entryId };
}

function assertEvent(events, eventName) {
  const event = events.find((candidate) => candidate.event === eventName);
  assert.ok(event, `Expected JSONL event: ${eventName}`);
  return event;
}

function assertChronology(output, entries) {
  const positions = entries.map((entry) => output.indexOf(entry));
  for (const position of positions) {
    assert.notEqual(position, -1, `Expected recent output to include all entries.\n${output}`);
  }
  assert.ok(positions[0] < positions[1], `Expected newest capture first.\n${output}`);
}
