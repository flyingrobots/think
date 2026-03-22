import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const PUSH_TIMEOUT_MS = 1500;

const DEFAULT_GIT_ENV = {
  GIT_AUTHOR_NAME: 'think',
  GIT_AUTHOR_EMAIL: 'think@local.invalid',
  GIT_COMMITTER_NAME: 'think',
  GIT_COMMITTER_EMAIL: 'think@local.invalid',
};

const NON_INTERACTIVE_PUSH_ENV = {
  GIT_TERMINAL_PROMPT: '0',
  GCM_INTERACTIVE: 'Never',
  SSH_ASKPASS: '/usr/bin/false',
  SSH_ASKPASS_REQUIRE: 'force',
  GIT_SSH_COMMAND: 'ssh -oBatchMode=yes -oConnectTimeout=1',
};

export async function ensureGitRepo(repoDir) {
  await mkdir(repoDir, { recursive: true });

  if (!existsSync(path.join(repoDir, '.git'))) {
    runGit(['init', repoDir], { cwd: process.cwd() });
  }

  runGit(['-C', repoDir, 'config', 'user.name', DEFAULT_GIT_ENV.GIT_AUTHOR_NAME]);
  runGit(['-C', repoDir, 'config', 'user.email', DEFAULT_GIT_ENV.GIT_AUTHOR_EMAIL]);
}

export function pushWarpRefs(repoDir, upstreamUrl, graphName) {
  if (!upstreamUrl) {
    return false;
  }

  const result = spawnSync(
    'git',
    ['-C', repoDir, 'push', '--porcelain', upstreamUrl, `refs/warp/${graphName}/*:refs/warp/${graphName}/*`],
    {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: PUSH_TIMEOUT_MS,
      env: {
        ...process.env,
        ...DEFAULT_GIT_ENV,
        ...NON_INTERACTIVE_PUSH_ENV,
      },
    }
  );

  return result.status === 0 && !result.error;
}

function runGit(args, options = {}) {
  const result = spawnSync('git', args, {
    encoding: 'utf8',
    env: {
      ...process.env,
      ...DEFAULT_GIT_ENV,
    },
    ...options,
  });

  if (result.status !== 0) {
    const error = new Error(`git command failed: git ${args.join(' ')}`);
    error.result = result;
    throw error;
  }

  return result;
}
