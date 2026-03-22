import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync } from 'node:fs';

import {
  runThink,
  createThinkContext,
} from '../fixtures/think.js';

import {
  assertBefore,
  assertChronologicalOrder,
  assertContains,
  assertFailure,
  assertNotContains,
  assertOccurrences,
  assertSuccess,
  combinedOutput,
} from '../support/assertions.js';

test('CLI raw capture bootstraps the local repo and preserves exact text', async () => {
  const context = await createThinkContext();
  const thought = 'turkey is good in burritos';

  const capture = runThink(context, [thought]);
  assertSuccess(capture, 'Expected first raw capture to succeed on a fresh app home.');
  assertContains(capture, 'Saved locally', 'Expected capture success language to stay product-facing.');
  assert.ok(
    existsSync(context.localRepoDir),
    `Expected first capture to bootstrap the private local repo at ${context.localRepoDir}.`
  );

  const recent = runThink(context, ['recent']);
  assertSuccess(recent, 'Expected recent to succeed after the first capture.');
  assertContains(recent, thought, 'Expected recent to show the exact saved text.');
});

test('capture does not require retrieval-before-write or conceptual confirmation', async () => {
  const context = await createThinkContext();

  assertSuccess(runThink(context, ['first thought']), 'Expected initial capture to seed the local repo.');

  const capture = runThink(context, ['second thought']);
  assertSuccess(capture, 'Expected later capture to succeed when prior entries already exist.');
  assertNotContains(capture, 'related', 'Capture should not dump inferred relatedness into the user moment.');
  assertNotContains(capture, 'previous', 'Capture should not require inspecting previous thoughts before save.');
  assertNotContains(capture, 'confirm', 'Capture should not ask for conceptual confirmation before save.');
  assertNotContains(capture, 'match', 'Capture should not prompt about conceptual matches before save.');
});

test('reachable upstream reports local save first and backup second', async () => {
  const context = await createThinkContext({ upstream: 'bare' });

  const capture = runThink(context, ['backup success thought']);
  assertSuccess(capture, 'Expected capture to succeed when a reachable upstream is configured.');
  assertContains(capture, 'Saved locally', 'Expected local success to be reported.');
  assertContains(capture, 'Backed up', 'Expected reachable upstream to report backup completion.');
  assertBefore(capture, 'Saved locally', 'Backed up', 'Expected local success to be reported before backup completion.');
});

test('unreachable upstream keeps capture successful and reports backup pending', async () => {
  const context = await createThinkContext({ upstream: 'unreachable' });

  const capture = runThink(context, ['backup pending thought']);
  assertSuccess(capture, 'Expected local capture to succeed even when upstream is unreachable.');
  assertContains(capture, 'Saved locally', 'Expected local save success to be reported.');
  assertContains(capture, 'Backup pending', 'Expected unreachable upstream to report backup pending.');
});

test('recent stays plain and chronological', async () => {
  const context = await createThinkContext();
  const entries = [
    'alpha capture',
    'beta capture',
    'gamma capture',
  ];

  for (const entry of entries) {
    assertSuccess(runThink(context, [entry]), `Expected capture to succeed for entry: ${entry}`);
  }

  const recent = runThink(context, ['recent']);
  assertSuccess(recent, 'Expected recent to succeed after multiple captures.');
  const output = combinedOutput(recent);

  assertChronologicalOrder(
    output,
    [...entries].reverse(),
    'Expected recent output to remain newest-first and chronological.'
  );
  assertNotContains(recent, 'summary', 'Recent should not add summaries.');
  assertNotContains(recent, 'cluster', 'Recent should not add clustering language.');
  assertNotContains(recent, 'related', 'Recent should not inject inferred relatedness.');
});

test('capture is append-only across later capture activity', async () => {
  const context = await createThinkContext();
  const original = 'turky is good in burritos';
  const later = 'later unrelated thought';

  assertSuccess(runThink(context, [original]), 'Expected first capture to succeed.');
  assertSuccess(runThink(context, [later]), 'Expected later capture activity to succeed.');

  const recent = runThink(context, ['recent']);
  assertSuccess(recent, 'Expected recent to succeed after later capture activity.');
  assertContains(recent, original, 'Expected original raw wording to remain unchanged.');
  assertContains(recent, later, 'Expected later raw wording to exist alongside the earlier capture.');
  assertBefore(
    recent,
    later,
    original,
    'Expected append-only behavior to preserve the earlier entry while placing the newer entry first.'
  );
});

test('duplicate thoughts produce distinct captures rather than deduping', async () => {
  const context = await createThinkContext();
  const thought = 'same thought';

  assertSuccess(runThink(context, [thought]), 'Expected first duplicate capture to succeed.');
  assertSuccess(runThink(context, [thought]), 'Expected second duplicate capture to succeed.');

  const recent = runThink(context, ['recent']);
  assertSuccess(recent, 'Expected recent to succeed after duplicate captures.');
  assertOccurrences(
    recent,
    thought,
    2,
    'Expected duplicate captures to remain distinct entries rather than being deduped.'
  );
});

test('empty input is rejected', async () => {
  const context = await createThinkContext();

  const result = runThink(context, ['']);
  assertFailure(result, 'Expected empty input to be rejected.');
  assertContains(result, 'Thought cannot be empty', 'Expected a clear validation error for empty input.');
});

test('whitespace-only input is rejected', async () => {
  const context = await createThinkContext();

  const result = runThink(context, ['   ']);
  assertFailure(result, 'Expected whitespace-only input to be rejected.');
  assertContains(result, 'Thought cannot be empty', 'Expected whitespace-only input to use the same validation rule.');
});

test('capture preserves formatting neutrality for spacing, casing, and punctuation', async () => {
  const context = await createThinkContext();
  const thought = 'Mixed CASE, punctuation!!! and   spacing';

  const capture = runThink(context, [thought]);
  assertSuccess(capture, 'Expected formatting-neutral capture to succeed.');

  const recent = runThink(context, ['recent']);
  assertSuccess(recent, 'Expected recent to succeed after formatting-neutral capture.');
  assertContains(
    recent,
    thought,
    'Expected recent to preserve exact spacing, casing, and punctuation from the original capture.'
  );
});

test('default user language avoids Git terminology', async () => {
  const context = await createThinkContext({ upstream: 'unreachable' });

  const capture = runThink(context, ['language contract thought']);
  assertSuccess(capture, 'Expected capture to succeed for default-language assertions.');
  assertContains(capture, 'Saved locally', 'Expected product-facing local success language.');
  assertContains(capture, 'Backup pending', 'Expected product-facing pending backup language.');

  for (const forbidden of ['commit', 'push', 'pull', 'ref', 'repo']) {
    assertNotContains(
      capture,
      forbidden,
      `Default capture UX should not require Git terminology such as "${forbidden}".`
    );
  }
});

test.todo('raw entries remain immutable after later derived entries exist');
test.todo('stored raw entry bytes remain unchanged in the local store after later writes');
test.todo('entry kind separation remains explicit once the first derived-entry write path exists');
