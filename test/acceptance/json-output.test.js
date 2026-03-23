import assert from 'node:assert/strict';
import test from 'node:test';

import {
  runThink,
  createThinkContext,
} from '../fixtures/think.js';

import {
  assertFailure,
  assertSuccess,
  parseJsonLines,
} from '../support/assertions.js';

test('think --json capture emits only JSONL on stdout', async () => {
  const context = await createThinkContext();

  const capture = runThink(context, ['--json', 'json capture thought']);

  assertSuccess(capture, 'Expected --json capture to succeed.');
  assertJsonOnly(capture);

  const events = parseJsonLines(
    capture.stdout,
    'Expected --json capture to emit valid JSONL on stdout.'
  );

  assert.deepEqual(
    events.map(event => event.event),
    [
      'cli.start',
      'repo.ensure.start',
      'repo.bootstrap.done',
      'capture.local_save.start',
      'capture.local_save.done',
      'capture.status',
      'backup.skipped',
      'cli.success',
    ],
    'Expected --json capture to expose the full event stream on stdout.'
  );

  const saved = events.find(event => event.event === 'capture.status');
  if (!saved) {
    throw new Error('Expected --json capture to emit a structured capture.status event.');
  }
  if (saved.status !== 'saved_locally') {
    throw new Error(`Expected capture.status to report saved_locally, got ${saved.status}.`);
  }
});

test('think --json --recent emits entry events instead of plain text', async () => {
  const context = await createThinkContext();

  assertSuccess(runThink(context, ['first recent thought']), 'Expected first capture to succeed.');
  assertSuccess(runThink(context, ['second recent thought']), 'Expected second capture to succeed.');

  const recent = runThink(context, ['--json', '--recent']);

  assertSuccess(recent, 'Expected --json --recent to succeed.');
  assertJsonOnly(recent);

  const events = parseJsonLines(
    recent.stdout,
    'Expected --json --recent to emit valid JSONL on stdout.'
  );

  assert.deepEqual(
    events.map(event => event.event),
    [
      'cli.start',
      'recent.start',
      'recent.done',
      'recent.entry',
      'recent.entry',
      'cli.success',
    ],
    'Expected --json --recent to emit deterministic recent events.'
  );

  const entryTexts = events
    .filter(event => event.event === 'recent.entry')
    .map(event => event.text);

  assert.deepEqual(
    entryTexts,
    ['second recent thought', 'first recent thought'],
    'Expected --json --recent to preserve newest-first ordering in entry events.'
  );
});

test('think --json --stats emits totals and bucket rows as JSONL', async () => {
  const context = await createThinkContext();

  const d1 = new Date('2026-03-20T12:00:00Z').getTime();
  const d2 = new Date('2026-03-21T12:00:00Z').getTime();

  assertSuccess(runThink(context, ['d1a'], { THINK_TEST_NOW: String(d1) }), 'Expected first stats fixture capture to succeed.');
  assertSuccess(runThink(context, ['d2a'], { THINK_TEST_NOW: String(d2) }), 'Expected second stats fixture capture to succeed.');

  const stats = runThink(context, ['--json', '--stats', '--bucket=day']);

  assertSuccess(stats, 'Expected --json --stats to succeed.');
  assertJsonOnly(stats);

  const events = parseJsonLines(
    stats.stdout,
    'Expected --json --stats to emit valid JSONL on stdout.'
  );

  assert.deepEqual(
    events.map(event => event.event),
    [
      'cli.start',
      'stats.start',
      'stats.done',
      'stats.total',
      'stats.bucket',
      'stats.bucket',
      'cli.success',
    ],
    'Expected --json --stats to emit total and bucket events.'
  );

  const total = events.find(event => event.event === 'stats.total');
  if (!total || total.total !== 2) {
    throw new Error(`Expected stats.total to report 2 captures, got ${JSON.stringify(total)}.`);
  }
});

test('think --json validation failures emit JSONL and keep stderr empty', async () => {
  const context = await createThinkContext();

  const result = runThink(context, ['--json', '--stats', 'this should fail']);

  assertFailure(result, 'Expected invalid --json usage to fail.');
  assertJsonOnly(result);

  const events = parseJsonLines(
    result.stdout,
    'Expected --json validation failures to emit valid JSONL on stdout.'
  );

  assert.deepEqual(
    events.map(event => event.event),
    ['cli.start', 'cli.validation_failed', 'cli.failure'],
    'Expected --json validation failures to remain fully machine-readable.'
  );

  const validation = events.find(event => event.event === 'cli.validation_failed');
  if (!validation || validation.message !== '--stats does not take a thought') {
    throw new Error(`Expected structured validation failure message, got ${JSON.stringify(validation)}.`);
  }
});

function assertJsonOnly(result) {
  if ((result.stderr || '').trim() !== '') {
    throw new Error(`Expected stderr to stay empty in --json mode.\nstderr:\n${result.stderr}`);
  }

  parseJsonLines(result.stdout, 'Expected stdout to contain only JSONL in --json mode.');
}
