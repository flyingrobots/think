import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync } from 'node:fs';

import {
  createThinkContext,
  runThink,
} from '../fixtures/think.js';

import {
  assertContains,
  assertNotContains,
  assertSuccess,
  parseJsonLines,
} from '../support/assertions.js';

test('think --help prints top-level usage without bootstrapping local state', async () => {
  const context = await createThinkContext();

  const result = runThink(context, ['--help']);

  assertSuccess(result, 'Expected --help to exit successfully.');
  assertContains(result, 'Usage: think', 'Expected top-level help to include a usage line.');
  assertContains(result, '--recent', 'Expected top-level help to enumerate explicit command surfaces.');
  assert.ok(
    !existsSync(context.localRepoDir),
    `Expected --help to stay read-only and avoid creating ${context.localRepoDir}.`
  );
});

test('think -h is accepted as a short alias for top-level help', async () => {
  const context = await createThinkContext();

  const result = runThink(context, ['-h']);

  assertSuccess(result, 'Expected -h to exit successfully.');
  assertContains(result, 'Usage: think', 'Expected -h to print the same top-level usage banner.');
});

test('think --recent --help prints recent help instead of running the command', async () => {
  const context = await createThinkContext();

  const result = runThink(context, ['--recent', '--help']);

  assertSuccess(result, 'Expected command-specific help to exit successfully.');
  assertContains(result, 'Usage: think --recent', 'Expected recent help to render a recent-specific usage line.');
  assertContains(result, '--count=N', 'Expected recent help to mention the count filter.');
  assert.ok(
    !existsSync(context.localRepoDir),
    `Expected recent help to remain read-only and avoid creating ${context.localRepoDir}.`
  );
});

test('think recent --help resolves to recent help without reserving the word recent by itself', async () => {
  const context = await createThinkContext();

  const result = runThink(context, ['recent', '--help']);

  assertSuccess(result, 'Expected help-topic shorthand to exit successfully.');
  assertContains(result, 'Usage: think --recent', 'Expected positional recent + --help to resolve to recent help.');
});

test('think --inspect --help bypasses required entry validation', async () => {
  const context = await createThinkContext();

  const result = runThink(context, ['--inspect', '--help']);

  assertSuccess(result, 'Expected inspect help to succeed without an entry id.');
  assertContains(result, 'Usage: think --inspect=<entryId>', 'Expected inspect help to document the entry id usage.');
  assertNotContains(
    result,
    '--inspect requires an entry id',
    'Expected help to bypass the normal inspect validation path.'
  );
});

test('think --json --help emits structured JSONL help output', async () => {
  const context = await createThinkContext();

  const result = runThink(context, ['--json', '--help']);

  assertSuccess(result, 'Expected --json --help to exit successfully.');
  const stdoutEvents = parseJsonLines(result.stdout, 'Expected --json --help to emit JSONL on stdout.');
  const stderrEvents = parseJsonLines(result.stderr, 'Expected stderr to stay empty or valid JSONL.');

  assert.deepEqual(
    stdoutEvents.map(event => event.event),
    ['cli.start', 'cli.help', 'cli.success'],
    'Expected JSON help to emit start, help, and success events in order.'
  );
  assert.equal(stderrEvents.length, 0, 'Expected successful JSON help to keep stderr quiet.');
});

test('think recent --json --help reports the requested command in JSONL events', async () => {
  const context = await createThinkContext();

  const result = runThink(context, ['recent', '--json', '--help']);

  assertSuccess(result, 'Expected shorthand recent help in JSON mode to exit successfully.');
  const stdoutEvents = parseJsonLines(result.stdout, 'Expected shorthand recent help to emit JSONL on stdout.');

  assert.deepEqual(
    stdoutEvents.map((event) => event.command),
    ['recent', 'recent', 'recent'],
    'Expected shorthand help events to report the requested recent command instead of capture.'
  );
});

test('think -- -h captures the literal text after option parsing is terminated', async () => {
  const context = await createThinkContext();

  assertSuccess(runThink(context, ['--', '-h']), 'Expected -- -h to be captured as a literal thought.');

  const recent = runThink(context, ['--recent']);

  assertSuccess(recent, 'Expected recent to succeed after capturing a literal -h thought.');
  assertContains(recent, '-h', 'Expected the literal -h thought to appear in recent output.');
});
