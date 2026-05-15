import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const contractPath = path.resolve('contracts', 'think-memory.graphql');
const requiredFragments = Object.freeze([
  'type ThoughtContent',
  'type ThoughtCapture',
  'type ThoughtProvenance',
  'type CausalRef',
  'content: ThoughtContent!',
  'capture: ThoughtCapture!',
  'provenance: ThoughtProvenance!',
  'causalRef: CausalRef!',
  'thoughtId: ID!',
  'mindId: ID!',
  'type Mutation',
  'captureThought(input: CaptureThoughtInput!): CaptureThoughtResult!',
  '@wes_op(name: "CaptureThought")',
  '@wes_footprint(reads: ["ThoughtEntry"], writes: ["ThoughtEntry"])',
  'type Query',
  'inspectThought(mindId: ID!, thoughtId: ID!): ThoughtEntry!',
  '@wes_op(name: "InspectThought")',
]);

test('Think Echo contract expresses the pinned memory model', async () => {
  const source = await readFile(contractPath, 'utf8');
  for (const fragment of requiredFragments) {
    assert.ok(source.includes(fragment), `Expected contract to include ${fragment}`);
  }
});
