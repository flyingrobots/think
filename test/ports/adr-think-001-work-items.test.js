import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  WorkGraphError,
  githubPlan,
  reconcileGithubRemote,
  renderCatalog,
  renderIssueBody,
  validateCatalog,
  validateGithubMap,
  validateManifest,
} from '../../scripts/adr-think-001-work-items.mjs';

const manifestUrl = new URL('../../docs/design/ADR-THINK-001-work-items.json', import.meta.url);
const githubMapUrl = new URL('../../docs/design/ADR-THINK-001-github-map.json', import.meta.url);
const catalogUrl = new URL('../../docs/design/ADR-THINK-001-issue-catalog.md', import.meta.url);

async function loadManifest() {
  return JSON.parse(await readFile(manifestUrl, 'utf8'));
}

async function loadGithubMap() {
  return JSON.parse(await readFile(githubMapUrl, 'utf8'));
}

test('accepted work graph is complete and renderable', async () => {
  const manifest = await loadManifest();
  const githubMap = await loadGithubMap();
  assert.doesNotThrow(() => validateManifest(manifest));
  assert.doesNotThrow(() => validateGithubMap(manifest, githubMap));
  const plan = githubPlan(manifest, githubMap);
  assert.equal(plan.milestones.length, 9);
  assert.equal(plan.issues.length, 60);
  const catalog = renderCatalog(manifest, githubMap);
  assert.match(catalog, /Complete dependency graph/u);
  assert.match(catalog, /git-stunts\/git-warp#824/u);
  assert.match(catalog, /EXT\d+ -\. external \.-> CT\d+/u);
});

test('GitHub issue body contains every promised review surface', async () => {
  const manifest = await loadManifest();
  const githubMap = await loadGithubMap();
  const issue = manifest.issues.find((item) => item.id === 'CT-104');
  const body = renderIssueBody(issue, manifest, githubMap);
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

  const replacedMode = await loadManifest();
  replacedMode.resourceModes.ambient = replacedMode.resourceModes.partitioned;
  delete replacedMode.resourceModes.partitioned;
  assert.throws(
    () => validateManifest(replacedMode),
    /manifest\.resourceModes must define exactly: exclusive, partitioned, shared/u,
  );
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

  const renamedIssue = await loadManifest();
  renamedIssue.issues.at(-1).id = 'CT-899';
  assert.throws(
    () => validateManifest(renamedIssue),
    /exact stable ADR-THINK-001 issue identifier set/u,
  );
});

test('migration and production cutover remain gated by the complete constitutional graph', async () => {
  const manifest = await loadManifest();
  const migrator = manifest.issues.find((issue) => issue.id === 'CT-303');
  assert.deepEqual(
    ['CT-004', 'CT-005', 'CT-006'].filter((id) => !migrator.blockedBy.includes(id)),
    [],
  );
  const finalCutover = manifest.issues.find((issue) => issue.id === 'CT-805');
  assert.match(finalCutover.title, /production cutover/u);
  assert.deepEqual(finalCutover.criteria, Array.from({ length: 35 }, (_, index) => `AC${index + 1}`));
});

test('GitHub map and generated catalog fail closed when incomplete or stale', async () => {
  const manifest = await loadManifest();
  const githubMap = await loadGithubMap();
  const catalog = await readFile(catalogUrl, 'utf8');
  assert.doesNotThrow(() => validateGithubMap(manifest, githubMap));
  assert.doesNotThrow(() => validateCatalog(manifest, githubMap, catalog));

  const incompleteMap = structuredClone(githubMap);
  delete incompleteMap.issues['CT-303'];
  assert.throws(() => validateGithubMap(manifest, incompleteMap), /github map issues must define exactly/u);

  const staleMap = structuredClone(githubMap);
  staleMap.issues['CT-303'].title = '[CT-303] stale';
  assert.throws(() => validateGithubMap(manifest, staleMap), /CT-303 GitHub issue title is stale/u);

  const duplicateIssueNumber = structuredClone(githubMap);
  duplicateIssueNumber.issues['CT-303'].number = duplicateIssueNumber.issues['CT-302'].number;
  duplicateIssueNumber.issues['CT-303'].url = duplicateIssueNumber.issues['CT-302'].url;
  assert.throws(
    () => validateGithubMap(manifest, duplicateIssueNumber),
    /github map issue numbers must be unique/u,
  );

  const duplicateMilestoneNumber = structuredClone(githubMap);
  duplicateMilestoneNumber.milestones.P4.number = duplicateMilestoneNumber.milestones.P3.number;
  duplicateMilestoneNumber.milestones.P4.url = duplicateMilestoneNumber.milestones.P3.url;
  assert.throws(
    () => validateGithubMap(manifest, duplicateMilestoneNumber),
    /github map milestone numbers must be unique/u,
  );

  assert.throws(
    () => validateCatalog(manifest, githubMap, `${catalog}\n<!-- stale -->\n`),
    /generated ADR-THINK-001 issue catalog is stale/u,
  );
});

test('remote reconciliation compares issue and milestone publication evidence', async () => {
  const manifest = await loadManifest();
  const githubMap = await loadGithubMap();
  const remote = {
    milestones: manifest.milestones.map((milestone) => {
      const mapped = githubMap.milestones[milestone.id];
      return {
        number: mapped.number,
        title: mapped.title,
        html_url: mapped.url,
        state: mapped.state,
        description: milestone.thesis,
      };
    }),
    issues: manifest.issues.map((issue) => {
      const mapped = githubMap.issues[issue.id];
      return {
        number: mapped.number,
        title: mapped.title,
        html_url: mapped.url,
        state: mapped.state,
        milestone: { title: githubMap.milestones[issue.milestone].title },
        body: renderIssueBody(issue, manifest, githubMap),
        labels: issue.labels.map((name) => ({ name })),
      };
    }),
  };
  assert.doesNotThrow(() => reconcileGithubRemote(manifest, githubMap, remote));
  remote.issues.find((issue) => issue.number === githubMap.issues['CT-303'].number).state = 'closed';
  assert.throws(
    () => reconcileGithubRemote(manifest, githubMap, remote),
    /CT-303 remote GitHub issue state differs/u,
  );
});
