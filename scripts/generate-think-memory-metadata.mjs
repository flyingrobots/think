import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const REQUIRED_WESLEY_VERSION = '0.3.0-alpha.1';
const wesley = process.env.WESLEY_BIN || 'wesley';
const repoRoot = path.resolve(import.meta.dirname, '..');
const schema = path.join(repoRoot, 'contracts', 'think-git-warp-v19.graphql');
const output = path.join(repoRoot, 'src', 'generated', 'think-memory.wesley.generated.ts');

class ThinkMemoryMetadataGenerationError extends Error {}

const { stdout } = await execFileAsync(wesley, ['--version']);
if (stdout.trim() !== REQUIRED_WESLEY_VERSION) {
  throw new ThinkMemoryMetadataGenerationError(
    `Think SDK generation requires Wesley ${REQUIRED_WESLEY_VERSION}; received ${stdout.trim() || 'no version'}`
  );
}

await execFileAsync(wesley, [
  'emit',
  'typescript',
  '--schema',
  schema,
  '--out',
  output,
]);
