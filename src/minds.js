import { getThinkDir } from './paths.js';

/**
 * Discover all valid minds under the Think directory.
 * A mind is a subdirectory of ~/.think/ containing a git repo.
 */
export function discoverMinds(_thinkDir = getThinkDir()) {
  // TODO: implement
  return [];
}

/**
 * Return a deterministic shader index for a mind name.
 */
export function shaderForMind(_name, _shaderCount) {
  // TODO: implement
  return 0;
}
