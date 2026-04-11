import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import test from 'node:test';

import {
  runThink,
  createThinkContext,
} from '../fixtures/think.js';

import {
  assertSuccess,
  assertFailure,
  assertContains,
  combinedOutput,
  parseJsonLines,
} from '../support/assertions.js';

test('think --stats prints total thoughts', async () => {
  const context = await createThinkContext();

  assertSuccess(runThink(context, ['first thought']), 'Expected capture to succeed.');
  assertSuccess(runThink(context, ['second thought']), 'Expected capture to succeed.');

  const stats = runThink(context, ['--stats']);
  assertSuccess(stats, 'Expected stats to succeed.');
  assertContains(stats, 'Total thoughts: 2', 'Expected stats to report the total count of captures.');
});

test('think --stats does not bootstrap local state before the first capture', async () => {
  const context = await createThinkContext();

  const stats = runThink(context, ['--stats']);

  assertSuccess(stats, 'Expected stats to succeed before the first capture.');
  assertContains(stats, 'Total thoughts: 0', 'Expected zero thoughts before the first capture.');
  if (existsSync(context.localRepoDir)) {
    throw new Error(`Expected --stats to remain read-only, but repo was created at ${context.localRepoDir}.`);
  }
});

test('think "stats" is captured as a thought rather than triggering the command', async () => {
  const context = await createThinkContext();

  assertSuccess(runThink(context, ['stats']), 'Expected "stats" to be captured as a thought.');
  
  const recent = runThink(context, ['--recent']);
  assertContains(recent, 'stats', 'Expected the word "stats" to be in the recent list.');

  const stats = runThink(context, ['--stats']);
  assertContains(stats, 'Total thoughts: 1', 'Expected exactly one capture.');
});

test('think --stats rejects an unexpected thought argument', async () => {
  const context = await createThinkContext();

  const stats = runThink(context, ['--stats', 'this should not be dropped']);

  assertFailure(stats, 'Expected --stats with a thought argument to fail rather than silently discard it.');
  assertContains(stats, '--stats does not take a thought', 'Expected a clear validation error for mixed command and capture input.');
  if (existsSync(context.localRepoDir)) {
    throw new Error(`Expected invalid --stats usage to avoid bootstrapping local state at ${context.localRepoDir}.`);
  }
});

test('think stats supports --since filter', async () => {
  const context = await createThinkContext();

  // We need a way to seed thoughts in the past for this to be truly testable,
  // or just test that it filters out things.
  // For now, let's assume we can inject a clock.
  const now = new Date('2026-03-22T12:00:00Z').getTime();

  // Thought from 2 hours ago
  assertSuccess(runThink(context, ['old thought'], { THINK_TEST_NOW: String(now - 2 * 60 * 60 * 1000) }));
  // Thought from now
  assertSuccess(runThink(context, ['new thought'], { THINK_TEST_NOW: String(now) }));

  const stats = runThink(context, ['--stats', '--since=1h'], { THINK_TEST_NOW: String(now) });
  assertSuccess(stats, 'Expected stats --since to succeed.');
  assertContains(stats, 'Total thoughts: 1', 'Expected stats to filter out the older thought.');
});

test('think --stats rejects an invalid --since value', async () => {
  const context = await createThinkContext();

  const stats = runThink(context, ['--stats', '--since=7days']);

  assertFailure(stats, 'Expected invalid --since to fail rather than silently returning misleading totals.');
  assertContains(stats, 'Invalid --since value', 'Expected a clear validation error for invalid relative windows.');
});

test('think stats supports --from and --to filters', async () => {
  const context = await createThinkContext();

  const t1 = new Date('2026-03-20T12:00:00Z').getTime();
  const t2 = new Date('2026-03-21T12:00:00Z').getTime();
  const t3 = new Date('2026-03-22T12:00:00Z').getTime();

  assertSuccess(runThink(context, ['t1 thought'], { THINK_TEST_NOW: String(t1) }));
  assertSuccess(runThink(context, ['t2 thought'], { THINK_TEST_NOW: String(t2) }));
  assertSuccess(runThink(context, ['t3 thought'], { THINK_TEST_NOW: String(t3) }));

  const stats = runThink(context, ['--stats', '--from=2026-03-21', '--to=2026-03-21']);
  assertSuccess(stats, 'Expected stats --from --to to succeed.');
  assertContains(stats, 'Total thoughts: 1', 'Expected stats to filter entries within the range.');
});

test('think --stats rejects invalid absolute date filters', async () => {
  const context = await createThinkContext();

  const stats = runThink(context, ['--stats', '--from=not-a-date', '--to=2026-03-21']);

  assertFailure(stats, 'Expected invalid --from to fail rather than silently broadening the stats window.');
  assertContains(stats, 'Invalid --from value', 'Expected a clear validation error for invalid absolute dates.');
});

test('think stats supports --bucket=day', async () => {
  const context = await createThinkContext();

  const d1 = new Date('2026-03-20T12:00:00Z').getTime();
  const d2 = new Date('2026-03-21T12:00:00Z').getTime();

  assertSuccess(runThink(context, ['d1a'], { THINK_TEST_NOW: String(d1) }));
  assertSuccess(runThink(context, ['d1b'], { THINK_TEST_NOW: String(d1 + 1000) }));
  assertSuccess(runThink(context, ['d2a'], { THINK_TEST_NOW: String(d2) }));

  const stats = runThink(context, ['--stats', '--bucket=day']);
  assertSuccess(stats, 'Expected stats --bucket=day to succeed.');
  assertContains(stats, '2026-03-21: 1', 'Expected count for day 2.');
  assertContains(stats, '2026-03-20: 2', 'Expected count for day 1.');
});

test('think --stats --bucket=day includes a sparkline in text output', async () => {
  const context = await createThinkContext();

  const d1 = new Date('2026-03-20T12:00:00Z').getTime();
  const d2 = new Date('2026-03-21T12:00:00Z').getTime();

  assertSuccess(runThink(context, ['d1a'], { THINK_TEST_NOW: String(d1) }));
  assertSuccess(runThink(context, ['d1b'], { THINK_TEST_NOW: String(d1 + 1000) }));
  assertSuccess(runThink(context, ['d2a'], { THINK_TEST_NOW: String(d2) }));

  const stats = runThink(context, ['--stats', '--bucket=day']);
  assertSuccess(stats, 'Expected stats --bucket=day to succeed.');
  assertContains(stats, 'Capture frequency:', 'Expected sparkline label in bucketed stats output.');
});

test('think --stats --bucket=day --json includes sparkline in stats.total event', async () => {
  const context = await createThinkContext();

  const d1 = new Date('2026-03-20T12:00:00Z').getTime();
  const d2 = new Date('2026-03-21T12:00:00Z').getTime();

  assertSuccess(runThink(context, ['d1a'], { THINK_TEST_NOW: String(d1) }));
  assertSuccess(runThink(context, ['d1b'], { THINK_TEST_NOW: String(d1 + 1000) }));
  assertSuccess(runThink(context, ['d2a'], { THINK_TEST_NOW: String(d2) }));

  const stats = runThink(context, ['--stats', '--bucket=day', '--json']);
  assertSuccess(stats, 'Expected stats --bucket=day --json to succeed.');

  const events = parseJsonLines(stats.stdout);
  const totalEvent = events.find((e) => e.event === 'stats.total');
  assert.ok(totalEvent, 'Expected a stats.total event in JSON output.');
  assert.ok(totalEvent.sparkline, 'Expected stats.total event to include a sparkline field.');
  assert.match(
    totalEvent.sparkline,
    /[▁▂▃▄▅▆▇█]+/,
    'Expected sparkline field to contain Unicode block characters.'
  );
});

test('think --stats without --bucket omits sparkline', async () => {
  const context = await createThinkContext();

  assertSuccess(runThink(context, ['thought']));

  const stats = runThink(context, ['--stats']);
  assertSuccess(stats, 'Expected stats to succeed.');

  const output = combinedOutput(stats);
  assert.doesNotMatch(
    output,
    /Capture frequency:/,
    'Expected no sparkline label when no bucket is specified.'
  );
});

test('think --stats rejects an invalid bucket value', async () => {
  const context = await createThinkContext();

  const stats = runThink(context, ['--stats', '--bucket=month']);

  assertFailure(stats, 'Expected an invalid bucket to fail rather than silently falling back to a different grouping.');
  assertContains(stats, 'Invalid --bucket value', 'Expected a clear validation error for invalid bucket values.');
});
