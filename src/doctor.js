import { existsSync } from 'node:fs';

import { hasGitRepo } from './git.js';

/**
 * Core diagnostic logic for think --doctor.
 * Pure, testable — no CLI or MCP dependencies.
 */
export function runDiagnostics({ thinkDir, repoDir, upstreamUrl = '' } = {}) {
  const checks = [];

  checks.push(checkThinkDir(thinkDir));
  checks.push(checkLocalRepo(repoDir));
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
  return { name: 'local_repo', status: 'ok', message: `Local repo is a valid git repo` };
}

function checkUpstream(upstreamUrl) {
  if (!upstreamUrl) {
    return { name: 'upstream', status: 'skip', message: 'Upstream not configured' };
  }
  return { name: 'upstream', status: 'ok', message: `Upstream configured (${upstreamUrl})` };
}
