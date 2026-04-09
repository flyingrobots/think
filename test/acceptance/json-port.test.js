import assert from 'node:assert/strict';
import test from 'node:test';

import { createThinkContext, runThink } from '../fixtures/think.js';
import { assertSuccess } from '../support/assertions.js';

test('think --json emits deterministically sorted keys in JSONL output', async () => {
  const context = await createThinkContext();

  const capture = runThink(context, ['--json', 'json key ordering should stay deterministic']);

  assertSuccess(capture, 'Expected --json capture to succeed for JSON key-order assertions.');
  const lines = String(capture.stdout)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const captureStatusLine = lines.find((line) => line.includes('"event":"capture.status"'));

  assert.ok(captureStatusLine, 'Expected --json capture output to include a capture.status row.');
  assert.match(
    captureStatusLine,
    /^\{"entryId":"[^"]+","event":"capture\.status","message":"Saved locally","status":"saved_locally","ts":"[^"]+"\}$/,
    `Expected capture.status JSONL to use deterministically sorted keys.\nLine was:\n${captureStatusLine}`
  );
});
