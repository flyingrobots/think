import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync } from 'node:fs';

import {
  runThink,
  createThinkContext,
} from '../fixtures/think.js';

import {
  createGitRepo,
} from '../fixtures/git.js';

import {
  assertContains,
  assertFailure,
  assertNotContains,
  assertSuccess,
  parseJsonLines,
} from '../support/assertions.js';

test('think --ingest reads stdin explicitly and captures it into the normal raw-capture core', async () => {
  const context = await createThinkContext();
  const cwd = await createGitRepo();
  const thought = 'stdin ingress should preserve the same cheap local-first capture contract';

  const ingest = runThink(context, ['--ingest'], {}, { cwd, input: thought });

  assertSuccess(ingest, 'Expected explicit stdin ingest to succeed.');
  assertContains(ingest, 'Saved locally', 'Expected explicit stdin ingest to preserve the normal capture success language.');
  assert.ok(
    existsSync(context.localRepoDir),
    `Expected explicit stdin ingest to bootstrap the private local repo at ${context.localRepoDir}.`
  );

  const recent = runThink(context, ['--recent'], {}, { cwd });
  assertSuccess(recent, 'Expected recent to succeed after stdin ingest.');
  assertContains(recent, thought, 'Expected stdin ingest to preserve the exact captured text in recent.');
});

test('think with stdin but without --ingest does not accidentally capture piped input', async () => {
  const context = await createThinkContext();
  const cwd = await createGitRepo();
  const thought = 'stdin should not be captured accidentally when --ingest is absent';

  const capture = runThink(context, [], {}, { cwd, input: thought });

  assertFailure(capture, 'Expected plain think with only stdin to fail rather than silently consume piped input.');
  assertContains(
    capture,
    'Thought cannot be empty',
    'Expected plain think without positionals to remain explicit about missing capture input.'
  );
  assert.ok(
    !existsSync(context.localRepoDir),
    `Expected accidental stdin usage without --ingest not to bootstrap local state at ${context.localRepoDir}.`
  );
});

test('think --ingest rejects mixed positional capture text and stdin capture text', async () => {
  const context = await createThinkContext();
  const cwd = await createGitRepo();

  const ingest = runThink(
    context,
    ['--ingest', 'this should not be mixed'],
    {},
    { cwd, input: 'stdin text should stay the only ingest payload' }
  );

  assertFailure(ingest, 'Expected --ingest with a positional thought to fail rather than guess between two capture sources.');
  assertContains(
    ingest,
    '--ingest does not take a thought',
    'Expected --ingest to reject mixed positional capture text clearly.'
  );
  assert.ok(
    !existsSync(context.localRepoDir),
    `Expected invalid mixed stdin ingest usage not to bootstrap local state at ${context.localRepoDir}.`
  );
});

test('think --json --ingest preserves machine-readable capture semantics for agents', async () => {
  const context = await createThinkContext();
  const cwd = await createGitRepo();
  const thought = 'agent-friendly stdin ingest should stay explicit and local-first';

  const ingest = runThink(context, ['--json', '--ingest'], {}, { cwd, input: thought });

  assertSuccess(ingest, 'Expected JSON stdin ingest to succeed.');
  const stdoutEvents = parseJsonLines(
    ingest.stdout,
    'Expected JSON stdin ingest to emit valid JSONL on stdout.'
  );
  const stderrEvents = parseJsonLines(
    ingest.stderr,
    'Expected JSON stdin ingest to emit valid JSONL on stderr when present.'
  );

  assert.equal((ingest.stderr || '').trim(), '', 'Expected successful JSON stdin ingest to keep stderr quiet.');
  assert.deepEqual(
    stdoutEvents.map((event) => event.event),
    ['cli.start', 'capture.local_save.done', 'capture.status', 'cli.success'],
    'Expected JSON stdin ingest to preserve the normal machine-readable capture contract.'
  );
  assert.equal(stderrEvents.length, 0, 'Expected successful JSON stdin ingest not to emit stderr events.');

  const recent = runThink(context, ['--recent'], {}, { cwd });
  assertSuccess(recent, 'Expected recent to succeed after JSON stdin ingest.');
  assertContains(recent, thought, 'Expected JSON stdin ingest to create a normal raw capture entry.');
});

test('think --ingest rejects empty stdin payloads', async () => {
  const context = await createThinkContext();
  const cwd = await createGitRepo();

  const ingest = runThink(context, ['--ingest'], {}, { cwd, input: '' });

  assertFailure(ingest, 'Expected explicit stdin ingest with empty input to fail.');
  assertContains(
    ingest,
    'No stdin content to ingest',
    'Expected explicit stdin ingest to fail clearly when stdin is empty.'
  );
  assertNotContains(
    ingest,
    'Saved locally',
    'Expected empty stdin ingest not to pretend local capture succeeded.'
  );
});
