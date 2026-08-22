import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  WorkGraphError,
  githubPlan,
  renderCatalog,
  renderIssueBody,
  validateManifest,
} from '../../scripts/adr-think-001-work-items.mjs';

const manifestUrl = new URL('../../docs/design/ADR-THINK-001-work-items.json', import.meta.url);
const emptyMap = Object.freeze({ schemaVersion: 1, repository: 'flyingrobots/think', milestones: {}, issues: {} });

async function loadManifest() {
  return JSON.parse(await readFile(manifestUrl, 'utf8'));
}

test('accepted work graph is complete and renderable', async () => {
  const manifest = await loadManifest();
  assert.doesNotThrow(() => validateManifest(manifest));
  const plan = githubPlan(manifest, emptyMap);
  assert.equal(plan.milestones.length, 9);
  assert.equal(plan.issues.length, 60);
  assert.match(renderCatalog(manifest, emptyMap), /Complete dependency graph/u);
});

test('GitHub issue body contains every promised review surface', async () => {
  const manifest = await loadManifest();
  const issue = manifest.issues.find((item) => item.id === 'CT-104');
  const body = renderIssueBody(issue, manifest, emptyMap);
  assert.match(body, /adr-think-001-work-item: CT-104/u);
  assert.match(body, /## User stories[\s\S]*## Test plan/u);
  assert.match(body, /## Build-time resources[\s\S]*\*\*exclusive\*\*/u);
  assert.match(body, /## ADR traceability[\s\S]*## Non-goals/u);
});

test('validator rejects incomplete stories and invalid resource modes', async () => {
  const incomplete = await loadManifest();
  incomplete.issues[0].stories = [];
  assert.throws(() => validateManifest(incomplete), WorkGraphError);

  const invalidMode = await loadManifest();
  invalidMode.issues[0].resources[0].mode = 'ambient';
  assert.throws(() => validateManifest(invalidMode), WorkGraphError);
});

test('validator rejects dependency reorder and traceability loss', async () => {
  const reordered = await loadManifest();
  reordered.issues[0].blockedBy = ['CT-805'];
  assert.throws(() => validateManifest(reordered), WorkGraphError);

  const missingCriterion = await loadManifest();
  for (const issue of missingCriterion.issues) {
    issue.criteria = issue.criteria.filter((criterion) => criterion !== 'AC35');
  }
  assert.throws(() => validateManifest(missingCriterion), WorkGraphError);
});
