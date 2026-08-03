import { spawnSync } from 'node:child_process';
import path from 'node:path';

import { cliEntrypoint, createHermeticThinkEnv, repoRoot, requireCliEntrypoint } from './runtime.js';
import { createBareGitRepo } from './git.js';
import { createTempDir } from './tmp.js';

export async function createThinkContext({ upstream = 'none' } = {}) {
  const homeDir = await createTempDir('think-home-');
  const thinkDir = path.join(homeDir, '.think');
  const localRepoDir = path.join(thinkDir, 'repo');
  let upstreamUrl = '';

  if (upstream === 'bare') {
    upstreamUrl = await createBareGitRepo();
  }

  if (upstream === 'unreachable') {
    upstreamUrl = path.join(homeDir, 'missing-upstream.git');
  }

  return {
    homeDir,
    thinkDir,
    localRepoDir,
    upstreamUrl,
  };
}

export function runThink(context, args, extraEnv = {}, options = {}) {
  requireCliEntrypoint();

  return spawnSync(process.execPath, [cliEntrypoint, ...args], {
    cwd: options.cwd ?? repoRoot,
    encoding: 'utf8',
    input: options.input,
    env: createHermeticThinkEnv({
      extraEnv,
      homeDir: context.homeDir,
      upstreamUrl: context.upstreamUrl,
    }),
  });
}
