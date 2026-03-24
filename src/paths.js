import os from 'node:os';
import path from 'node:path';

export function getHomeDir() {
  return process.env.HOME || os.homedir();
}

export function getThinkDir() {
  return path.join(getHomeDir(), '.think');
}

export function getLocalRepoDir() {
  const configuredRepoDir = (process.env.THINK_REPO_DIR || '').trim();
  if (configuredRepoDir) {
    return path.resolve(configuredRepoDir);
  }

  return path.join(getThinkDir(), 'repo');
}

export function getUpstreamUrl() {
  return (process.env.THINK_UPSTREAM_URL || '').trim();
}
