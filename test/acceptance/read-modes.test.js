import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync } from 'node:fs';

import {
  runThink,
  createThinkContext,
} from '../fixtures/think.js';

import {
  assertChronologicalOrder,
  assertContains,
  assertFailure,
  assertNotContains,
  assertSuccess,
  combinedOutput,
  parseJsonLines,
} from '../support/assertions.js';

test('think --recent --count limits output to the newest N raw captures', async () => {
  const context = await createThinkContext();
  const entries = [
    'alpha capture',
    'beta capture',
    'gamma capture',
  ];

  for (const entry of entries) {
    assertSuccess(runThink(context, [entry]), `Expected capture to succeed for entry: ${entry}`);
  }

  const recent = runThink(context, ['--recent', '--count=2']);

  assertSuccess(recent, 'Expected filtered recent to succeed.');
  assertChronologicalOrder(
    combinedOutput(recent),
    ['gamma capture', 'beta capture'],
    'Expected count-limited recent output to remain newest-first.'
  );
  assertNotContains(
    recent,
    'alpha capture',
    'Expected --count to omit older entries beyond the requested limit.'
  );
});

test('think --recent --query filters raw captures by case-insensitive text match', async () => {
  const context = await createThinkContext();
  const matchingOld = 'warp replay needs better receipts';
  const nonMatch = 'turkey burritos remain underrated';
  const matchingNew = 'Warp graph should stay local-first';

  captureWithEntryId(context, matchingOld);
  captureWithEntryId(context, nonMatch);
  captureWithEntryId(context, matchingNew);

  const recent = runThink(context, ['--recent', '--query=warp']);

  assertSuccess(recent, 'Expected query-filtered recent to succeed.');
  assertChronologicalOrder(
    combinedOutput(recent),
    [matchingNew, matchingOld],
    'Expected query-filtered recent output to remain newest-first among matches.'
  );
  assertContains(recent, matchingNew, 'Expected recent query filtering to keep matching entries.');
  assertContains(recent, matchingOld, 'Expected recent query filtering to keep matching entries.');
  assertNotContains(
    recent,
    nonMatch,
    'Expected recent query filtering to exclude non-matching entries.'
  );
});

test('removed recent alias flags fail clearly and point to the scoped forms', async () => {
  const context = await createThinkContext();
  captureWithEntryId(context, 'warp replay needs better receipts');

  const countAlias = runThink(context, ['--recent', '--recent-count=2']);
  assertFailure(countAlias, 'Expected removed --recent-count alias to fail loudly.');
  assertContains(
    countAlias,
    'Use --count instead of --recent-count',
    'Expected removed --recent-count alias to point at the supported --count form.'
  );

  const queryAlias = runThink(context, ['--recent', '--recent-query=warp']);
  assertFailure(queryAlias, 'Expected removed --recent-query alias to fail loudly.');
  assertContains(
    queryAlias,
    'Use --query instead of --recent-query',
    'Expected removed --recent-query alias to point at the supported --query form.'
  );
});

test('think --json --recent applies count and query filters while remaining JSONL-only', async () => {
  const context = await createThinkContext();
  const matchingOld = 'warp replay needs better receipts';
  const nonMatch = 'turkey burritos remain underrated';
  const matchingNew = 'Warp graph should stay local-first';
  const { entryId: matchingOldId } = captureWithEntryId(context, matchingOld);
  captureWithEntryId(context, nonMatch);
  const { entryId: matchingNewId } = captureWithEntryId(context, matchingNew);

  const recent = runThink(context, ['--json', '--recent', '--query=warp', '--count=2']);

  assertSuccess(recent, 'Expected JSON filtered recent to succeed.');
  assertJsonStreams(recent);
  assert.equal((recent.stderr || '').trim(), '', 'Expected successful JSON recent to keep stderr quiet.');

  const events = parseJsonLines(
    recent.stdout,
    'Expected filtered JSON recent output to emit valid JSONL.'
  );

  assert.deepEqual(
    events.map((event) => event.event),
    [
      'cli.start',
      'recent.start',
      'recent.done',
      'recent.entry',
      'recent.entry',
      'cli.success',
    ],
    'Expected JSON recent to emit the filtered entry rows plus the usual recent command envelope rows.'
  );

  const entryEvents = events.filter((event) => event.event === 'recent.entry');
  assert.deepEqual(
    entryEvents.map((event) => event.entryId),
    [matchingNewId, matchingOldId],
    'Expected JSON recent to preserve newest-first order among filtered matches.'
  );
  assert.deepEqual(
    entryEvents.map((event) => event.text),
    [matchingNew, matchingOld],
    'Expected JSON recent to emit only matching entry text.'
  );
});

test('think --browse shows one raw thought with its immediate newer and older neighbors', async () => {
  const context = await createThinkContext();
  const olderThought = 'older thought about warp receipts';
  const currentThought = 'current thought about warp replay';
  const newerThought = 'newer thought about local-first cognition';

  captureWithEntryId(context, olderThought);
  const { entryId: currentEntryId } = captureWithEntryId(context, currentThought);
  captureWithEntryId(context, newerThought);

  const browse = runThink(context, [`--browse=${currentEntryId}`]);

  assertSuccess(browse, 'Expected browse to succeed for an explicit entry.');
  assertContains(browse, 'Browse', 'Expected browse mode to identify itself explicitly.');
  assertContains(browse, 'Current:', 'Expected browse mode to label the current entry clearly.');
  assertContains(browse, currentThought, 'Expected browse mode to show the selected entry text.');
  assertContains(browse, 'Newer:', 'Expected browse mode to expose the immediate newer neighbor.');
  assertContains(browse, newerThought, 'Expected browse mode to show the immediate newer neighbor text.');
  assertContains(browse, 'Older:', 'Expected browse mode to expose the immediate older neighbor.');
  assertContains(browse, olderThought, 'Expected browse mode to show the immediate older neighbor text.');
  assertNotContains(browse, 'summary', 'Browse should not summarize the archive.');
  assertNotContains(browse, 'cluster', 'Browse should not leak clustering language.');
  assertNotContains(browse, 'question', 'Browse should not inject prompt language.');
});

test('think --browse without an entry id fails clearly outside interactive TTY use and remains read-only', async () => {
  const context = await createThinkContext();

  const browse = runThink(context, ['--browse']);

  assertFailure(browse, 'Expected bare --browse to fail outside interactive TTY use.');
  assertContains(
    browse,
    '--browse requires an entry id outside interactive TTY use',
    'Expected bare --browse to explain that the shell entry only exists in a real TTY.'
  );
  assert.ok(
    !existsSync(context.localRepoDir),
    `Expected invalid non-interactive browse start to remain read-only, but repo was created at ${context.localRepoDir}.`
  );
});

test('think --json --browse without an entry id stays machine-readable and does not try to open the shell', async () => {
  const context = await createThinkContext();

  const browse = runThink(context, ['--json', '--browse']);

  assertFailure(browse, 'Expected JSON browse without an entry id to fail loudly.');
  const stdoutEvents = parseJsonLines(
    browse.stdout,
    'Expected invalid JSON browse to keep stdout machine-readable when present.'
  );
  const stderrEvents = parseJsonLines(
    browse.stderr,
    'Expected invalid JSON browse output to remain machine-readable on stderr.'
  );

  assert.deepEqual(
    stdoutEvents.map((event) => event.event),
    ['cli.start'],
    'Expected invalid JSON browse to keep only the standard start event on stdout.'
  );
  assert.deepEqual(
    stderrEvents.map((event) => event.event),
    ['cli.validation_failed', 'cli.failure'],
    'Expected invalid JSON browse to fail through the standard machine-readable validation path.'
  );
  assert.equal(
    stderrEvents[0].message,
    '--browse requires an entry id outside interactive TTY use',
    'Expected invalid JSON browse to expose the shell-aware validation message.'
  );
});

test('think --json --browse emits JSONL rows for the current raw thought and its neighbors', async () => {
  const context = await createThinkContext();
  const olderThought = 'older thought about warp receipts';
  const currentThought = 'current thought about warp replay';
  const newerThought = 'newer thought about local-first cognition';

  const { entryId: olderEntryId } = captureWithEntryId(context, olderThought);
  const { entryId: currentEntryId } = captureWithEntryId(context, currentThought);
  const { entryId: newerEntryId } = captureWithEntryId(context, newerThought);

  const browse = runThink(context, ['--json', `--browse=${currentEntryId}`]);

  assertSuccess(browse, 'Expected JSON browse to succeed.');
  assertJsonStreams(browse);
  assert.equal((browse.stderr || '').trim(), '', 'Expected successful JSON browse to keep stderr quiet.');

  const events = parseJsonLines(
    browse.stdout,
    'Expected JSON browse output to emit valid JSONL.'
  );

  assert.deepEqual(
    events.map((event) => event.event),
    [
      'cli.start',
      'browse.start',
      'browse.done',
      'browse.entry',
      'browse.entry',
      'browse.entry',
      'cli.success',
    ],
    'Expected JSON browse to emit the current entry and its immediate neighbors within the usual browse command envelope.'
  );

  const browseEvents = events.filter((event) => event.event === 'browse.entry');
  assert.deepEqual(
    browseEvents.map((event) => event.role),
    ['current', 'newer', 'older'],
    'Expected JSON browse rows to label each entry role explicitly.'
  );
  assert.deepEqual(
    browseEvents.map((event) => event.entryId),
    [currentEntryId, newerEntryId, olderEntryId],
    'Expected JSON browse rows to expose the selected entry and both immediate neighbors.'
  );
  assert.deepEqual(
    browseEvents.map((event) => event.text),
    [currentThought, newerThought, olderThought],
    'Expected JSON browse rows to preserve exact raw text for the selected entry and both neighbors.'
  );
});

test('think --browse opens the scripted interactive shell, navigates older and newer, and exits cleanly', async () => {
  const context = await createThinkContext();
  const olderThought = 'older thought about warp receipts';
  const currentThought = 'current thought about warp replay';
  const newerThought = 'newer thought about local-first cognition';

  const { entryId: olderEntryId } = captureWithEntryId(context, olderThought);
  const { entryId: currentEntryId } = captureWithEntryId(context, currentThought);
  const { entryId: newerEntryId } = captureWithEntryId(context, newerThought);

  const browse = runThink(
    context,
    ['--browse'],
    {
      THINK_TEST_INTERACTIVE: '1',
      THINK_TEST_BROWSE_SCRIPT: JSON.stringify({
        seedEntryId: currentEntryId,
        actions: ['older', 'newer', 'quit'],
      }),
    }
  );

  assertSuccess(browse, 'Expected scripted interactive browse shell to succeed.');
  assertContains(browse, 'Choose a thought to browse', 'Expected the shell to start with an explicit browse picker.');
  assertContains(browse, currentThought, 'Expected the shell to show the selected current thought.');
  assertContains(browse, olderThought, 'Expected the shell to reach the older neighbor after scripted navigation.');
  assertContains(browse, newerThought, 'Expected the shell to return to the newer/current neighborhood after scripted navigation.');

  const recent = runThink(context, ['--recent']);
  assertSuccess(recent, 'Expected browse shell usage to remain read-only.');
  assertContains(recent, newerThought, 'Expected browse shell usage to preserve raw captures.');
  assertContains(recent, currentThought, 'Expected browse shell usage to preserve raw captures.');
  assertContains(recent, olderThought, 'Expected browse shell usage to preserve raw captures.');
  assertNotContains(recent, olderEntryId, 'Expected browse shell usage not to leak entry ids into recent output.');
  assertNotContains(recent, newerEntryId, 'Expected browse shell usage not to leak entry ids into recent output.');
});

test('think --browse can reveal inspect receipts inside the scripted interactive shell', async () => {
  const context = await createThinkContext();
  const seedThought = 'We should make warp graph the thought substrate';
  const reflectAnswer = 'The substrate only matters if browse can reveal the same inspect receipts honestly.';
  const { entryId: seedEntryId } = captureWithEntryId(context, seedThought);

  const start = runThink(context, ['--verbose', `--reflect=${seedEntryId}`]);
  assertSuccess(start, 'Expected reflect start to succeed before browse-shell inspect.');
  const sessionStarted = getEvent(
    parseJsonLines(start.stderr, 'Expected verbose reflect start to emit valid JSONL trace events.'),
    'reflect.session_started',
    'Expected reflect start to expose session lineage.'
  );

  const reply = runThink(context, ['--verbose', `--reflect-session=${sessionStarted.sessionId}`, reflectAnswer]);
  assertSuccess(reply, 'Expected reflect reply to succeed before browse-shell inspect.');
  const saved = getEvent(
    parseJsonLines(reply.stderr, 'Expected verbose reflect reply to emit valid JSONL trace events.'),
    'reflect.entry_saved',
    'Expected reflect reply to expose the saved derived entry.'
  );

  const browse = runThink(
    context,
    ['--browse'],
    {
      THINK_TEST_INTERACTIVE: '1',
      THINK_TEST_BROWSE_SCRIPT: JSON.stringify({
        seedEntryId,
        actions: ['inspect', 'quit'],
      }),
    }
  );

  assertSuccess(browse, 'Expected scripted interactive browse inspect to succeed.');
  assertContains(browse, 'Thought ID:', 'Expected the browse shell inspect pane to expose canonical content identity.');
  assertContains(browse, 'Derived receipts:', 'Expected the browse shell inspect pane to expose derived receipts.');
  assertContains(browse, saved.entryId, 'Expected the browse shell inspect pane to expose the direct reflect descendant.');
});

test('think --browse can hand the selected thought into reflect from the scripted interactive shell', async () => {
  const context = await createThinkContext();
  const seedThought = 'We should make warp graph the thought substrate';
  const reflectAnswer = 'Browse should let me hand off directly into reflect without guessing ids.';
  const { entryId: seedEntryId } = captureWithEntryId(context, seedThought);

  const browse = runThink(
    context,
    ['--browse'],
    {
      THINK_TEST_INTERACTIVE: '1',
      THINK_TEST_BROWSE_SCRIPT: JSON.stringify({
        seedEntryId,
        actions: [
          {
            type: 'reflect',
            mode: 'sharpen',
            response: reflectAnswer,
          },
        ],
      }),
    }
  );

  assertSuccess(browse, 'Expected scripted browse shell reflect handoff to succeed.');
  assertContains(browse, 'Reflect', 'Expected the shell to hand off into reflect explicitly.');
  assertContains(browse, 'Reflect saved', 'Expected the shell reflect handoff to save a derived reflect entry.');

  const inspect = runThink(context, [`--inspect=${seedEntryId}`]);
  assertSuccess(inspect, 'Expected inspect to succeed after browse-shell reflect handoff.');
  assertContains(inspect, 'Derived receipts:', 'Expected reflect handoff to create inspectable derived receipts.');
  assertContains(inspect, 'Reflect:', 'Expected the reflect handoff to appear as a derived receipt on the seed thought.');
});

test('think --inspect exposes exact raw entry metadata without narration', async () => {
  const context = await createThinkContext();
  const thought = 'inspect should reveal the exact stored thought';
  const { entryId } = captureWithEntryId(context, thought);

  const inspect = runThink(context, [`--inspect=${entryId}`]);

  assertSuccess(inspect, 'Expected inspect to succeed for an explicit raw entry.');
  assertContains(inspect, 'Inspect', 'Expected inspect mode to identify itself explicitly.');
  assertContains(inspect, `Entry ID: ${entryId}`, 'Expected inspect to expose the entry id plainly.');
  assertContains(inspect, 'Kind: raw_capture', 'Expected inspect to identify the stored entry kind.');
  assertContains(inspect, 'Text:', 'Expected inspect to label the exact stored text explicitly.');
  assertContains(inspect, thought, 'Expected inspect to expose the exact stored raw text.');
  assertNotContains(inspect, 'summary', 'Inspect should not summarize the entry.');
  assertNotContains(inspect, 'related', 'Inspect should not inject relatedness claims.');
  assertNotContains(inspect, 'question', 'Inspect should not inject prompt language.');
});

test('think --json --inspect emits JSONL for the exact raw entry metadata', async () => {
  const context = await createThinkContext();
  const thought = 'inspect should reveal the exact stored thought';
  const { entryId } = captureWithEntryId(context, thought);

  const inspect = runThink(context, ['--json', `--inspect=${entryId}`]);

  assertSuccess(inspect, 'Expected JSON inspect to succeed.');
  assertJsonStreams(inspect);
  assert.equal((inspect.stderr || '').trim(), '', 'Expected successful JSON inspect to keep stderr quiet.');

  const events = parseJsonLines(
    inspect.stdout,
    'Expected JSON inspect output to emit valid JSONL.'
  );

  assert.equal(events[0].event, 'cli.start', 'Expected JSON inspect to start with the CLI envelope.');
  assert.equal(events[1].event, 'inspect.start', 'Expected JSON inspect to emit an inspect start row.');
  assert.equal(events[2].event, 'inspect.done', 'Expected JSON inspect to emit an inspect completion row.');
  assert.equal(events.at(-1)?.event, 'cli.success', 'Expected JSON inspect to end with a CLI success row.');

  const inspectedEntry = getEvent(
    events,
    'inspect.entry',
    'Expected JSON inspect to expose the raw entry metadata.'
  );

  assert.equal(inspectedEntry.entryId, entryId, 'Expected JSON inspect to preserve the requested entry id.');
  assert.equal(inspectedEntry.kind, 'raw_capture', 'Expected JSON inspect to identify the raw entry kind.');
  assert.equal(inspectedEntry.text, thought, 'Expected JSON inspect to preserve the exact stored raw text.');
  assert.equal(typeof inspectedEntry.sortKey, 'string', 'Expected JSON inspect to expose stable ordering metadata.');
});

test('think --inspect exposes canonical content identity and direct derived receipts when they exist', async () => {
  const context = await createThinkContext();
  const seedThought = 'We should make warp graph the thought substrate';
  const reflectAnswer = 'The substrate only matters if inspect can show the raw thought and its derived descendants honestly.';
  const { entryId: seedEntryId } = captureWithEntryId(context, seedThought);

  const start = runThink(context, ['--verbose', `--reflect=${seedEntryId}`]);
  assertSuccess(start, 'Expected reflect start to succeed before inspecting derived receipts.');
  const sessionStarted = getEvent(
    parseJsonLines(start.stderr, 'Expected verbose reflect start to emit valid JSONL trace events.'),
    'reflect.session_started',
    'Expected reflect start to emit session metadata.'
  );

  const reply = runThink(context, ['--verbose', `--reflect-session=${sessionStarted.sessionId}`, reflectAnswer]);
  assertSuccess(reply, 'Expected reflect reply to succeed before inspecting derived receipts.');
  const saved = getEvent(
    parseJsonLines(reply.stderr, 'Expected verbose reflect reply to emit valid JSONL trace events.'),
    'reflect.entry_saved',
    'Expected reflect reply to expose the saved derived entry.'
  );

  const inspect = runThink(context, [`--inspect=${seedEntryId}`]);

  assertSuccess(inspect, 'Expected inspect to succeed for a raw entry with derived reflect activity.');
  assertContains(inspect, 'Thought ID:', 'Expected inspect to expose canonical content identity.');
  assertContains(inspect, 'Derived receipts:', 'Expected inspect to expose derived receipt structure.');
  assertContains(inspect, 'Reflect:', 'Expected inspect to expose the direct reflect descendant plainly.');
  assertContains(inspect, saved.entryId, 'Expected inspect to expose the derived reflect entry id.');
  assertContains(inspect, sessionStarted.sessionId, 'Expected inspect to expose the reflect session lineage.');
});

test('think --json --inspect emits canonical content identity and direct derived receipt rows', async () => {
  const context = await createThinkContext();
  const seedThought = 'We should make warp graph the thought substrate';
  const reflectAnswer = 'The substrate only matters if inspect can show the raw thought and its derived descendants honestly.';
  const { entryId: seedEntryId } = captureWithEntryId(context, seedThought);

  const start = runThink(context, ['--verbose', `--reflect=${seedEntryId}`]);
  assertSuccess(start, 'Expected reflect start to succeed before inspecting derived receipts.');
  const sessionStarted = getEvent(
    parseJsonLines(start.stderr, 'Expected verbose reflect start to emit valid JSONL trace events.'),
    'reflect.session_started',
    'Expected reflect start to emit session metadata.'
  );

  const reply = runThink(context, ['--verbose', `--reflect-session=${sessionStarted.sessionId}`, reflectAnswer]);
  assertSuccess(reply, 'Expected reflect reply to succeed before inspecting derived receipts.');
  const saved = getEvent(
    parseJsonLines(reply.stderr, 'Expected verbose reflect reply to emit valid JSONL trace events.'),
    'reflect.entry_saved',
    'Expected reflect reply to expose the saved derived entry.'
  );

  const inspect = runThink(context, ['--json', `--inspect=${seedEntryId}`]);

  assertSuccess(inspect, 'Expected JSON inspect to succeed for a raw entry with derived reflect activity.');
  assertJsonStreams(inspect);
  assert.equal((inspect.stderr || '').trim(), '', 'Expected successful JSON inspect to keep stderr quiet.');

  const events = parseJsonLines(
    inspect.stdout,
    'Expected JSON inspect with derived receipts to emit valid JSONL.'
  );

  const inspectedEntry = getEvent(
    events,
    'inspect.entry',
    'Expected JSON inspect to expose the requested raw entry metadata.'
  );
  assert.equal(typeof inspectedEntry.thoughtId, 'string', 'Expected JSON inspect to expose canonical content identity.');
  assert.match(inspectedEntry.thoughtId, /^thought:/, 'Expected canonical content identity to use the thought: namespace.');

  const receipt = getEvent(
    events,
    'inspect.receipt',
    'Expected JSON inspect to emit a receipt row for the direct derived reflect entry.'
  );
  assert.equal(receipt.relation, 'seed_of', 'Expected inspect receipts to identify the lineage relation explicitly.');
  assert.equal(receipt.kind, 'reflect', 'Expected inspect receipts to expose the direct derived reflect kind.');
  assert.equal(receipt.entryId, saved.entryId, 'Expected inspect receipts to point at the derived reflect entry.');
  assert.equal(receipt.sessionId, sessionStarted.sessionId, 'Expected inspect receipts to expose session lineage.');
  assert.equal(
    receipt.promptType,
    sessionStarted.promptType,
    'Expected inspect receipts to preserve the prompt family used to create the reflect descendant.'
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
  const event = events.find((candidate) => candidate.event === name);
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
