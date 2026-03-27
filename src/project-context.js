import path from 'node:path';
import { spawnSync } from 'node:child_process';

export function getAmbientProjectContext(cwd = process.cwd()) {
  const resolvedCwd = path.resolve(cwd);
  const gitRoot = runGitString(['-C', resolvedCwd, 'rev-parse', '--show-toplevel']);
  const gitRemote = runGitString(['-C', resolvedCwd, 'config', '--get', 'remote.origin.url']);
  const gitBranch = runGitString(['-C', resolvedCwd, 'branch', '--show-current']);
  const projectName = selectProjectName({
    cwd: resolvedCwd,
    gitRoot,
    gitRemote,
  });

  return {
    cwd: resolvedCwd,
    gitRoot,
    gitRemote,
    gitBranch,
    projectName,
    projectTokens: buildProjectTokens({
      cwd: resolvedCwd,
      gitRoot,
      gitRemote,
      projectName,
    }),
  };
}

export function buildQueryTerms(query) {
  const normalized = normalizeValue(query);
  if (!normalized) {
    return [];
  }

  return unique([
    normalized,
    ...splitRecallTokens(normalized),
  ]);
}

function selectProjectName({ cwd, gitRoot, gitRemote }) {
  if (gitRemote) {
    const normalized = gitRemote.trim().replace(/\/+$/, '');
    const lastSegment = normalized.split('/').at(-1) ?? normalized;
    return lastSegment.replace(/\.git$/i, '');
  }

  if (gitRoot) {
    return path.basename(gitRoot);
  }

  return path.basename(cwd);
}

function buildProjectTokens({ cwd, gitRoot, gitRemote, projectName }) {
  const candidates = [
    projectName,
    path.basename(cwd),
    gitRoot ? path.basename(gitRoot) : null,
    gitRemote ? selectProjectName({ cwd, gitRoot, gitRemote }) : null,
  ]
    .filter(Boolean)
    .map(normalizeValue)
    .filter(Boolean);

  const tokens = [];
  for (const candidate of candidates) {
    tokens.push(candidate);
    tokens.push(...splitRecallTokens(candidate));
  }

  return unique(tokens).filter((token) => token.length >= 2);
}

function splitRecallTokens(value) {
  return normalizeValue(value)
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter(Boolean);
}

function normalizeValue(value) {
  return String(value ?? '').trim().toLowerCase();
}

function unique(values) {
  return [...new Set(values)];
}

function runGitString(args) {
  const result = spawnSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.status !== 0) {
    return null;
  }

  const output = String(result.stdout || '').trim();
  return output === '' ? null : output;
}
