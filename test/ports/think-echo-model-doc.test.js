import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const modelDocPath = path.resolve(
  'docs',
  'design',
  '0068-think-memory-data-model',
  'think-memory-data-model.md'
);
const requiredFragments = Object.freeze([
  'Mind',
  'ThoughtEntry',
  'ThoughtContent',
  'ThoughtCapture',
  'ThoughtInspection',
  'ThoughtCursor',
  'ThoughtQuery',
  'ThoughtProvenance',
  'ThoughtTags',
  'ThoughtFacets',
  '```mermaid\nflowchart TD',
  '```mermaid\nsequenceDiagram',
  '```mermaid\nclassDiagram',
  '```mermaid\nerDiagram',
  'Migration Plan From git-warp To Echo',
  'GraphQL expresses this model',
]);

test('Think Echo data model is pinned before the runtime round trip', async () => {
  const source = await readFile(modelDocPath, 'utf8');
  for (const fragment of requiredFragments) {
    assert.ok(source.includes(fragment), `Expected model doc to include ${fragment}`);
  }
});
