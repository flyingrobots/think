import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import { hasGitRepo } from './git.js';
import { getThinkDir } from './paths.js';

/**
 * Discover all valid minds under the Think directory.
 * A mind is a subdirectory of ~/.think/ containing a git repo.
 * Returns sorted: default first, then alphabetical.
 */
export function discoverMinds(thinkDir = getThinkDir()) {
  if (!existsSync(thinkDir)) {
    return [];
  }

  const entries = readdirSync(thinkDir);
  const minds = [];

  for (const entry of entries) {
    const fullPath = path.join(thinkDir, entry);

    if (!statSync(fullPath).isDirectory()) {
      continue;
    }

    if (!hasGitRepo(fullPath)) {
      continue;
    }

    const isDefault = entry === 'repo';
    minds.push({
      name: isDefault ? 'default' : entry,
      repoDir: fullPath,
      isDefault,
    });
  }

  minds.sort((a, b) => {
    if (a.isDefault) { return -1; }
    if (b.isDefault) { return 1; }
    return a.name.localeCompare(b.name);
  });

  return minds;
}

/**
 * Return a deterministic shader index for a mind name.
 * Uses djb2 hash to map name → shader index.
 */
export function shaderForMind(name, shaderCount) {
  let hash = 5381;
  for (const ch of name) {
    hash = ((hash << 5) + hash + ch.charCodeAt(0)) | 0;
  }
  return Math.abs(hash) % shaderCount;
}
