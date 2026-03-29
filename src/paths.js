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

export function getPromptMetricsFile() {
  const configuredMetricsFile = (process.env.THINK_PROMPT_METRICS_FILE || '').trim();
  if (configuredMetricsFile) {
    return path.resolve(configuredMetricsFile);
  }

  return path.join(getThinkDir(), 'metrics', 'prompt-ux.jsonl');
}

export function getUpstreamUrl() {
  return (process.env.THINK_UPSTREAM_URL || '').trim();
}
