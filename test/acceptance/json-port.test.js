import assert from 'node:assert/strict';
import test from 'node:test';

import { parseJson, stringifyJson } from '../../src/json.js';
import { createThinkContext, runThink } from '../fixtures/think.js';
import { assertSuccess } from '../support/assertions.js';

test('shared JSON helper canonicalizes object keys deterministically on parse and stringify', () => {
  const parsed = parseJson('{"z":{"b":1,"a":2},"a":[{"d":4,"c":3}]}');

  assert.deepEqual(
    Object.keys(parsed),
    ['a', 'z'],
    'Expected top-level parsed object keys to be inserted in sorted order.'
  );
  assert.deepEqual(
    Object.keys(parsed.z),
    ['a', 'b'],
    'Expected nested parsed object keys to be inserted in sorted order.'
  );
  assert.deepEqual(
    Object.keys(parsed.a[0]),
    ['c', 'd'],
    'Expected array members to be canonicalized recursively without changing array order.'
  );

  assert.equal(
    stringifyJson({ z: { b: 1, a: 2 }, a: [{ d: 4, c: 3 }] }),
    '{"a":[{"c":3,"d":4}],"z":{"a":2,"b":1}}',
    'Expected stringifyJson to emit deterministic lexicographically sorted keys recursively.'
  );
});

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
