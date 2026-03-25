import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync } from 'node:fs';

import {
  runThink,
  createThinkContext,
} from '../fixtures/think.js';

import {
  assertContains,
  assertFailure,
  assertNotContains,
  assertSuccess,
  parseJsonLines,
} from '../support/assertions.js';

test('think --reflect starts an explicit seeded reflect session with a deterministic seed-first challenge prompt', async () => {
  const context = await createThinkContext();
  const seedThought = 'We should make warp graph the thought substrate';
  captureWithEntryId(context, 'turkey is good in burritos');
  const { entryId: seedEntryId } = captureWithEntryId(context, seedThought);

  const start = runThink(context, ['--verbose', `--reflect=${seedEntryId}`]);

  assertSuccess(start, 'Expected seeded brainstorm start to succeed.');
  assertContains(start, 'Reflect', 'Expected the deterministic mode to identify itself explicitly.');
  assertContains(start, 'Mode: Challenge', 'Expected brainstorm to identify the prompt family clearly.');
  assertContains(start, 'Why selected:', 'Expected brainstorm to explain why the question was chosen.');
  assertContains(start, 'Question:', 'Expected brainstorm to present one sharp prompt.');
  assertContains(
    start,
    'What would make this false in practice?',
    'Expected brainstorm to ask the deterministic challenge prompt for this seed thought.'
  );
  assertNotContains(start, 'Contrast:', 'Default brainstorm should not guess another thought to contrast against.');
  assertNotContains(start, 'cluster', 'Brainstorm should not leak clustering language.');
  assertNotContains(start, 'keyword', 'Brainstorm should not leak keyword extraction.');
  assertNotContains(start, 'summary', 'Brainstorm should not summarize the archive.');

  const events = parseJsonLines(
    start.stderr,
    'Expected brainstorm --verbose to emit valid JSONL trace events.'
  );
  const sessionStarted = getEvent(
    events,
    'reflect.session_started',
    'Expected brainstorm start to emit session metadata.'
  );

  assert.equal(sessionStarted.seedEntryId, seedEntryId, 'Expected brainstorm to preserve the seed lineage.');
  assert.equal(
    sessionStarted.contrastEntryId,
    null,
    'Expected default brainstorm to omit contrast lineage rather than pretending another thought is relevant.'
  );
  assert.equal(sessionStarted.promptType, 'challenge', 'Expected this seed to deterministically map to challenge mode.');
  assert.equal(sessionStarted.maxSteps, 3, 'Expected brainstorm sessions to stay bounded.');
  assert.equal(typeof sessionStarted.sessionId, 'string', 'Expected brainstorm to expose a reusable session id.');
  assert.deepEqual(
    sessionStarted.selectionReason,
    {
      kind: 'seed_only_challenge',
      text: 'Used a deterministic challenge prompt from the seed thought alone.',
    },
    'Expected brainstorm to emit deterministic seed-first selection receipts.'
  );
});

test('think --brainstorm remains a compatibility alias for a seed-first reflect constraint prompt', async () => {
  const context = await createThinkContext();
  const seedThought = 'I want to make git-warp support replayable cognition';
  captureWithEntryId(context, 'warp cognition needs better replay receipts');
  const { entryId: seedEntryId } = captureWithEntryId(context, seedThought);

  const start = runThink(context, ['--verbose', `--brainstorm=${seedEntryId}`]);

  assertSuccess(start, 'Expected brainstorm to remain usable for a deterministic constraint prompt.');
  assertContains(start, 'Reflect', 'Expected the deterministic mode to remain explicit.');
  assertContains(start, 'Mode: Constraint', 'Expected brainstorm to identify the constraint family clearly.');
  assertContains(start, 'Why selected:', 'Expected brainstorm to explain why the question was chosen.');
  assertContains(
    start,
    'What is the smallest shippable version of this?',
    'Expected brainstorm to ask the deterministic constraint prompt for this seed thought.'
  );
  assertNotContains(start, 'Contrast:', 'Constraint mode should not pretend it picked a contrast thought.');

  const events = parseJsonLines(
    start.stderr,
    'Expected deterministic constraint brainstorm --verbose to emit valid JSONL trace events.'
  );
  const sessionStarted = getEvent(
    events,
    'reflect.session_started',
    'Expected constraint reflect session to emit session metadata.'
  );

  assert.equal(sessionStarted.seedEntryId, seedEntryId, 'Expected constraint brainstorm to preserve the seed lineage.');
  assert.equal(sessionStarted.contrastEntryId, null, 'Expected seed-first constraint prompts to omit contrast lineage.');
  assert.equal(sessionStarted.promptType, 'constraint', 'Expected this seed to deterministically map to constraint mode.');
  assert.deepEqual(
    sessionStarted.selectionReason,
    {
      kind: 'seed_only_constraint',
      text: 'Used a deterministic constraint prompt from the seed thought alone.',
    },
    'Expected reflect to expose deterministic seed-only constraint receipts.'
  );
});

test('think --reflect can use an explicit sharpen prompt family', async () => {
  const context = await createThinkContext();
  const seedThought = 'We should make warp graph the thought substrate';
  const { entryId: seedEntryId } = captureWithEntryId(context, seedThought);

  const start = runThink(context, ['--verbose', `--reflect=${seedEntryId}`, '--mode=sharpen']);

  assertSuccess(start, 'Expected brainstorm to support explicit sharpen mode selection.');
  assertContains(start, 'Reflect', 'Expected the deterministic mode to remain explicit.');
  assertContains(start, 'Mode: Sharpen', 'Expected brainstorm to identify the sharpen family clearly.');
  assertContains(start, 'Why selected:', 'Expected brainstorm to explain why the question shape was chosen.');
  assertContains(
    start,
    'What is the smallest concrete next move?',
    'Expected explicit sharpen mode to use the deterministic sharpen prompt for this seed.'
  );

  const events = parseJsonLines(
    start.stderr,
    'Expected explicit sharpen brainstorm --verbose to emit valid JSONL trace events.'
  );
  const sessionStarted = getEvent(
    events,
    'reflect.session_started',
    'Expected explicit sharpen brainstorm to emit session metadata.'
  );

  assert.equal(sessionStarted.seedEntryId, seedEntryId, 'Expected explicit sharpen mode to preserve the seed lineage.');
  assert.equal(sessionStarted.contrastEntryId, null, 'Expected explicit sharpen mode to remain seed-first.');
  assert.equal(sessionStarted.promptType, 'sharpen', 'Expected explicit brainstorm mode to preserve the requested prompt family.');
  assert.deepEqual(
    sessionStarted.selectionReason,
    {
      kind: 'requested_sharpen',
      text: 'Used the requested sharpen prompt family for this reflect session.',
    },
    'Expected explicit sharpen mode to expose receipt-like prompt-family selection.'
  );
});

test('think --reflect-session stores a separate derived entry with preserved seed-first lineage', async () => {
  const context = await createThinkContext();
  const seedThought = 'I want to make git-warp support replayable cognition';
  const otherRawThought = 'warp cognition needs better replay receipts';
  const answer = 'The replay model matters more if the system can pressure-test a thought without rewriting it.';
  const { entryId: seedEntryId } = captureWithEntryId(context, seedThought);
  captureWithEntryId(context, otherRawThought);

  const start = runThink(context, ['--verbose', `--reflect=${seedEntryId}`]);
  assertSuccess(start, 'Expected brainstorm start to succeed before answering.');

  const sessionStarted = getEvent(
    parseJsonLines(start.stderr),
    'reflect.session_started',
    'Expected brainstorm start to emit a reusable session id.'
  );

  const continueResult = runThink(
    context,
    ['--verbose', `--reflect-session=${sessionStarted.sessionId}`, answer]
  );

  assertSuccess(continueResult, 'Expected brainstorm response capture to succeed.');
  assertContains(continueResult, 'Reflect saved', 'Expected reflect responses to report a clear save result.');
  assertNotContains(continueResult, 'commit', 'Brainstorm save UX should avoid Git terminology.');
  assertNotContains(continueResult, 'push', 'Brainstorm save UX should avoid Git terminology.');
  assertNotContains(continueResult, 'pull', 'Brainstorm save UX should avoid Git terminology.');
  assertNotContains(continueResult, 'cluster', 'Brainstorm save UX should not leak cluster narration.');
  assertNotContains(continueResult, 'summary', 'Brainstorm save UX should not leak summary narration.');

  const continueEvents = parseJsonLines(
    continueResult.stderr,
    'Expected brainstorm response --verbose to emit valid JSONL trace events.'
  );
  const saved = getEvent(
    continueEvents,
    'reflect.entry_saved',
    'Expected brainstorm response to emit stored-entry lineage metadata.'
  );

  assert.equal(saved.kind, 'reflect', 'Expected reflect responses to be stored as derived reflect entries.');
  assert.equal(saved.seedEntryId, seedEntryId, 'Expected brainstorm entry to preserve the seed lineage.');
  assert.equal(
    saved.contrastEntryId,
    null,
    'Expected default brainstorm entries to stay seed-first instead of carrying fake contrast lineage.'
  );
  assert.equal(
    saved.sessionId,
    sessionStarted.sessionId,
    'Expected brainstorm response to remain attached to the original session.'
  );
  assert.equal(saved.promptType, 'constraint', 'Expected brainstorm response to preserve the prompt family.');
  assert.equal(typeof saved.entryId, 'string', 'Expected brainstorm response to expose its own entry id.');

  const recent = runThink(context, ['--recent']);
  assertSuccess(recent, 'Expected recent to remain usable after brainstorm activity.');
  assertContains(recent, seedThought, 'Expected recent to keep showing raw capture entries.');
  assertContains(recent, otherRawThought, 'Expected recent to keep showing raw capture entries.');
  assertNotContains(
    recent,
    answer,
    'Expected brainstorm responses to stay out of the plain raw-capture recent view.'
  );
});

test('think --reflect validates explicit session entry and stays read-only on invalid start', async () => {
  const context = await createThinkContext();

  const missingSeed = runThink(context, ['--reflect']);
  assertFailure(missingSeed, 'Expected --reflect without a seed id to fail loudly.');
  assertContains(
    missingSeed,
    '--reflect requires a seed entry id',
    'Expected reflect mode to require explicit seeding outside interactive TTY use.'
  );
  assert.ok(
    !existsSync(context.localRepoDir),
    `Expected invalid brainstorm start to remain read-only, but repo was created at ${context.localRepoDir}.`
  );

  const strayMode = runThink(context, ['--mode=sharpen']);
  assertFailure(strayMode, 'Expected --mode without --reflect to fail loudly.');
  assertContains(
    strayMode,
    '--mode requires --reflect or --brainstorm',
    'Expected reflect mode selection to remain scoped to reflect or brainstorm start.'
  );

  const seededContext = await createThinkContext();
  const { entryId: seedEntryId } = captureWithEntryId(seededContext, 'seed thought');
  const unexpectedResponse = runThink(seededContext, ['--reflect=' + seedEntryId, 'this should not be dropped']);

  assertFailure(
    unexpectedResponse,
    'Expected brainstorm start with a response payload to fail rather than silently reinterpret it.'
  );
  assertContains(
    unexpectedResponse,
    '--reflect does not take a response',
    'Expected reflect start and reflect response to remain separate commands.'
  );

  const invalidMode = runThink(seededContext, ['--reflect=' + seedEntryId, '--mode=chaos']);
  assertFailure(invalidMode, 'Expected invalid brainstorm prompt family selection to fail loudly.');
  assertContains(
    invalidMode,
    'Invalid --mode value',
    'Expected brainstorm mode selection to reject unknown prompt families.'
  );

  const missingResponse = runThink(seededContext, ['--reflect-session=reflect:missing']);
  assertFailure(missingResponse, 'Expected brainstorm session continuation without a response to fail.');
  assertContains(
    missingResponse,
    '--reflect-session requires a response',
    'Expected brainstorm continuation to require an explicit response payload.'
  );
});

test('think --reflect fails clearly when the seed entry does not exist', async () => {
  const context = await createThinkContext();

  const start = runThink(context, ['--reflect=entry:missing-seed']);

  assertFailure(start, 'Expected brainstorm to fail loudly when the seed entry is missing.');
  assertContains(start, 'Seed entry not found', 'Expected a clear missing-seed error.');
  assert.ok(
    !existsSync(context.localRepoDir),
    `Expected missing-seed brainstorm start to remain read-only, but repo was created at ${context.localRepoDir}.`
  );
});

test('think --reflect refuses status-like seeds that are not pressure-testable ideas', async () => {
  const context = await createThinkContext();
  const seedThought = "I showed the thought log to ChatGPT, since it was Chat's idea in the first place.";
  const alternativeOne = 'We should make warp graph the thought substrate';
  const alternativeTwo = 'I want to make git-warp support replayable cognition';
  const { entryId: seedEntryId } = captureWithEntryId(context, seedThought);
  captureWithEntryId(context, alternativeOne);
  captureWithEntryId(context, alternativeTwo);

  const start = runThink(context, ['--reflect=' + seedEntryId]);

  assertFailure(start, 'Expected brainstorm to refuse low-signal status or narrative notes.');
  assertContains(
    start,
    'This entry looks more like a note than a pressure-testable idea.',
    'Expected brainstorm to explain why the seed is being refused.'
  );
  assertContains(
    start,
    'Pick a different seed or capture a sharper claim first.',
    'Expected brainstorm to redirect the user toward a better seed instead of faking depth.'
  );
  assertContains(
    start,
    'Try one of these instead:',
    'Expected brainstorm refusal to suggest better seeds instead of dead-ending.'
  );
  assertContains(start, alternativeOne, 'Expected brainstorm refusal to suggest recent eligible alternatives.');
  assertContains(start, alternativeTwo, 'Expected brainstorm refusal to suggest recent eligible alternatives.');
});

test('think --json --reflect refuses ineligible seeds with structured machine-readable errors', async () => {
  const context = await createThinkContext();
  const seedThought = "I showed the thought log to ChatGPT, since it was Chat's idea in the first place.";
  const alternativeOne = 'We should make warp graph the thought substrate';
  const alternativeTwo = 'I want to make git-warp support replayable cognition';
  const { entryId: seedEntryId } = captureWithEntryId(context, seedThought);
  const { entryId: alternativeOneId } = captureWithEntryId(context, alternativeOne);
  const { entryId: alternativeTwoId } = captureWithEntryId(context, alternativeTwo);

  const start = runThink(context, ['--json', `--reflect=${seedEntryId}`]);

  assertFailure(start, 'Expected JSON brainstorm to refuse ineligible seeds.');
  assertJsonStreams(start);

  const stdoutEvents = parseJsonLines(start.stdout, 'Expected stdout JSONL for the command start event.');
  const stderrEvents = parseJsonLines(start.stderr, 'Expected stderr JSONL for the ineligible-seed failure.');

  assert.deepEqual(
    stdoutEvents.map(event => event.event),
    ['cli.start'],
    'Expected stdout to carry only the non-error start event for an ineligible brainstorm seed.'
  );

  assert.deepEqual(
    stderrEvents.map(event => event.event),
    ['reflect.seed_ineligible', 'cli.failure'],
    'Expected ineligible brainstorm seeds to fail on stderr with machine-readable rows.'
  );

  const ineligible = getEvent(
    stderrEvents,
    'reflect.seed_ineligible',
    'Expected JSON brainstorm to expose a structured ineligible-seed row.'
  );

  assert.equal(ineligible.seedEntryId, seedEntryId, 'Expected structured ineligible-seed failures to preserve the seed id.');
  assert.deepEqual(
    ineligible.reason,
    {
      eligible: false,
      kind: 'not_pressure_testable',
      text: 'This entry looks more like a note than a pressure-testable idea.',
      suggestion: 'Pick a different seed or capture a sharper claim first.',
    },
    'Expected JSON brainstorm refusal to expose a deterministic eligibility reason.'
  );
  assert.deepEqual(
    ineligible.suggestedSeeds,
    [
      {
        entryId: alternativeTwoId,
        text: alternativeTwo,
      },
      {
        entryId: alternativeOneId,
        text: alternativeOne,
      },
    ],
    'Expected JSON brainstorm refusal to surface recent eligible alternatives in newest-first order.'
  );
});

test('think --json --reflect emits only JSONL with seed-first session and prompt data', async () => {
  const context = await createThinkContext();
  const seedThought = 'We should make warp graph the thought substrate';
  captureWithEntryId(context, 'warp graph needs better replay tooling');
  const { entryId: seedEntryId } = captureWithEntryId(context, seedThought);

  const start = runThink(context, ['--json', `--reflect=${seedEntryId}`]);

  assertSuccess(start, 'Expected --json brainstorm start to succeed.');
  assertJsonStreams(start);
  assert.equal((start.stderr || '').trim(), '', 'Expected successful JSON brainstorm start to keep stderr quiet.');

  const events = parseJsonLines(
    start.stdout,
    'Expected --json brainstorm start to emit valid JSONL on stdout.'
  );

  assert.deepEqual(
    events.map(event => event.event),
    [
      'cli.start',
      'reflect.session_started',
      'reflect.prompt',
      'cli.success',
    ],
    'Expected --json brainstorm start to emit machine-readable session and prompt rows without fake contrast rows.'
  );

  const sessionStarted = getEvent(
    events,
    'reflect.session_started',
    'Expected --json brainstorm start to expose session metadata.'
  );
  const prompt = getEvent(
    events,
    'reflect.prompt',
    'Expected --json brainstorm start to expose the prompt row.'
  );

  assert.equal(sessionStarted.seedEntryId, seedEntryId, 'Expected JSON brainstorm to preserve the seed lineage.');
  assert.equal(sessionStarted.contrastEntryId, null, 'Expected JSON brainstorm to omit contrast lineage in default mode.');
  assert.equal(sessionStarted.promptType, 'challenge', 'Expected JSON brainstorm to preserve the deterministic prompt family.');
  assert.deepEqual(
    sessionStarted.selectionReason,
    {
      kind: 'seed_only_challenge',
      text: 'Used a deterministic challenge prompt from the seed thought alone.',
    },
    'Expected JSON brainstorm to expose deterministic seed-first selection receipts.'
  );
  assert.equal(prompt.promptType, 'challenge', 'Expected JSON brainstorm prompt row to expose the prompt family.');
  assert.equal(
    prompt.question,
    'What would make this false in practice?',
    'Expected JSON brainstorm prompt row to expose the deterministic question text.'
  );
});

test('think --json --reflect-session emits only JSONL and preserves stored seed-first lineage', async () => {
  const context = await createThinkContext();
  const seedThought = 'I want to make git-warp support replayable cognition';
  const answer = 'The replay model matters more if the system can pressure-test a thought without rewriting it.';
  const { entryId: seedEntryId } = captureWithEntryId(context, seedThought);

  const start = runThink(context, ['--json', `--reflect=${seedEntryId}`]);
  assertSuccess(start, 'Expected JSON brainstorm start to succeed before answering.');
  assertJsonStreams(start);
  assert.equal((start.stderr || '').trim(), '', 'Expected successful JSON brainstorm start to keep stderr quiet.');

  const sessionStarted = getEvent(
    parseJsonLines(start.stdout),
    'reflect.session_started',
    'Expected JSON brainstorm start to emit a reusable session id.'
  );

  const continueResult = runThink(
    context,
    ['--json', `--reflect-session=${sessionStarted.sessionId}`, answer]
  );

  assertSuccess(continueResult, 'Expected JSON brainstorm response capture to succeed.');
  assertJsonStreams(continueResult);
  assert.equal((continueResult.stderr || '').trim(), '', 'Expected successful JSON brainstorm response to keep stderr quiet.');

  const events = parseJsonLines(
    continueResult.stdout,
    'Expected --json brainstorm response to emit valid JSONL on stdout.'
  );

  assert.deepEqual(
    events.map(event => event.event),
    [
      'cli.start',
      'reflect.entry_saved',
      'cli.success',
    ],
    'Expected JSON brainstorm response to emit only structured save rows.'
  );

  const saved = getEvent(
    events,
    'reflect.entry_saved',
    'Expected JSON brainstorm response to expose the saved derived entry.'
  );

  assert.equal(saved.kind, 'reflect', 'Expected JSON reflect responses to be stored as reflect entries.');
  assert.equal(saved.seedEntryId, seedEntryId, 'Expected JSON brainstorm response to preserve the seed lineage.');
  assert.equal(saved.contrastEntryId, null, 'Expected JSON brainstorm response to omit fake contrast lineage.');
  assert.equal(saved.sessionId, sessionStarted.sessionId, 'Expected JSON brainstorm response to remain in the same session.');
  assert.equal(saved.promptType, 'constraint', 'Expected JSON brainstorm response to preserve the prompt family.');
});

test('think --json reflect validation failures stay fully machine-readable', async () => {
  const context = await createThinkContext();

  const result = runThink(context, ['--json', '--reflect']);

  assertFailure(result, 'Expected invalid JSON brainstorm start to fail loudly.');
  assertJsonStreams(result);

  const stdoutEvents = parseJsonLines(result.stdout, 'Expected stdout JSONL when present.');
  const stderrEvents = parseJsonLines(result.stderr, 'Expected stderr JSONL for structured brainstorm validation failures.');

  assert.deepEqual(
    stdoutEvents.map(event => event.event),
    ['cli.start'],
    'Expected stdout to carry only the non-error start event for a failed JSON brainstorm command.'
  );

  assert.deepEqual(
    stderrEvents.map(event => event.event),
    ['cli.validation_failed', 'cli.failure'],
    'Expected brainstorm validation failures to move to stderr while remaining machine-readable.'
  );

  const validation = getEvent(
    stderrEvents,
    'cli.validation_failed',
    'Expected JSON brainstorm validation to include a structured error row.'
  );

  assert.equal(
    validation.message,
    '--reflect requires a seed entry id',
    'Expected JSON reflect validation to preserve the same error contract.'
  );
});

function captureWithEntryId(context, thought, extraEnv = {}) {
  const capture = runThink(context, ['--verbose', thought], extraEnv);

  assertSuccess(capture, `Expected capture to succeed for thought: ${thought}`);
  const events = parseJsonLines(
    capture.stderr,
    'Expected verbose capture to emit valid JSONL trace events.'
  );
  const saved = getEvent(
    events,
    'capture.local_save.done',
    'Expected verbose capture to expose the saved raw entry id.'
  );

  assert.equal(typeof saved.entryId, 'string', 'Expected raw capture to include a string entry id.');
  return {
    entryId: saved.entryId,
    result: capture,
  };
}

function getEvent(events, name, message) {
  const event = events.find(candidate => candidate.event === name);
  assert.ok(event, message);
  return event;
}

function assertJsonStreams(result) {
  if ((result.stdout || '').trim() !== '') {
    parseJsonLines(result.stdout, 'Expected stdout to contain only JSONL when present in --json mode.');
  }

  if ((result.stderr || '').trim() !== '') {
    parseJsonLines(result.stderr, 'Expected stderr to contain only JSONL when present in --json mode.');
  }
}
