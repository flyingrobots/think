import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const integrationDocPath = path.resolve(
  'docs',
  'design',
  '0069-think-echo-integration-plan',
  'think-echo-integration-plan.md'
);
const requiredFragments = Object.freeze([
  'MemoryRuntimePort',
  'EchoMemoryRuntime',
  'GitWarpMemoryRuntime',
  'CaptureThought -> Echo dispatch_intent',
  'InspectThought -> Echo observe',
  'ReadingEnvelope + decoded ThoughtEntry',
  '```mermaid\nflowchart TD',
  '```mermaid\nsequenceDiagram',
  '```mermaid\nstateDiagram-v2',
  '```mermaid\nclassDiagram',
  'Verification Gates',
  'Failure Handling',
  'Rollout Phases',
]);

test('Think Echo integration plan defines the runtime port and proof path', async () => {
  const source = await readFile(integrationDocPath, 'utf8');
  for (const fragment of requiredFragments) {
    assert.ok(source.includes(fragment), `Expected integration doc to include ${fragment}`);
  }
});
