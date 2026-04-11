import { existsSync } from 'node:fs';

import { hasGitRepo } from './git.js';

/**
 * Core diagnostic logic for think --doctor.
 * Pure, testable — no CLI or MCP dependencies.
 *
 * Optional async callbacks (getGraphModelStatus, getEntryCount) allow
 * callers to supply real store access while keeping tests fast.
 */
export async function runDiagnostics({
  thinkDir,
  repoDir,
  upstreamUrl = '',
  getGraphModelStatus = null,
  getEntryCount = null,
} = {}) {
  const checks = [];
  const repoOk = repoDir && existsSync(repoDir) && hasGitRepo(repoDir);

  checks.push(checkThinkDir(thinkDir));
  checks.push(checkLocalRepo(repoDir));
  checks.push(await checkGraphModel(repoOk, getGraphModelStatus));
  checks.push(await checkEntryCount(repoOk, getEntryCount));
  checks.push(checkUpstream(upstreamUrl));

  return { checks };
}

function checkThinkDir(thinkDir) {
  if (!thinkDir || !existsSync(thinkDir)) {
    return { name: 'think_dir', status: 'fail', message: `Think directory not found (${thinkDir ?? '?'})` };
  }
  return { name: 'think_dir', status: 'ok', message: `Think directory exists (${thinkDir})` };
}

function checkLocalRepo(repoDir) {
  if (!repoDir || !existsSync(repoDir)) {
    return { name: 'local_repo', status: 'fail', message: `Local repo not found (${repoDir ?? '?'})` };
  }
  if (!hasGitRepo(repoDir)) {
    return { name: 'local_repo', status: 'fail', message: `Local repo is not a git repo (${repoDir})` };
  }
  return { name: 'local_repo', status: 'ok', message: 'Local repo is a valid git repo' };
}

async function checkGraphModel(repoOk, getGraphModelStatus) {
  if (!repoOk || !getGraphModelStatus) {
    return { name: 'graph_model', status: 'skip', message: 'Graph model check skipped (no repo)' };
  }

  try {
    const status = await getGraphModelStatus();
    if (status.migrationRequired) {
      return {
        name: 'graph_model',
        status: 'warn',
        message: `Graph model needs migration (v${status.currentGraphModelVersion} → v${status.requiredGraphModelVersion})`,
      };
    }
    return {
      name: 'graph_model',
      status: 'ok',
      message: `Graph model is current (v${status.currentGraphModelVersion})`,
    };
  } catch {
    return { name: 'graph_model', status: 'fail', message: 'Graph model check failed' };
  }
}

async function checkEntryCount(repoOk, getEntryCount) {
  if (!repoOk || !getEntryCount) {
    return { name: 'entry_count', status: 'skip', message: 'Entry count check skipped (no repo)' };
  }

  try {
    const total = await getEntryCount();
    if (total === 0) {
      return { name: 'entry_count', status: 'warn', message: 'No thoughts captured yet' };
    }
    return { name: 'entry_count', status: 'ok', message: `${total} thoughts captured` };
  } catch {
    return { name: 'entry_count', status: 'fail', message: 'Entry count check failed' };
  }
}

function checkUpstream(upstreamUrl) {
  if (!upstreamUrl) {
    return { name: 'upstream', status: 'skip', message: 'Upstream not configured' };
  }
  return { name: 'upstream', status: 'ok', message: `Upstream configured (${upstreamUrl})` };
}
