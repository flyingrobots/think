import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const contractPath = path.resolve('contracts', 'think-memory.graphql');
const requiredFragments = Object.freeze([
  'type Mutation',
  'captureThought(input: CaptureThoughtInput!): CaptureThoughtResult!',
  '@wes_op(name: "CaptureThought")',
  '@wes_footprint(reads: ["ThoughtEntry"], writes: ["ThoughtEntry"])',
  'type Query',
  'inspectThought(mindId: ID!, entryId: ID!): ThoughtEntry!',
  '@wes_op(name: "InspectThought")',
  'mindId: ID!',
]);

test('Think Echo contract owns raw capture and exact inspect nouns', async () => {
  const source = await readFile(contractPath, 'utf8');
  for (const fragment of requiredFragments) {
    assert.ok(source.includes(fragment), `Expected contract to include ${fragment}`);
  }
});
