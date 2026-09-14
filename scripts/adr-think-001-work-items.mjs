#!/usr/bin/env node

import { execFile as execFileCallback } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..');
const MANIFEST_PATH = resolve(REPO_ROOT, 'docs/design/ADR-THINK-001-work-items.json');
const CATALOG_PATH = resolve(REPO_ROOT, 'docs/design/ADR-THINK-001-issue-catalog.md');
const GITHUB_MAP_PATH = resolve(REPO_ROOT, 'docs/design/ADR-THINK-001-github-map.json');
const ADR_URL = 'https://github.com/flyingrobots/think/blob/main/docs/design/ADR-THINK-001-thoughts-are-sources-claims-are-readings.md';
const PLAN_URL = 'https://github.com/flyingrobots/think/blob/main/docs/design/ADR-THINK-001-delivery-plan.md';
const CATALOG_URL = 'https://github.com/flyingrobots/think/blob/main/docs/design/ADR-THINK-001-issue-catalog.md';
const EXPECTED_GATES = Object.freeze(['G1', 'G2', 'G3', 'G4', 'G5']);
const EXPECTED_INVARIANTS = Object.freeze(Array.from({ length: 17 }, (_, index) => `I${index + 1}`));
const EXPECTED_CRITERIA = Object.freeze(Array.from({ length: 35 }, (_, index) => `AC${index + 1}`));
const REQUIRED_TESTS = Object.freeze(['contract', 'integration', 'failure', 'resource']);
const REQUIRED_RESOURCE_MODES = Object.freeze(['exclusive', 'partitioned', 'shared']);
const REQUIRED_ISSUE_IDS = Object.freeze([
  'CT-001', 'CT-002', 'CT-003', 'CT-004', 'CT-005', 'CT-006', 'CT-007', 'CT-008',
  'CT-101', 'CT-102', 'CT-103', 'CT-104', 'CT-105', 'CT-106', 'CT-107', 'CT-108',
  'CT-201', 'CT-202', 'CT-203', 'CT-204', 'CT-205', 'CT-206', 'CT-207', 'CT-208',
  'CT-209', 'CT-210', 'CT-301', 'CT-302', 'CT-303', 'CT-304', 'CT-305', 'CT-306',
  'CT-307', 'CT-401', 'CT-402', 'CT-403', 'CT-404', 'CT-405', 'CT-501', 'CT-502',
  'CT-503', 'CT-504', 'CT-505', 'CT-601', 'CT-602', 'CT-603', 'CT-604', 'CT-605',
  'CT-606', 'CT-701', 'CT-702', 'CT-703', 'CT-704', 'CT-705', 'CT-706', 'CT-801',
  'CT-802', 'CT-803', 'CT-804', 'CT-805',
]);
// The dependency graph renders these as `owner/repo#number`, so the shape the
// renderer destructures is the shape the validator has to demand. A bare repo
// URL passes a prefix test and then renders as `owner/repo#undefined`.
const EXTERNAL_DEPENDENCY_URL = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/(?:issues|pull)\/[1-9]\d*$/u;

const execFile = promisify(execFileCallback);

class WorkGraphError extends Error {
  constructor(message) {
    super(message);
    this.name = 'WorkGraphError';
    Object.freeze(this);
  }
}

function fail(message) {
  throw new WorkGraphError(message);
}

function expect(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function expectArray(owner, key, minimum = 1) {
  const value = owner[key];
  const label = owner.id ?? 'manifest';
  expect(Array.isArray(value), `${label}.${key} must be an array`);
  expect(value.length >= minimum, `${label}.${key} needs at least ${minimum} item(s)`);
}

// Length alone is not specification. A deliverable replaced by "" keeps the
// array shape and renders as an empty checklist item on the GitHub issue, so
// every text entry has to carry text.
function expectTextArray(owner, key, minimum = 1) {
  expectArray(owner, key, minimum);
  const label = owner.id ?? 'manifest';
  for (const [index, entry] of owner[key].entries()) {
    expect(
      typeof entry === 'string' && entry.trim().length > 0,
      `${label}.${key}[${index}] must be non-empty text`,
    );
  }
}

function assertUnique(items, label) {
  const ids = items.map((item) => item.id);
  expect(new Set(ids).size === ids.length, `${label} identifiers must be unique`);
}

function byId(items) {
  return new Map(items.map((item) => [item.id, item]));
}

function compareIds(left, right) {
  return left.localeCompare(right, 'en', { numeric: true });
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assertExactKeys(value, expected, label) {
  expect(isPlainObject(value), `${label} must be a plain object`);
  const actualKeys = Object.keys(value).sort(compareIds);
  const expectedKeys = [...expected].sort(compareIds);
  expect(
    JSON.stringify(actualKeys) === JSON.stringify(expectedKeys),
    `${label} must define exactly: ${expectedKeys.join(', ')}`,
  );
}

function validateTopLevel(manifest) {
  expect(manifest.schemaVersion === 1, 'manifest.schemaVersion must be 1');
  assertExactKeys(manifest.resourceModes, REQUIRED_RESOURCE_MODES, 'manifest.resourceModes');
  expectArray(manifest, 'milestones', 9);
  expectArray(manifest, 'features', 18);
  expectArray(manifest, 'issues', 60);
  expect(manifest.milestones.length === 9, 'manifest must contain exactly 9 milestones');
  expect(manifest.features.length === 18, 'manifest must contain exactly 18 features');
  expect(manifest.issues.length === 60, 'manifest must contain exactly 60 issues');
  assertUnique(manifest.milestones, 'Milestone');
  assertUnique(manifest.features, 'Feature');
  assertUnique(manifest.issues, 'Issue');
  const issueIds = manifest.issues.map((issue) => issue.id).sort(compareIds);
  expect(
    JSON.stringify(issueIds) === JSON.stringify([...REQUIRED_ISSUE_IDS].sort(compareIds)),
    'manifest must preserve the exact stable ADR-THINK-001 issue identifier set',
  );
}

function validateMilestones(manifest) {
  for (const milestone of manifest.milestones) {
    expect(/^P[0-8]$/u.test(milestone.id), `Invalid milestone id: ${milestone.id}`);
    expect(Boolean(milestone.title), `${milestone.id}.title is required`);
    expect(Boolean(milestone.thesis), `${milestone.id}.thesis is required`);
    expect(manifest.issues.some((issue) => issue.milestone === milestone.id), `${milestone.id} has no issues`);
  }
}

function validateFeatures(manifest, milestoneIndex) {
  for (const feature of manifest.features) {
    expect(/^F[0-8]\.[12]$/u.test(feature.id), `Invalid feature id: ${feature.id}`);
    expect(milestoneIndex.has(feature.milestone), `${feature.id} has an unknown milestone`);
    expect(Boolean(feature.title), `${feature.id}.title is required`);
    expect(manifest.issues.some((issue) => issue.feature === feature.id), `${feature.id} has no issues`);
  }
}

function validateStories(issue) {
  expectArray(issue, 'stories', 2);
  for (const [index, story] of issue.stories.entries()) {
    const prefix = `${issue.id}.stories[${index}]`;
    expect(Boolean(story.actor), `${prefix}.actor is required`);
    expect(Boolean(story.capability), `${prefix}.capability is required`);
    expect(Boolean(story.value), `${prefix}.value is required`);
  }
}

function validateTests(issue) {
  expect(Boolean(issue.testPlan), `${issue.id}.testPlan is required`);
  for (const category of REQUIRED_TESTS) {
    expect(Boolean(issue.testPlan[category]), `${issue.id}.testPlan.${category} is required`);
  }
  const { security } = issue.testPlan;
  expect(security === null || typeof security === 'string', `${issue.id}.testPlan.security must be text or null`);
}

function validateResources(issue, resourceModes) {
  expectArray(issue, 'resources', 3);
  expect(new Set(issue.resources.map((item) => item.name)).size === issue.resources.length, `${issue.id} resource names must be unique`);
  expect(issue.resources.some((item) => item.mode === 'exclusive'), `${issue.id} must declare an exclusive mutation or lease boundary`);
  for (const item of issue.resources) {
    expect(Boolean(item.name), `${issue.id} has an unnamed resource`);
    expect(Object.hasOwn(resourceModes, item.mode), `${issue.id}.${item.name} has invalid mode ${item.mode}`);
    expect(Boolean(item.scope), `${issue.id}.${item.name}.scope is required`);
  }
}

function validateIssueShape(issue, resourceModes) {
  expect(/^CT-[0-8][0-9]{2}$/u.test(issue.id), `Invalid issue id: ${issue.id}`);
  expect(Boolean(issue.title), `${issue.id}.title is required`);
  expect(issue.title.length <= 220, `${issue.id}.title exceeds the GitHub limit budget`);
  expect(Boolean(issue.outcome), `${issue.id}.outcome is required`);
  expectTextArray(issue, 'deliverables', 4);
  expectTextArray(issue, 'acceptance', 4);
  expectTextArray(issue, 'nonGoals', 2);
  expectTextArray(issue, 'labels');
  expectTextArray(issue, 'blockedBy', 0);
  expectTextArray(issue, 'externalDependencies', 0);
  expectTextArray(issue, 'gates', 0);
  expectTextArray(issue, 'invariants');
  expectTextArray(issue, 'criteria');
  validateStories(issue);
  validateTests(issue);
  validateResources(issue, resourceModes);
}

function validateIssueReferences(issue, indexes) {
  const { featureIndex, issueIndex, issueOrder, milestoneIndex } = indexes;
  expect(milestoneIndex.has(issue.milestone), `${issue.id} has unknown milestone ${issue.milestone}`);
  expect(featureIndex.has(issue.feature), `${issue.id} has unknown feature ${issue.feature}`);
  expect(featureIndex.get(issue.feature).milestone === issue.milestone, `${issue.id} feature/milestone mismatch`);
  for (const blocker of issue.blockedBy) {
    expect(issueIndex.has(blocker), `${issue.id} has unknown blocker ${blocker}`);
    expect(blocker !== issue.id, `${issue.id} cannot block itself`);
    expect(issueOrder.get(blocker) < issueOrder.get(issue.id), `${issue.id} blocker ${blocker} must appear earlier for deterministic publication`);
  }
  for (const dependency of issue.externalDependencies) {
    expect(EXTERNAL_DEPENDENCY_URL.test(dependency), `${issue.id} has an invalid external dependency URL`);
  }
}

function assertExactCoverage(issues, key, expected) {
  const actual = [...new Set(issues.flatMap((issue) => issue[key]))].sort(compareIds);
  const wanted = [...expected].sort(compareIds);
  expect(JSON.stringify(actual) === JSON.stringify(wanted), `${key} coverage mismatch: ${actual.join(', ')}`);
}

// Unreachable from validateManifest by construction: validateIssueReferences
// already requires every blocker to sit at a strictly lower index, so the edge
// set is a strict partial order and cannot contain a cycle. Kept and exported
// as defence in depth for any caller that does not enforce that ordering, and
// proved directly in test/ports/adr-think-001-work-items.test.js.
function validateDependencyGraph(issues) {
  const remaining = new Map(issues.map((issue) => [issue.id, new Set(issue.blockedBy)]));
  const ready = issues.filter((issue) => issue.blockedBy.length === 0).map((issue) => issue.id);
  const visited = [];
  while (ready.length > 0) {
    const current = ready.shift();
    visited.push(current);
    for (const [id, blockers] of remaining) {
      blockers.delete(current);
      if (blockers.size === 0 && !visited.includes(id) && !ready.includes(id)) {
        ready.push(id);
      }
    }
  }
  expect(visited.length === issues.length, 'Issue dependency graph contains a cycle');
}

function validateManifest(manifest) {
  validateTopLevel(manifest);
  const indexes = {
    milestoneIndex: byId(manifest.milestones),
    featureIndex: byId(manifest.features),
    issueIndex: byId(manifest.issues),
    issueOrder: new Map(manifest.issues.map((issue, index) => [issue.id, index])),
  };
  validateMilestones(manifest);
  validateFeatures(manifest, indexes.milestoneIndex);
  for (const issue of manifest.issues) {
    validateIssueShape(issue, manifest.resourceModes);
    validateIssueReferences(issue, indexes);
  }
  assertExactCoverage(manifest.issues, 'gates', EXPECTED_GATES);
  assertExactCoverage(manifest.issues, 'invariants', EXPECTED_INVARIANTS);
  assertExactCoverage(manifest.issues, 'criteria', EXPECTED_CRITERIA);
  validateDependencyGraph(manifest.issues);
}

function validateUniqueGithubNumbers(manifest, githubMap) {
  expect(
    new Set(Object.values(githubMap.milestones).map((item) => item.number)).size
      === manifest.milestones.length,
    'github map milestone numbers must be unique',
  );
  expect(
    new Set(Object.values(githubMap.issues).map((item) => item.number)).size
      === manifest.issues.length,
    'github map issue numbers must be unique',
  );
}

function validateGithubMap(manifest, githubMap) {
  expect(githubMap.schemaVersion === 1, 'github map schemaVersion must be 1');
  expect(githubMap.repository === 'flyingrobots/think', 'github map repository must be flyingrobots/think');
  assertExactKeys(
    githubMap.milestones,
    manifest.milestones.map((milestone) => milestone.id),
    'github map milestones',
  );
  assertExactKeys(githubMap.issues, REQUIRED_ISSUE_IDS, 'github map issues');
  validateUniqueGithubNumbers(manifest, githubMap);

  for (const milestone of manifest.milestones) {
    const mapped = githubMap.milestones[milestone.id];
    expect(Number.isInteger(mapped.number) && mapped.number > 0, `${milestone.id} needs a GitHub milestone number`);
    expect(mapped.title === milestone.title, `${milestone.id} GitHub milestone title is stale`);
    expect(
      mapped.url === `https://github.com/flyingrobots/think/milestone/${mapped.number}`,
      `${milestone.id} GitHub milestone URL is invalid`,
    );
    expect(['open', 'closed'].includes(mapped.state), `${milestone.id} GitHub milestone state is invalid`);
  }

  for (const issue of manifest.issues) {
    const mapped = githubMap.issues[issue.id];
    expect(Number.isInteger(mapped.number) && mapped.number > 0, `${issue.id} needs a GitHub issue number`);
    expect(mapped.title === `[${issue.id}] ${issue.title}`, `${issue.id} GitHub issue title is stale`);
    expect(mapped.milestone === issue.milestone, `${issue.id} GitHub milestone mapping is stale`);
    expect(
      mapped.url === `https://github.com/flyingrobots/think/issues/${mapped.number}`,
      `${issue.id} GitHub issue URL is invalid`,
    );
    expect(['open', 'closed'].includes(mapped.state), `${issue.id} GitHub issue state is invalid`);
    for (const blocker of issue.blockedBy) {
      expect(Boolean(githubMap.issues[blocker]), `${issue.id} blocker ${blocker} lacks a GitHub mapping`);
    }
  }
}

function validateCatalog(manifest, githubMap, catalog) {
  expect(
    catalog === renderCatalog(manifest, githubMap),
    'generated ADR-THINK-001 issue catalog is stale; run roadmap:contextual-mind:render',
  );
}

function remoteCollection(stdout, label) {
  const pages = JSON.parse(stdout);
  expect(Array.isArray(pages), `${label} response must be an array`);
  return pages.flat();
}

async function readRemoteGithubState(repository) {
  const [issueResult, milestoneResult] = await Promise.all([
    execFile('gh', ['api', '--paginate', '--slurp', `repos/${repository}/issues?state=all&per_page=100`], {
      maxBuffer: 16 * 1024 * 1024,
    }),
    execFile('gh', ['api', '--paginate', '--slurp', `repos/${repository}/milestones?state=all&per_page=100`], {
      maxBuffer: 4 * 1024 * 1024,
    }),
  ]);
  return {
    issues: remoteCollection(issueResult.stdout, 'GitHub issues'),
    milestones: remoteCollection(milestoneResult.stdout, 'GitHub milestones'),
  };
}

function reconcileRemoteMilestones(manifest, githubMap, remoteMilestones) {
  for (const milestone of manifest.milestones) {
    const mapped = githubMap.milestones[milestone.id];
    const actual = remoteMilestones.get(mapped.number);
    expect(Boolean(actual), `${milestone.id} remote GitHub milestone is missing`);
    expect(actual.title === mapped.title, `${milestone.id} remote GitHub milestone title differs`);
    expect(actual.html_url === mapped.url, `${milestone.id} remote GitHub milestone URL differs`);
    expect(actual.state === mapped.state, `${milestone.id} remote GitHub milestone state differs`);
    expect(actual.description === milestone.thesis, `${milestone.id} remote GitHub milestone description differs`);
  }
}

function reconcileRemoteIssues(manifest, githubMap, remoteIssues) {
  for (const issue of manifest.issues) {
    const mapped = githubMap.issues[issue.id];
    const actual = remoteIssues.get(mapped.number);
    expect(Boolean(actual), `${issue.id} remote GitHub issue is missing`);
    expect(actual.title === mapped.title, `${issue.id} remote GitHub issue title differs`);
    expect(actual.html_url === mapped.url, `${issue.id} remote GitHub issue URL differs`);
    expect(actual.state === mapped.state, `${issue.id} remote GitHub issue state differs`);
    expect(actual.milestone?.title === githubMap.milestones[issue.milestone].title, `${issue.id} remote GitHub milestone differs`);
    expect(actual.body === renderIssueBody(issue, manifest, githubMap), `${issue.id} remote GitHub issue body differs`);
    const actualLabels = actual.labels.map((label) => label.name).sort();
    expect(
      JSON.stringify(actualLabels) === JSON.stringify([...issue.labels].sort()),
      `${issue.id} remote GitHub labels differ`,
    );
  }
}

function reconcileGithubRemote(manifest, githubMap, remote) {
  validateGithubMap(manifest, githubMap);
  const remoteMilestones = new Map(remote.milestones.map((milestone) => [milestone.number, milestone]));
  const remoteIssues = new Map(
    remote.issues
      .filter((issue) => !issue.pull_request)
      .map((issue) => [issue.number, issue]),
  );
  reconcileRemoteMilestones(manifest, githubMap, remoteMilestones);
  reconcileRemoteIssues(manifest, githubMap, remoteIssues);
}

function markdownList(items, checked = false) {
  const marker = checked ? '- [ ]' : '-';
  return items.map((item) => `${marker} ${item}`).join('\n');
}

function escapeCell(value) {
  return String(value).replaceAll('|', '\\|').replaceAll('\n', '<br>');
}

function renderStories(issue) {
  return issue.stories
    .map((item) => `- As a **${item.actor}**, I want ${item.capability}, so that ${item.value}.`)
    .join('\n');
}

function renderTests(issue) {
  const sections = [
    ['Contract and unit', issue.testPlan.contract],
    ['Integration and acceptance', issue.testPlan.integration],
    ['Failure and recovery', issue.testPlan.failure],
    ['Resource and performance', issue.testPlan.resource],
  ];
  if (issue.testPlan.security) {
    sections.push(['Security, privacy, and erasure', issue.testPlan.security]);
  }
  return sections.map(([title, value]) => `### ${title}\n\n- [ ] ${value}`).join('\n\n');
}

function renderResources(issue, manifest) {
  const rows = issue.resources.map((item) =>
    `| \`${escapeCell(item.name)}\` | **${item.mode}** | ${escapeCell(item.scope)} |`,
  );
  const modes = Object.entries(manifest.resourceModes)
    .map(([mode, meaning]) => `- **${mode}:** ${meaning}`)
    .join('\n');
  return ['| Resource | Exclusivity mode | Scope |', '| --- | --- | --- |', ...rows, '', modes].join('\n');
}

function issueReference(id, githubMap) {
  const mapped = githubMap.issues?.[id];
  if (mapped?.url) {
    return `[#${mapped.number} — ${id}](${mapped.url})`;
  }
  return `\`${id}\` (planned)`;
}

function renderDependencies(issue, githubMap) {
  const local = issue.blockedBy.map((id) => `- Blocked by ${issueReference(id, githubMap)}`);
  const external = issue.externalDependencies.map((url) => `- External dependency: [${url}](${url})`);
  const dependencies = [...local, ...external];
  if (dependencies.length === 0) {
    return '- None.';
  }
  return dependencies.join('\n');
}

function renderTrace(issue) {
  const gates = issue.gates.length > 0 ? issue.gates.map((item) => `\`${item}\``).join(', ') : 'None directly';
  const invariants = issue.invariants.map((item) => `\`${item}\``).join(', ');
  const criteria = issue.criteria.map((item) => `\`${item}\``).join(', ');
  return `- Implementation gates: ${gates}\n- Constitutional invariants: ${invariants}\n- ADR acceptance criteria: ${criteria}`;
}

function renderIssueBody(issue, manifest, githubMap) {
  const milestone = manifest.milestones.find((item) => item.id === issue.milestone);
  const feature = manifest.features.find((item) => item.id === issue.feature);
  return [
    `<!-- adr-think-001-work-item: ${issue.id} -->`,
    `[ADR-THINK-001](${ADR_URL}) · [Delivery plan](${PLAN_URL}) · [Complete issue catalog](${CATALOG_URL})`,
    `**Milestone:** ${milestone.title}\n\n**Feature:** ${feature.id} — ${feature.title}`,
    `## Outcome\n\n${issue.outcome}`,
    `## User stories\n\n${renderStories(issue)}`,
    `## Deliverables\n\n${markdownList(issue.deliverables, true)}`,
    `## Acceptance criteria\n\n${markdownList(issue.acceptance, true)}`,
    `## Test plan\n\n${renderTests(issue)}`,
    `## Build-time resources\n\n${renderResources(issue, manifest)}`,
    `## Dependencies\n\n${renderDependencies(issue, githubMap)}`,
    `## ADR traceability\n\n${renderTrace(issue)}`,
    `## Non-goals\n\n${markdownList(issue.nonGoals)}`,
  ].join('\n\n');
}

function mermaidId(id) {
  return id.replaceAll('-', '').replaceAll('.', '_');
}

function renderDependencyGraph(manifest) {
  const lines = ['```mermaid', 'flowchart LR'];
  const externalDependencies = [...new Set(manifest.issues.flatMap((issue) => issue.externalDependencies))].sort();
  const externalIds = new Map(externalDependencies.map((dependency, index) => [dependency, `EXT${index + 1}`]));
  if (externalDependencies.length > 0) {
    lines.push('  subgraph EXT["External blockers"]', '    direction TB');
    for (const dependency of externalDependencies) {
      const parsed = new URL(dependency);
      const [owner, repository, , number] = parsed.pathname.split('/').filter(Boolean);
      lines.push(`    ${externalIds.get(dependency)}["${owner}/${repository}#${number}"]`);
    }
    lines.push('  end');
  }
  for (const milestone of manifest.milestones) {
    lines.push(`  subgraph ${milestone.id}["${milestone.id}"]`, '    direction TB');
    const issues = manifest.issues.filter((issue) => issue.milestone === milestone.id);
    lines.push(...issues.map((issue) => `    ${mermaidId(issue.id)}["${issue.id}"]`), '  end');
  }
  for (const issue of manifest.issues) {
    lines.push(...issue.blockedBy.map((blocker) => `  ${mermaidId(blocker)} --> ${mermaidId(issue.id)}`));
    lines.push(...issue.externalDependencies.map((dependency) =>
      `  ${externalIds.get(dependency)} -. external .-> ${mermaidId(issue.id)}`,
    ));
  }
  lines.push('```');
  return lines.join('\n');
}

function renderMilestoneTable(manifest) {
  const rows = manifest.milestones.map((milestone) => {
    const featureCount = manifest.features.filter((feature) => feature.milestone === milestone.id).length;
    const issueCount = manifest.issues.filter((issue) => issue.milestone === milestone.id).length;
    return `| ${milestone.id} | ${escapeCell(milestone.title)} | ${featureCount} | ${issueCount} |`;
  });
  return ['| ID | Milestone | Features | Issues |', '| --- | --- | ---: | ---: |', ...rows].join('\n');
}

function renderResourceModes(manifest) {
  const rows = Object.entries(manifest.resourceModes)
    .map(([mode, meaning]) => `| **${mode}** | ${escapeCell(meaning)} |`);
  return ['| Mode | Build-time scheduling law |', '| --- | --- |', ...rows].join('\n');
}

function renderCatalogIssueBody(issue, manifest, githubMap) {
  return renderIssueBody(issue, manifest, githubMap)
    .replaceAll(/^### /gmu, '###### ')
    .replaceAll(/^## /gmu, '##### ');
}

function renderMilestoneSection(milestone, manifest, githubMap) {
  const features = manifest.features.filter((feature) => feature.milestone === milestone.id);
  const sections = [`## ${milestone.title}`, milestone.thesis];
  for (const feature of features) {
    sections.push(`### ${feature.id} — ${feature.title}`);
    const issues = manifest.issues.filter((issue) => issue.feature === feature.id);
    for (const issue of issues) {
      sections.push(`#### ${issue.id} — ${issue.title}`, renderCatalogIssueBody(issue, manifest, githubMap));
    }
  }
  return sections.join('\n\n');
}

function renderCatalog(manifest, githubMap) {
  const header = [
    '---',
    'title: "ADR-THINK-001 Implementation Issue Catalog"',
    'status: generated',
    'source: ADR-THINK-001-work-items.json',
    '---',
    '',
    '# ADR-THINK-001 implementation issue catalog',
    '',
    '<!-- Generated by scripts/adr-think-001-work-items.mjs. Do not edit by hand. -->',
    '',
    `This catalog expands [ADR-THINK-001](${ADR_URL}) into **9 milestones, 18 features, and 60 independently testable GitHub issues**.`,
    '',
    '## Milestones',
    '',
    renderMilestoneTable(manifest),
    '',
    '## Build-time resource modes',
    '',
    renderResourceModes(manifest),
    '',
    '## Complete dependency graph',
    '',
    renderDependencyGraph(manifest),
  ];
  const sections = manifest.milestones.map((item) => renderMilestoneSection(item, manifest, githubMap));
  return [...header, '', sections.join('\n\n'), ''].join('\n');
}

function githubPlan(manifest, githubMap) {
  const milestones = manifest.milestones.map((item) => ({
    id: item.id,
    title: item.title,
    description: item.thesis,
  }));
  const issues = manifest.issues.map((issue) => ({
    id: issue.id,
    title: `[${issue.id}] ${issue.title}`,
    milestone: manifest.milestones.find((item) => item.id === issue.milestone).title,
    labels: issue.labels,
    body: renderIssueBody(issue, manifest, githubMap),
  }));
  return { repository: 'flyingrobots/think', milestones, issues };
}

function summary(manifest) {
  return `ADR-THINK-001 work graph valid: ${manifest.milestones.length} milestones, ${manifest.features.length} features, ${manifest.issues.length} issues.`;
}

async function checkWorkGraph(manifest, githubMap) {
  const catalog = await readFile(CATALOG_PATH, 'utf8');
  validateCatalog(manifest, githubMap, catalog);
  process.stdout.write(`${summary(manifest)} GitHub map complete; generated catalog current.\n`);
}

async function renderWorkGraph(manifest, githubMap) {
  await writeFile(CATALOG_PATH, renderCatalog(manifest, githubMap));
  process.stdout.write(`${summary(manifest)} Rendered ${CATALOG_PATH}.\n`);
}

async function execute(command, requestedId) {
  const manifest = await readJson(MANIFEST_PATH);
  validateManifest(manifest);
  const githubMap = await readJson(GITHUB_MAP_PATH);
  validateGithubMap(manifest, githubMap);
  if (command === 'check') {
    await checkWorkGraph(manifest, githubMap);
    return;
  }
  if (command === 'render') {
    await renderWorkGraph(manifest, githubMap);
    return;
  }
  if (command === 'body') {
    const issue = manifest.issues.find((item) => item.id === requestedId);
    expect(Boolean(issue), `Unknown issue id: ${requestedId}`);
    process.stdout.write(`${renderIssueBody(issue, manifest, githubMap)}\n`);
    return;
  }
  if (command === 'github-plan') {
    process.stdout.write(`${JSON.stringify(githubPlan(manifest, githubMap), null, 2)}\n`);
    return;
  }
  if (command === 'reconcile') {
    const remote = await readRemoteGithubState(githubMap.repository);
    reconcileGithubRemote(manifest, githubMap, remote);
    process.stdout.write(`GitHub reconciliation exact: ${manifest.milestones.length} milestones, ${manifest.issues.length} issues.\n`);
    return;
  }
  fail(`Unknown command: ${command}`);
}

const IS_DIRECT = process.argv[1] === fileURLToPath(import.meta.url);

if (IS_DIRECT) {
  await execute(process.argv[2] ?? 'check', process.argv[3]);
}

export {
  WorkGraphError,
  githubPlan,
  reconcileGithubRemote,
  renderCatalog,
  renderIssueBody,
  validateCatalog,
  validateDependencyGraph,
  validateGithubMap,
  validateManifest,
};
