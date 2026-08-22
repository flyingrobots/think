#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
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
  expect(Array.isArray(value), `${owner.id ?? 'manifest'}.${key} must be an array`);
  expect(value.length >= minimum, `${owner.id ?? 'manifest'}.${key} needs at least ${minimum} item(s)`);
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

async function readOptionalMap() {
  try {
    return await readJson(GITHUB_MAP_PATH);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { schemaVersion: 1, repository: 'flyingrobots/think', milestones: {}, issues: {} };
    }
    throw error;
  }
}

function validateTopLevel(manifest) {
  expect(manifest.schemaVersion === 1, 'manifest.schemaVersion must be 1');
  expect(Object.keys(manifest.resourceModes).length === 3, 'manifest must define exactly three resource modes');
  expectArray(manifest, 'milestones', 9);
  expectArray(manifest, 'features', 18);
  expectArray(manifest, 'issues', 60);
  expect(manifest.milestones.length === 9, 'manifest must contain exactly 9 milestones');
  expect(manifest.features.length === 18, 'manifest must contain exactly 18 features');
  expect(manifest.issues.length === 60, 'manifest must contain exactly 60 issues');
  assertUnique(manifest.milestones, 'Milestone');
  assertUnique(manifest.features, 'Feature');
  assertUnique(manifest.issues, 'Issue');
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
  expectArray(issue, 'deliverables', 4);
  expectArray(issue, 'acceptance', 4);
  expectArray(issue, 'nonGoals', 2);
  expectArray(issue, 'labels');
  expectArray(issue, 'blockedBy', 0);
  expectArray(issue, 'externalDependencies', 0);
  expectArray(issue, 'gates', 0);
  expectArray(issue, 'invariants');
  expectArray(issue, 'criteria');
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
    expect(/^https:\/\/github\.com\//u.test(dependency), `${issue.id} has an invalid external dependency URL`);
  }
}

function assertExactCoverage(issues, key, expected) {
  const actual = [...new Set(issues.flatMap((issue) => issue[key]))].sort(compareIds);
  const wanted = [...expected].sort(compareIds);
  expect(JSON.stringify(actual) === JSON.stringify(wanted), `${key} coverage mismatch: ${actual.join(', ')}`);
}

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
  for (const milestone of manifest.milestones) {
    lines.push(`  subgraph ${milestone.id}["${milestone.id}"]`, '    direction TB');
    const issues = manifest.issues.filter((issue) => issue.milestone === milestone.id);
    lines.push(...issues.map((issue) => `    ${mermaidId(issue.id)}["${issue.id}"]`), '  end');
  }
  for (const issue of manifest.issues) {
    lines.push(...issue.blockedBy.map((blocker) => `  ${mermaidId(blocker)} --> ${mermaidId(issue.id)}`));
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

async function execute(command, requestedId) {
  const manifest = await readJson(MANIFEST_PATH);
  validateManifest(manifest);
  const githubMap = await readOptionalMap();
  if (command === 'check') {
    process.stdout.write(`${summary(manifest)}\n`);
    return;
  }
  if (command === 'render') {
    await writeFile(CATALOG_PATH, renderCatalog(manifest, githubMap));
    process.stdout.write(`${summary(manifest)} Rendered ${CATALOG_PATH}.\n`);
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
  fail(`Unknown command: ${command}`);
}

const IS_DIRECT = process.argv[1] === fileURLToPath(import.meta.url);

if (IS_DIRECT) {
  await execute(process.argv[2] ?? 'check', process.argv[3]);
}

export {
  WorkGraphError,
  githubPlan,
  renderCatalog,
  renderIssueBody,
  validateManifest,
};
