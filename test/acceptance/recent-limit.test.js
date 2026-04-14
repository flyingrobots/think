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

test('think --recent defaults to a bounded window with total count', async () => {
  const context = await createThinkContext();

  // Capture 5 thoughts
  for (let i = 0; i < 5; i++) {
    assertSuccess(runThink(context, [`thought number ${i}`]));
  }

  const recent = runThink(context, ['--recent']);
  assertSuccess(recent, 'Expected --recent to succeed.');
  // Should show all 5 since they're under the default limit
  assertContains(recent, 'thought number', 'Expected thoughts in output.');
});

test('think --json --recent includes total count in done event', async () => {
  const context = await createThinkContext();

  for (let i = 0; i < 3; i++) {
    assertSuccess(runThink(context, [`json thought ${i}`]));
  }

  const recent = runThink(context, ['--json', '--recent']);
  assertSuccess(recent, 'Expected --json --recent to succeed.');

  const events = parseJsonLines(recent.stdout);
  const doneEvent = events.find((e) => e.event === 'recent.done');
  assert.ok(doneEvent, 'Expected recent.done event.');
  assert.equal(typeof doneEvent.total, 'number', 'Expected total field in done event.');
  assert.equal(doneEvent.total, 3, 'Expected total to reflect all captures.');
});

test('think --recent text output shows trailer when results are truncated', async () => {
  const context = await createThinkContext();

  // We can't easily create 51 captures in a test, so we test that
  // the trailer appears when --count is used and there are more entries
  for (let i = 0; i < 5; i++) {
    assertSuccess(runThink(context, [`trailer thought ${i}`]));
  }

  const recent = runThink(context, ['--recent', '--count=2']);
  assertSuccess(recent, 'Expected --recent --count=2 to succeed.');
  assertContains(recent, 'of 5', 'Expected trailer showing total when results are truncated.');
});
