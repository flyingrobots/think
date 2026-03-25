import assert from 'node:assert/strict';
import test from 'node:test';

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

  assert.deepEqual(
    events.map((event) => event.event),
    [
      'cli.start',
      'inspect.start',
      'inspect.done',
      'inspect.entry',
      'cli.success',
    ],
    'Expected JSON inspect to emit one structured entry row plus the usual inspect command envelope rows.'
  );

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
