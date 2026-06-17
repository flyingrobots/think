import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { execSync, spawn, spawnSync } from 'node:child_process';

import { TimeoutError } from '@git-stunts/alfred';
import Plumbing, { ShellRunnerFactory } from '@git-stunts/plumbing';

import { ThinkError } from './errors.js';
import { createPushPolicy } from './policies.js';

function resolveGitBinary() {
  try {
    return execSync('which git', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || 'git';
  } catch {
    return 'git';
  }
}

export const GIT_BINARY = resolveGitBinary();

export const THINK_GIT_CONFIG_ARGS = Object.freeze(['-c', 'core.fsmonitor=false']);

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

  setFsmonitorDisabled(repoDir);
  runGit(['-C', repoDir, 'config', 'user.name', DEFAULT_GIT_ENV.GIT_AUTHOR_NAME]);
  runGit(['-C', repoDir, 'config', 'user.email', DEFAULT_GIT_ENV.GIT_AUTHOR_EMAIL]);
}

export function setFsmonitorDisabled(repoDir) {
  runGit(['-C', repoDir, 'config', 'core.fsmonitor', 'false']);
}

export function createThinkPlumbing(repoDir) {
  return new Plumbing({
    cwd: repoDir,
    runner: createFsmonitorDisabledRunner(),
  });
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
  const result = spawnSync(GIT_BINARY, withThinkGitConfig(['ls-remote', '--exit-code', upstreamUrl]), {
    env: {
      ...process.env,
      ...NON_INTERACTIVE_PUSH_ENV,
    },
    timeout: LS_REMOTE_TIMEOUT_MS,
    stdio: 'ignore',
  });
  return result.status === 0;
}

export function getFsmonitorStatus(repoDir) {
  const effective = readGitConfigWithOrigin(['-C', repoDir, 'config', '--show-origin', '--get', 'core.fsmonitor']);

  return Object.freeze({
    effectiveValue: effective?.value ?? null,
    effectiveSource: effective?.origin ?? null,
    localValue: readGitConfigValue(['-C', repoDir, 'config', '--local', '--get', 'core.fsmonitor']),
    globalValue: readGitConfigValue(['config', '--global', '--get', 'core.fsmonitor']),
  });
}

function createFsmonitorDisabledRunner() {
  const runner = ShellRunnerFactory.create();

  return (options) => runner({
    ...options,
    args: withThinkGitConfig(options.args),
  });
}

function withThinkGitConfig(args) {
  return [...THINK_GIT_CONFIG_ARGS, ...args];
}

function readGitConfigValue(args) {
  const raw = readOptionalGitConfig(args);
  return raw === null ? null : raw.trim();
}

function readGitConfigWithOrigin(args) {
  const raw = readOptionalGitConfig(args);
  if (raw === null) {
    return null;
  }

  const line = raw.trim().split('\n').filter(Boolean).at(-1);
  if (!line) {
    return null;
  }

  const tabIndex = line.lastIndexOf('\t');
  if (tabIndex === -1) {
    return Object.freeze({ origin: 'unknown', value: line.trim() });
  }

  return Object.freeze({
    origin: line.slice(0, tabIndex).trim(),
    value: line.slice(tabIndex + 1).trim(),
  });
}

function readOptionalGitConfig(args) {
  const result = spawnSync(GIT_BINARY, args, {
    encoding: 'utf8',
    env: process.env,
  });

  if (result.status === 0) {
    return result.stdout;
  }

  if (result.status === 1) {
    return null;
  }

  const error = new ThinkError(`git config inspection failed: git ${args.join(' ')}`, 'GIT_COMMAND_FAILED');
  error.result = result;
  throw error;
}

function runGitPush(repoDir, upstreamUrl, graphName, signal) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      GIT_BINARY,
      withThinkGitConfig([
        '-C',
        repoDir,
        'push',
        '--porcelain',
        upstreamUrl,
        `refs/warp/${graphName}/*:refs/warp/${graphName}/*`,
      ]),
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
  const result = spawnSync(GIT_BINARY, withThinkGitConfig(args), {
    encoding: 'utf8',
    env: {
      ...process.env,
      ...DEFAULT_GIT_ENV,
    },
    ...options,
  });

  if (result.status !== 0) {
    const error = new ThinkError(`git command failed: git ${withThinkGitConfig(args).join(' ')}`, 'GIT_COMMAND_FAILED');
    error.result = result;
    throw error;
  }

  return result;
}
