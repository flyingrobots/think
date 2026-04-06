import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

export function createTempDir(prefix) {
  return mkdtemp(path.join(tmpdir(), prefix));
}
