#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baselinePath = path.join(repoRoot, 'docs', 'audit', 'hexagonal-boundary-ratchet-baseline.json');
const sourcePrefixes = Object.freeze(['src/', 'bin/', 'scripts/']);
const allowedBoundaryFiles = Object.freeze([
  'scripts/hexagonal-boundary-ratchet.mjs',
  'scripts/repair-v17-mind.mjs',
  'src/browse-benchmark.js',
  'src/browse/adapters/git-warp-worker.js',
  'src/browse/adapters/git-warp.js',
  'src/cli/commands/doctor.js',
  'src/doctor.js',
  'src/history/git-warp-read.js',
  'src/store/git-warp-v19.js',
  'src/store/think-warp-sdk.js',
]);
const substrateTerms = Object.freeze([
  {
    id: 'git-warp-package',
    pattern: /@git-stunts\/git-warp/gu,
  },
  {
    id: 'git-warp-runtime-symbol',
    pattern: /\b(?:GitGraphAdapter|WarpApp|WarpCore|openWarpGraph|openWarpWorldline|openThinkWorldline|commitThinkWorldline|commitThinkWorldlineWithWriter)\b/gu,
  },
  {
    id: 'checkpoint-mechanic',
    pattern: /\b(?:CHECKPOINT_REF|checkpointPolicy|createCheckpoint|deleteCheckpointRef|getCheckpointRefStatus|openCheckpointStateRead|openCheckpointProductRead|listCheckpointEntriesByKind|listCheckpointEntryPropsByKind)\b/gu,
  },
  {
    id: 'warp-ref-layout',
    pattern: /refs\/warp\/\S+|checkpoints\/head|state-cache/gu,
  },
]);

class HexagonalBoundaryRatchetError extends Error {
  constructor(message) {
    super(message);
    this.name = 'HexagonalBoundaryRatchetError';
    Object.freeze(this);
  }
}

function parseArgs(argv) {
  const parsed = { json: false, writeBaseline: false };
  for (const arg of argv) {
    if (arg === '--json') {
      parsed.json = true;
      continue;
    }
    if (arg === '--write-baseline') {
      parsed.writeBaseline = true;
      continue;
    }
    throw new HexagonalBoundaryRatchetError(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new HexagonalBoundaryRatchetError(`Command failed: ${command} ${args.join(' ')}`);
  }
  return result.stdout;
}

function trackedCodeFiles() {
  return run('git', ['ls-files', '*.js', '*.mjs', '*.cjs'])
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .sort(compareStrings);
}

function scannedFiles() {
  return trackedCodeFiles()
    .filter(file => sourcePrefixes.some(prefix => file.startsWith(prefix)))
    .filter(file => existsSync(path.join(repoRoot, file)))
    .filter(file => !allowedBoundaryFiles.includes(file));
}

function collectFindings(files) {
  return files.flatMap(file => collectFileFindings(file)).sort(compareFindings);
}

function collectFileFindings(file) {
  const content = readFileSync(path.join(repoRoot, file), 'utf8');
  return substrateTerms.flatMap(term => collectTermFindings(file, content, term));
}

function collectTermFindings(file, content, term) {
  term.pattern.lastIndex = 0;
  return [...content.matchAll(term.pattern)].map(match => {
    const position = locateTextPosition(content, match.index ?? 0);
    return Object.freeze({
      column: position.column,
      file,
      line: position.line,
      term: term.id,
      text: firstMatchedLine(match[0]),
    });
  });
}

function locateTextPosition(content, offset) {
  const prefix = content.slice(0, offset);
  const lastNewlineIndex = prefix.lastIndexOf('\n');
  return Object.freeze({
    column: offset - lastNewlineIndex,
    line: prefix.split('\n').length,
  });
}

function firstMatchedLine(text) {
  return text.split('\n')[0]?.trim() ?? '';
}

function createSnapshot() {
  const files = scannedFiles();
  const findings = collectFindings(files);
  return deepSort({
    version: 1,
    generatedFrom: 'scripts/hexagonal-boundary-ratchet.mjs',
    allowedBoundaryFiles,
    substrateTermIds: substrateTerms.map(term => term.id),
    leaks: summarizeFindings(findings),
  });
}

function summarizeFindings(findings) {
  return {
    byFile: countBy(findings, finding => finding.file),
    byTerm: countBy(findings, finding => finding.term),
    total: findings.length,
  };
}

function countBy(values, selectKey) {
  const counts = {};
  for (const value of values) {
    const key = selectKey(value);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function loadBaseline() {
  if (!existsSync(baselinePath)) {
    throw new HexagonalBoundaryRatchetError(`Missing Hexagonal Boundary ratchet baseline: ${baselinePath}`);
  }
  return JSON.parse(readFileSync(baselinePath, 'utf8'));
}

function compareToBaseline(current, baseline) {
  const problems = [];
  compareTotals(problems, 'substrate leak total', current.leaks.total, baseline.leaks.total);
  compareCountMap(problems, 'substrate leak file', current.leaks.byFile, baseline.leaks.byFile);
  compareCountMap(problems, 'substrate leak term', current.leaks.byTerm, baseline.leaks.byTerm);
  return problems;
}

function compareTotals(problems, label, current, baseline) {
  if (current > baseline) {
    problems.push(`${label}: ${current} > baseline ${baseline}`);
  }
}

function compareCountMap(problems, label, current = {}, baseline = {}) {
  for (const [key, value] of Object.entries(current)) {
    const allowed = baseline[key] ?? 0;
    if (value > allowed) {
      problems.push(`${label} ${key}: ${value} > baseline ${allowed}`);
    }
  }
}

function writeBaseline(snapshot) {
  writeFileSync(baselinePath, `${JSON.stringify(snapshot, null, 2)}\n`);
}

function printHumanSummary(snapshot, problems) {
  if (problems.length > 0) {
    process.stderr.write('Hexagonal Boundary ratchet failed.\n');
    for (const problem of problems) {
      process.stderr.write(`- ${problem}\n`);
    }
    process.stderr.write('\nRun `npm run hexagonal-boundary:ratchet -- --json` for the current counts.\n');
    return;
  }

  process.stdout.write([
    'Hexagonal Boundary ratchet passed.',
    `Substrate leak tokens: ${snapshot.leaks.total}`,
    `Leaks by term: ${JSON.stringify(snapshot.leaks.byTerm)}`,
  ].join('\n'));
  process.stdout.write('\n');
}

function deepSort(value) {
  if (Array.isArray(value)) {
    return value.map(deepSort);
  }
  if (value === null || typeof value !== 'object') {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => compareStrings(left, right))
      .map(([key, entry]) => [key, deepSort(entry)])
  );
}

function compareStrings(left, right) {
  return left.localeCompare(right);
}

function compareFindings(left, right) {
  return compareStrings(left.file, right.file)
    || left.line - right.line
    || left.column - right.column
    || compareStrings(left.term, right.term);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const snapshot = createSnapshot();
  if (args.writeBaseline) {
    writeBaseline(snapshot);
  }
  const baseline = args.writeBaseline ? snapshot : loadBaseline();
  const problems = compareToBaseline(snapshot, baseline);
  if (args.json) {
    process.stdout.write(`${JSON.stringify({ ok: problems.length === 0, problems, snapshot }, null, 2)}\n`);
  } else {
    printHumanSummary(snapshot, problems);
  }
  if (problems.length > 0) {
    process.exitCode = 1;
  }
}

main();
