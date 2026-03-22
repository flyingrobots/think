import assert from 'node:assert/strict';

import { formatResult } from '../fixtures/runtime.js';

export function combinedOutput(result) {
  return `${result.stdout || ''}${result.stderr || ''}`;
}

export function assertSuccess(result, message) {
  assert.equal(result.status, 0, `${message}\n${formatResult(result)}`);
}

export function assertFailure(result, message) {
  assert.notEqual(result.status, 0, `${message}\n${formatResult(result)}`);
}

export function assertContains(result, snippet, message) {
  assert.match(
    combinedOutput(result),
    new RegExp(escapeRegExp(snippet)),
    `${message}\nExpected output to contain: ${snippet}\n${formatResult(result)}`
  );
}

export function assertNotContains(result, snippet, message) {
  assert.doesNotMatch(
    combinedOutput(result),
    new RegExp(escapeRegExp(snippet)),
    `${message}\nDid not expect output to contain: ${snippet}\n${formatResult(result)}`
  );
}

export function assertBefore(result, earlier, later, message) {
  const output = combinedOutput(result);
  const earlierIndex = output.indexOf(earlier);
  const laterIndex = output.indexOf(later);

  assert.notEqual(
    earlierIndex,
    -1,
    `${message}\nCould not find earlier snippet: ${earlier}\n${formatResult(result)}`
  );
  assert.notEqual(
    laterIndex,
    -1,
    `${message}\nCould not find later snippet: ${later}\n${formatResult(result)}`
  );
  assert.ok(
    earlierIndex < laterIndex,
    `${message}\nExpected "${earlier}" to appear before "${later}".\n${formatResult(result)}`
  );
}

export function assertChronologicalOrder(output, entries, message) {
  const positions = entries.map((entry) => output.indexOf(entry));

  for (let index = 0; index < entries.length; index += 1) {
    assert.notEqual(
      positions[index],
      -1,
      `${message}\nMissing entry in output: ${entries[index]}\nOutput was:\n${output}`
    );
  }

  const ascending = positions.every((position, index) => index === 0 || positions[index - 1] < position);

  assert.ok(
    ascending,
    [
      message,
      'Expected entries to appear in the provided order.',
      `Positions: ${JSON.stringify(positions)}`,
      'Output was:',
      output,
    ].join('\n')
  );
}

export function assertOccurrences(result, snippet, expectedCount, message) {
  const output = combinedOutput(result);
  const matches = output.match(new RegExp(escapeRegExp(snippet), 'g')) ?? [];

  assert.equal(
    matches.length,
    expectedCount,
    `${message}\nExpected ${expectedCount} occurrences of: ${snippet}\nOutput was:\n${output}`
  );
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
