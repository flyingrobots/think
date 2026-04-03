import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

import { repoRoot, formatResult } from './runtime.js';
import { createTempDir } from './tmp.js';

export function runGit(args, options = {}) {
  return spawnSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    ...options,
  });
}

export async function createGitRepo({
  prefix = 'git-repo-',
  bare = false,
  name = bare ? 'remote.git' : 'repo',
} = {}) {
  const parentDir = await createTempDir(prefix);
  const repoDir = path.join(parentDir, name);
  await mkdir(repoDir, { recursive: true });

  const args = bare ? ['init', '--bare', repoDir] : ['init', repoDir];
  const init = runGit(args);
  assert.equal(
    init.status,
    0,
    `Failed to create deterministic Git repo fixture.\n${formatResult(init)}`
  );

  return repoDir;
}

export function createBareGitRepo(prefix = 'think-upstream-') {
  return createGitRepo({
    prefix,
    bare: true,
    name: 'remote.git',
  });
}
