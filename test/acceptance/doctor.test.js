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

test('think --doctor reports health of a repo with captures', async () => {
  const context = await createThinkContext();

  assertSuccess(runThink(context, ['first thought']), 'Expected capture to succeed.');

  const doctor = runThink(context, ['--doctor']);
  assertSuccess(doctor, 'Expected doctor to succeed.');
  assertContains(doctor, 'Local repo', 'Expected doctor to check the local repo.');
});

test('think --doctor succeeds before the first capture', async () => {
  const context = await createThinkContext();

  const doctor = runThink(context, ['--doctor']);
  assertSuccess(doctor, 'Expected doctor to succeed even with no captures.');
});

test('think --json --doctor emits a structured health report', async () => {
  const context = await createThinkContext();

  assertSuccess(runThink(context, ['a thought']), 'Expected capture to succeed.');

  const doctor = runThink(context, ['--json', '--doctor']);
  assertSuccess(doctor, 'Expected --json --doctor to succeed.');

  const events = parseJsonLines(doctor.stdout);
  const resultEvent = events.find((e) => e.event === 'doctor.result');
  assert.ok(resultEvent, 'Expected a doctor.result event in JSON output.');
  assert.ok(Array.isArray(resultEvent.checks), 'Expected checks to be an array.');

  const names = resultEvent.checks.map((c) => c.name);
  assert.ok(names.includes('think_dir'), 'Expected think_dir check in JSON result.');
  assert.ok(names.includes('local_repo'), 'Expected local_repo check in JSON result.');
});

test('think --doctor rejects an unexpected thought argument', async () => {
  const context = await createThinkContext();

  const doctor = runThink(context, ['--doctor', 'this should fail']);
  assert.notEqual(doctor.status, 0, 'Expected --doctor with a thought to fail.');
  assertContains(doctor, '--doctor does not take a thought', 'Expected validation error.');
});
