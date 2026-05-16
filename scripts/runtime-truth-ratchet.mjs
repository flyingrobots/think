#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baselinePath = path.join(repoRoot, 'docs', 'audit', 'runtime-truth-ratchet-baseline.json');
const COMMAND_TIMEOUT_MS = 120_000;
const sourcePrefixes = Object.freeze(['src/', 'bin/', 'scripts/']);
const strictRuleIds = Object.freeze([
  'complexity',
  'max-depth',
  'max-lines',
  'max-lines-per-function',
  'max-params',
  'max-statements',
]);
const strictRuleSet = new Set(strictRuleIds);
const strictRuleArgs = Object.freeze([
  'max-lines:["error",1000]',
  'max-lines-per-function:["error",{"max":35,"skipBlankLines":true,"skipComments":true}]',
  'max-depth:["error",4]',
  'max-params:["error",5]',
  'complexity:["error",8]',
  'max-statements:["error",25]',
]);
const genericThrowPattern = /\bthrow\s+new\s+(Error|TypeError)\s*\(/gu;

class RuntimeTruthRatchetError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RuntimeTruthRatchetError';
    Object.freeze(this);
  }
}

function parseArgs(argv) {
  const parsed = {
    json: false,
    writeBaseline: false,
  };

  for (const arg of argv) {
    if (arg === '--json') {
      parsed.json = true;
      continue;
    }
    if (arg === '--write-baseline') {
      parsed.writeBaseline = true;
      continue;
    }
    throw new RuntimeTruthRatchetError(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function run(command, args, { allowFailure = false } = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    timeout: COMMAND_TIMEOUT_MS,
  });

  if (result.error) {
    if (result.error.code === 'ETIMEDOUT') {
      throw new RuntimeTruthRatchetError(
        `Runtime truth ratchet: command timed out after ${COMMAND_TIMEOUT_MS}ms: ${command} ${args.join(' ')}`
      );
    }
    throw result.error;
  }
  if (result.signal) {
    throw new RuntimeTruthRatchetError(
      `Runtime truth ratchet: command exited via signal ${result.signal}: ${command} ${args.join(' ')}`
    );
  }
  if (!allowFailure && result.status !== 0) {
    throw new RuntimeTruthRatchetError([
      `Command failed: ${command} ${args.join(' ')}`,
      result.stdout,
      result.stderr,
    ].filter(Boolean).join('\n'));
  }
  return result;
}

function trackedCodeFiles() {
  const result = run('git', ['ls-files', '*.js', '*.mjs', '*.cjs']);
  return result.stdout
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .sort(compareStrings);
}

function sourceCodeFiles(files) {
  return files.filter(file => sourcePrefixes.some(prefix => file.startsWith(prefix)));
}

function eslintBinPath() {
  const executable = process.platform === 'win32' ? 'eslint.cmd' : 'eslint';
  return path.join(repoRoot, 'node_modules', '.bin', executable);
}

function collectStrictLimitFindings(files) {
  const args = [
    '--no-ignore',
    '--format',
    'json',
    ...strictRuleArgs.flatMap(rule => ['--rule', rule]),
    ...files,
  ];
  const result = run(eslintBinPath(), args, { allowFailure: true });
  if (!result.stdout.trim()) {
    throw new RuntimeTruthRatchetError(`ESLint did not produce JSON output.\n${result.stderr}`);
  }

  const reports = JSON.parse(result.stdout);
  return reports.flatMap((report) => {
    const file = normalizePath(path.relative(repoRoot, report.filePath));
    return report.messages
      .filter(message => strictRuleSet.has(message.ruleId))
      .map(message => Object.freeze({
        category: classifyFile(file),
        column: message.column,
        file,
        line: message.line,
        message: message.message,
        ruleId: message.ruleId,
      }));
  }).sort(compareFindings);
}

function collectGenericThrowFindings(files) {
  const findings = [];
  for (const file of files) {
    const content = readFileSync(path.join(repoRoot, file), 'utf8');
    genericThrowPattern.lastIndex = 0;
    for (const match of content.matchAll(genericThrowPattern)) {
      const position = locateTextPosition(content, match.index ?? 0);
      findings.push(Object.freeze({
        category: classifyFile(file),
        column: position.column,
        file,
        kind: match[1],
        line: position.line,
        text: firstMatchedLine(match[0]),
      }));
    }
  }
  return findings.sort(compareFindings);
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

function classifyFile(file) {
  if (file.startsWith('test/')) {
    return 'test';
  }
  if (file.startsWith('benchmarks/')) {
    return 'benchmark';
  }
  if (sourcePrefixes.some(prefix => file.startsWith(prefix))) {
    return 'source';
  }
  return 'config';
}

function summarizeStrictFindings(findings) {
  const byCategory = countBy(findings, finding => finding.category);
  const byRule = countBy(findings, finding => finding.ruleId);
  const byFile = {};

  for (const finding of findings) {
    byFile[finding.file] ??= { category: finding.category, total: 0, byRule: {} };
    byFile[finding.file].total += 1;
    byFile[finding.file].byRule[finding.ruleId] = (byFile[finding.file].byRule[finding.ruleId] ?? 0) + 1;
  }

  return deepSort({
    byCategory,
    byFile,
    byRule,
    total: findings.length,
  });
}

function summarizeGenericThrows(findings) {
  return deepSort({
    byCategory: countBy(findings, finding => finding.category),
    byFile: countBy(findings, finding => finding.file),
    total: findings.length,
  });
}

function countBy(values, selectKey) {
  const counts = {};
  for (const value of values) {
    const key = selectKey(value);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function createSnapshot() {
  const files = trackedCodeFiles();
  const strictFindings = collectStrictLimitFindings(files);
  const genericThrowFindings = collectGenericThrowFindings(sourceCodeFiles(files));

  return deepSort({
    version: 1,
    generatedFrom: 'scripts/runtime-truth-ratchet.mjs',
    strictRuleIds,
    strictLimits: summarizeStrictFindings(strictFindings),
    genericSourceThrows: summarizeGenericThrows(genericThrowFindings),
  });
}

function loadBaseline() {
  if (!existsSync(baselinePath)) {
    throw new RuntimeTruthRatchetError(`Missing Runtime Truth ratchet baseline: ${baselinePath}`);
  }
  return JSON.parse(readFileSync(baselinePath, 'utf8'));
}

function compareToBaseline(current, baseline) {
  return [
    ...compareStrictLimits(current.strictLimits, baseline.strictLimits),
    ...compareGenericThrows(current.genericSourceThrows, baseline.genericSourceThrows),
  ];
}

function compareStrictLimits(current, baseline) {
  const problems = [];
  compareTotals(problems, 'strict total', current.total, baseline.total);
  compareCountMap(problems, 'strict category', current.byCategory, baseline.byCategory);
  compareCountMap(problems, 'strict rule', current.byRule, baseline.byRule);

  for (const [file, currentFile] of Object.entries(current.byFile)) {
    const baselineFile = baseline.byFile[file] ?? { byRule: {}, total: 0 };
    compareTotals(problems, `strict file ${file}`, currentFile.total, baselineFile.total);
    compareCountMap(problems, `strict file ${file}`, currentFile.byRule, baselineFile.byRule);
  }

  return problems;
}

function compareGenericThrows(current, baseline) {
  const problems = [];
  compareTotals(problems, 'generic source throw total', current.total, baseline.total);
  compareCountMap(problems, 'generic source throw category', current.byCategory, baseline.byCategory);
  compareCountMap(problems, 'generic source throw file', current.byFile, baseline.byFile);
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
    process.stderr.write('Runtime Truth ratchet failed.\n');
    for (const problem of problems) {
      process.stderr.write(`- ${problem}\n`);
    }
    process.stderr.write('\nRun `npm run runtime-truth:ratchet -- --json` for the current counts.\n');
    return;
  }

  process.stdout.write([
    'Runtime Truth ratchet passed.',
    `Strict limit violations: ${snapshot.strictLimits.total}`,
    `Generic source throws: ${snapshot.genericSourceThrows.total}`,
    `Strict by category: ${JSON.stringify(snapshot.strictLimits.byCategory)}`,
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

function normalizePath(file) {
  return file.split(path.sep).join('/');
}

function compareStrings(left, right) {
  return left.localeCompare(right);
}

function compareFindings(left, right) {
  return compareStrings(left.file, right.file)
    || left.line - right.line
    || left.column - right.column
    || compareStrings(left.ruleId ?? left.kind ?? '', right.ruleId ?? right.kind ?? '');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const snapshot = createSnapshot();

  if (args.writeBaseline) {
    writeBaseline(snapshot);
    if (!args.json) {
      process.stdout.write(`Wrote Runtime Truth ratchet baseline: ${normalizePath(path.relative(repoRoot, baselinePath))}\n`);
    }
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
