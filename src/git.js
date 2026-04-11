import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

import { TimeoutError } from '@git-stunts/alfred';

import { createPushPolicy } from './policies.js';

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

  if (!hasGitRepo(repoDir)) {
    runGit(['init', repoDir], { cwd: process.cwd() });
  }

  runGit(['-C', repoDir, 'config', 'user.name', DEFAULT_GIT_ENV.GIT_AUTHOR_NAME]);
  runGit(['-C', repoDir, 'config', 'user.email', DEFAULT_GIT_ENV.GIT_AUTHOR_EMAIL]);
}

export async function pushWarpRefs(repoDir, upstreamUrl, graphName, { reporter } = {}) {
  if (!upstreamUrl) {
    return false;
  }

  try {
    const policy = createPushPolicy({
      shouldRetry: shouldRetryPush,
      onTimeout(elapsed) {
        reporter?.event('backup.timeout', {
          elapsedMs: elapsed,
          timeoutMs: 1500,
        });
      },
      onRetry(error, attempt, delay) {
        reporter?.event('backup.retry', {
          attempt,
          delayMs: delay,
          reason: describePushError(error),
        });
      },
    });

    await policy.execute(signal => runGitPush(repoDir, upstreamUrl, graphName, signal));

    return true;
  } catch (error) {
    reporter?.event('backup.failure', {
      reason: describePushError(error),
    });
    return false;
  }
}

export function hasGitRepo(repoDir) {
  return existsSync(path.join(repoDir, '.git'));
}

const LS_REMOTE_TIMEOUT_MS = 5000;

export function lsRemote(upstreamUrl) {
  const result = spawnSync('git', ['ls-remote', '--exit-code', upstreamUrl], {
    env: {
      ...process.env,
      ...NON_INTERACTIVE_PUSH_ENV,
    },
    timeout: LS_REMOTE_TIMEOUT_MS,
    stdio: 'ignore',
  });
  return result.status === 0;
}

function runGitPush(repoDir, upstreamUrl, graphName, signal) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'git',
      ['-C', repoDir, 'push', '--porcelain', upstreamUrl, `refs/warp/${graphName}/*:refs/warp/${graphName}/*`],
      {
        env: {
          ...process.env,
          ...DEFAULT_GIT_ENV,
          ...NON_INTERACTIVE_PUSH_ENV,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );

    let stdout = '';
    let stderr = '';
    let settled = false;

    const onAbort = () => {
      child.kill('SIGTERM');
    };

    if (signal) {
      if (signal.aborted) {
        onAbort();
      } else {
        signal.addEventListener('abort', onAbort, { once: true });
      }
    }

    child.stdout.on('data', chunk => {
      stdout += String(chunk);
    });

    child.stderr.on('data', chunk => {
      stderr += String(chunk);
    });

    child.on('error', error => {
      finish(buildPushError(error.message, { stdout, stderr, cause: error }));
    });

    child.on('close', (code, childSignal) => {
      if (code === 0) {
        finish(null, { stdout, stderr });
        return;
      }

      finish(
        buildPushError(`git push failed with code ${code ?? 'unknown'}`, {
          code,
          signal: childSignal,
          stdout,
          stderr,
        })
      );
    });

    function finish(error, result) {
      if (settled) {
        return;
      }

      settled = true;
      signal?.removeEventListener('abort', onAbort);

      if (error) {
        reject(error);
        return;
      }

      resolve(result);
    }
  });
}

function shouldRetryPush(error) {
  if (error instanceof TimeoutError || error?.name === 'TimeoutError') {
    return true;
  }

  const text = describePushError(error).toLowerCase();
  return (
    text.includes('timed out') ||
    text.includes('timeout') ||
    text.includes('connection reset') ||
    text.includes('temporarily unavailable')
  );
}

function describePushError(error) {
  if (!error) {
    return 'unknown push failure';
  }

  const pieces = [
    error.message,
    error.stderr,
    error.stdout,
  ].filter(Boolean);

  return pieces.join(' ').trim() || 'unknown push failure';
}

function buildPushError(message, details = {}) {
  const error = new Error(message);
  Object.assign(error, details);
  return error;
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
