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
const sourceOfTruthWordingPaths = Object.freeze([
  path.resolve('contracts', 'think-memory.graphql'),
  modelDocPath,
  path.resolve(
    'docs',
    'design',
    '0069-think-echo-integration-plan',
    'think-echo-integration-plan.md'
  ),
  path.resolve('docs', 'method', 'backlog', 'asap', 'CORE_think-echo-contract-proof.md'),
]);
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

test('Think Echo contract docs use source of truth wording consistently', async () => {
  const docs = await Promise.all(sourceOfTruthWordingPaths.map(async (docPath) => Object.freeze({
    docPath,
    source: await readFile(docPath, 'utf8'),
  })));
  for (const { docPath, source } of docs) {
    assert.doesNotMatch(source, /\bsource truth\b/iu, `Expected ${docPath} to avoid source truth.`);
  }
});
