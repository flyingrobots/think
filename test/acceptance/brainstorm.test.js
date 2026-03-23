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

test('think --brainstorm starts an explicit seeded brainstorm with deterministic contrast receipts', async () => {
  const context = await createThinkContext();
  const seedThought = 'warp graph as thought substrate';
  const contrastThought = 'turkey is good in burritos';
  const { entryId: seedEntryId } = captureWithEntryId(context, seedThought);
  const { entryId: contrastEntryId } = captureWithEntryId(context, contrastThought);

  const start = runThink(context, ['--verbose', `--brainstorm=${seedEntryId}`]);

  assertSuccess(start, 'Expected seeded brainstorm start to succeed.');
  assertContains(start, 'Brainstorm', 'Expected brainstorm mode to identify itself explicitly.');
  assertContains(start, 'Contrast:', 'Expected brainstorm to surface a contrast receipt.');
  assertContains(start, contrastThought, 'Expected brainstorm to reveal the selected contrast entry.');
  assertContains(start, 'Why selected:', 'Expected brainstorm to explain why the contrast was chosen.');
  assertContains(start, 'Question:', 'Expected brainstorm to present one sharp prompt.');
  assertNotContains(start, 'cluster', 'Brainstorm should not leak clustering language.');
  assertNotContains(start, 'keyword', 'Brainstorm should not leak keyword extraction.');
  assertNotContains(start, 'summary', 'Brainstorm should not summarize the archive.');
  assertNotContains(start, 'reflect', 'Brainstorm should not narrate reflection mode.');

  const events = parseJsonLines(
    start.stderr,
    'Expected brainstorm --verbose to emit valid JSONL trace events.'
  );
  const sessionStarted = getEvent(
    events,
    'brainstorm.session_started',
    'Expected brainstorm start to emit session metadata.'
  );

  assert.equal(sessionStarted.seedEntryId, seedEntryId, 'Expected brainstorm to preserve the seed lineage.');
  assert.equal(
    sessionStarted.contrastEntryId,
    contrastEntryId,
    'Expected brainstorm to identify the chosen contrast entry.'
  );
  assert.equal(sessionStarted.promptType, 'contrast', 'Expected contrast to be the default brainstorm prompt family.');
  assert.equal(sessionStarted.maxSteps, 3, 'Expected brainstorm sessions to stay bounded.');
  assert.equal(typeof sessionStarted.sessionId, 'string', 'Expected brainstorm to expose a reusable session id.');
  assert.ok(sessionStarted.selectionReason, 'Expected brainstorm to emit deterministic selection receipts.');
  assert.equal(
    typeof sessionStarted.selectionReason.kind,
    'string',
    'Expected brainstorm selection receipts to include a deterministic reason kind.'
  );
});

test('think --brainstorm falls back to a constraint prompt when contrast is weak or unavailable', async () => {
  const context = await createThinkContext();
  const { entryId: seedEntryId } = captureWithEntryId(context, 'single lonely idea');

  const start = runThink(context, ['--verbose', `--brainstorm=${seedEntryId}`]);

  assertSuccess(start, 'Expected brainstorm to remain usable even when no good contrast exists.');
  assertContains(start, 'Brainstorm', 'Expected fallback brainstorm to remain explicit.');
  assertContains(start, 'Constraint:', 'Expected brainstorm to fall back to a constraint prompt.');
  assertContains(start, 'Question:', 'Expected fallback brainstorm to still ask one sharp question.');
  assertNotContains(start, 'Contrast:', 'Expected constraint fallback to avoid pretending a contrast exists.');

  const events = parseJsonLines(
    start.stderr,
    'Expected fallback brainstorm --verbose to emit valid JSONL trace events.'
  );
  const sessionStarted = getEvent(
    events,
    'brainstorm.session_started',
    'Expected fallback brainstorm to emit session metadata.'
  );

  assert.equal(sessionStarted.seedEntryId, seedEntryId, 'Expected fallback brainstorm to preserve the seed lineage.');
  assert.equal(
    sessionStarted.contrastEntryId ?? null,
    null,
    'Expected fallback brainstorm to omit a contrast lineage id when no contrast was chosen.'
  );
  assert.equal(sessionStarted.promptType, 'constraint', 'Expected missing contrast to fall back to constraint mode.');
  assert.equal(
    sessionStarted.selectionReason?.kind,
    'contrast_unavailable',
    'Expected fallback brainstorm to expose a deterministic fallback reason.'
  );
});

test('think --brainstorm-session stores a separate derived entry with preserved lineage', async () => {
  const context = await createThinkContext();
  const seedThought = 'git-warp is for replayable cognition';
  const contrastThought = 'turkey is good in burritos';
  const answer = 'The replay model matters more if the system can pressure-test a thought without rewriting it.';
  const { entryId: seedEntryId } = captureWithEntryId(context, seedThought);
  const { entryId: contrastEntryId } = captureWithEntryId(context, contrastThought);

  const start = runThink(context, ['--verbose', `--brainstorm=${seedEntryId}`]);
  assertSuccess(start, 'Expected brainstorm start to succeed before answering.');

  const sessionStarted = getEvent(
    parseJsonLines(start.stderr),
    'brainstorm.session_started',
    'Expected brainstorm start to emit a reusable session id.'
  );

  const continueResult = runThink(
    context,
    ['--verbose', `--brainstorm-session=${sessionStarted.sessionId}`, answer]
  );

  assertSuccess(continueResult, 'Expected brainstorm response capture to succeed.');
  assertContains(continueResult, 'Brainstorm saved', 'Expected brainstorm responses to report a clear save result.');
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
    'brainstorm.entry_saved',
    'Expected brainstorm response to emit stored-entry lineage metadata.'
  );

  assert.equal(saved.kind, 'brainstorm', 'Expected brainstorm responses to be stored as derived brainstorm entries.');
  assert.equal(saved.seedEntryId, seedEntryId, 'Expected brainstorm entry to preserve the seed lineage.');
  assert.equal(
    saved.contrastEntryId,
    contrastEntryId,
    'Expected brainstorm entry to preserve the contrast lineage.'
  );
  assert.equal(
    saved.sessionId,
    sessionStarted.sessionId,
    'Expected brainstorm response to remain attached to the original session.'
  );
  assert.equal(saved.promptType, 'contrast', 'Expected brainstorm response to preserve the prompt family.');
  assert.equal(typeof saved.entryId, 'string', 'Expected brainstorm response to expose its own entry id.');

  const recent = runThink(context, ['--recent']);
  assertSuccess(recent, 'Expected recent to remain usable after brainstorm activity.');
  assertContains(recent, seedThought, 'Expected recent to keep showing raw capture entries.');
  assertContains(recent, contrastThought, 'Expected recent to keep showing raw capture entries.');
  assertNotContains(
    recent,
    answer,
    'Expected brainstorm responses to stay out of the plain raw-capture recent view.'
  );
});

test('think --brainstorm validates explicit session entry and stays read-only on invalid start', async () => {
  const context = await createThinkContext();

  const missingSeed = runThink(context, ['--brainstorm']);
  assertFailure(missingSeed, 'Expected --brainstorm without a seed id to fail loudly.');
  assertContains(
    missingSeed,
    '--brainstorm requires a seed entry id',
    'Expected brainstorm mode to require explicit seeding.'
  );
  assert.ok(
    !existsSync(context.localRepoDir),
    `Expected invalid brainstorm start to remain read-only, but repo was created at ${context.localRepoDir}.`
  );

  const seededContext = await createThinkContext();
  const { entryId: seedEntryId } = captureWithEntryId(seededContext, 'seed thought');
  const unexpectedResponse = runThink(seededContext, ['--brainstorm=' + seedEntryId, 'this should not be dropped']);

  assertFailure(
    unexpectedResponse,
    'Expected brainstorm start with a response payload to fail rather than silently reinterpret it.'
  );
  assertContains(
    unexpectedResponse,
    '--brainstorm does not take a response',
    'Expected brainstorm start and brainstorm response to remain separate commands.'
  );

  const missingResponse = runThink(seededContext, ['--brainstorm-session=brainstorm:missing']);
  assertFailure(missingResponse, 'Expected brainstorm session continuation without a response to fail.');
  assertContains(
    missingResponse,
    '--brainstorm-session requires a response',
    'Expected brainstorm continuation to require an explicit response payload.'
  );
});

test('think --brainstorm fails clearly when the seed entry does not exist', async () => {
  const context = await createThinkContext();

  const start = runThink(context, ['--brainstorm=entry:missing-seed']);

  assertFailure(start, 'Expected brainstorm to fail loudly when the seed entry is missing.');
  assertContains(start, 'Seed entry not found', 'Expected a clear missing-seed error.');
  assert.ok(
    !existsSync(context.localRepoDir),
    `Expected missing-seed brainstorm start to remain read-only, but repo was created at ${context.localRepoDir}.`
  );
});

test('think --json --brainstorm emits only JSONL with receipts and prompt data', async () => {
  const context = await createThinkContext();
  const seedThought = 'warp graph as thought substrate';
  const contrastThought = 'turkey is good in burritos';
  const { entryId: seedEntryId } = captureWithEntryId(context, seedThought);
  const { entryId: contrastEntryId } = captureWithEntryId(context, contrastThought);

  const start = runThink(context, ['--json', `--brainstorm=${seedEntryId}`]);

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
      'brainstorm.session_started',
      'brainstorm.contrast',
      'brainstorm.prompt',
      'cli.success',
    ],
    'Expected --json brainstorm start to emit machine-readable session, receipt, and prompt rows.'
  );

  const sessionStarted = getEvent(
    events,
    'brainstorm.session_started',
    'Expected --json brainstorm start to expose session metadata.'
  );
  const contrast = getEvent(
    events,
    'brainstorm.contrast',
    'Expected --json brainstorm start to expose the chosen contrast entry.'
  );
  const prompt = getEvent(
    events,
    'brainstorm.prompt',
    'Expected --json brainstorm start to expose the prompt row.'
  );

  assert.equal(sessionStarted.seedEntryId, seedEntryId, 'Expected JSON brainstorm to preserve the seed lineage.');
  assert.equal(sessionStarted.contrastEntryId, contrastEntryId, 'Expected JSON brainstorm to preserve the contrast lineage.');
  assert.equal(sessionStarted.promptType, 'contrast', 'Expected JSON brainstorm to preserve the prompt family.');
  assert.equal(contrast.entryId, contrastEntryId, 'Expected JSON brainstorm contrast row to identify the contrast entry.');
  assert.equal(contrast.text, contrastThought, 'Expected JSON brainstorm contrast row to expose the contrast text.');
  assert.ok(contrast.selectionReason, 'Expected JSON brainstorm contrast row to expose deterministic selection receipts.');
  assert.equal(prompt.promptType, 'contrast', 'Expected JSON brainstorm prompt row to expose the prompt family.');
  assert.equal(typeof prompt.question, 'string', 'Expected JSON brainstorm prompt row to expose the question text.');
});

test('think --json --brainstorm-session emits only JSONL and preserves stored lineage', async () => {
  const context = await createThinkContext();
  const seedThought = 'git-warp is for replayable cognition';
  const contrastThought = 'turkey is good in burritos';
  const answer = 'The replay model matters more if the system can pressure-test a thought without rewriting it.';
  const { entryId: seedEntryId } = captureWithEntryId(context, seedThought);
  const { entryId: contrastEntryId } = captureWithEntryId(context, contrastThought);

  const start = runThink(context, ['--json', `--brainstorm=${seedEntryId}`]);
  assertSuccess(start, 'Expected JSON brainstorm start to succeed before answering.');
  assertJsonStreams(start);
  assert.equal((start.stderr || '').trim(), '', 'Expected successful JSON brainstorm start to keep stderr quiet.');

  const sessionStarted = getEvent(
    parseJsonLines(start.stdout),
    'brainstorm.session_started',
    'Expected JSON brainstorm start to emit a reusable session id.'
  );

  const continueResult = runThink(
    context,
    ['--json', `--brainstorm-session=${sessionStarted.sessionId}`, answer]
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
      'brainstorm.entry_saved',
      'cli.success',
    ],
    'Expected JSON brainstorm response to emit only structured save rows.'
  );

  const saved = getEvent(
    events,
    'brainstorm.entry_saved',
    'Expected JSON brainstorm response to expose the saved derived entry.'
  );

  assert.equal(saved.kind, 'brainstorm', 'Expected JSON brainstorm responses to be stored as brainstorm entries.');
  assert.equal(saved.seedEntryId, seedEntryId, 'Expected JSON brainstorm response to preserve the seed lineage.');
  assert.equal(saved.contrastEntryId, contrastEntryId, 'Expected JSON brainstorm response to preserve the contrast lineage.');
  assert.equal(saved.sessionId, sessionStarted.sessionId, 'Expected JSON brainstorm response to remain in the same session.');
  assert.equal(saved.promptType, 'contrast', 'Expected JSON brainstorm response to preserve the prompt family.');
});

test('think --json brainstorm validation failures stay fully machine-readable', async () => {
  const context = await createThinkContext();

  const result = runThink(context, ['--json', '--brainstorm']);

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
    '--brainstorm requires a seed entry id',
    'Expected JSON brainstorm validation to preserve the same error contract.'
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
