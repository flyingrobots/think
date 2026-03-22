import { ensureGitRepo, pushWarpRefs } from './git.js';
import { getLocalRepoDir, getUpstreamUrl } from './paths.js';
import { captureThought, GRAPH_NAME, listRecent } from './store.js';

export async function main(argv, { stdout, stderr }) {
  const args = argv.slice(2);

  try {
    if (args.length === 1 && args[0] === 'recent') {
      return await runRecent(stdout);
    }

    const thought = args.length <= 1 ? (args[0] ?? '') : args.join(' ');
    return await runCapture(thought, stdout, stderr);
  } catch {
    stderr.write('Something went wrong\n');
    return 1;
  }
}

async function runCapture(thought, stdout, stderr) {
  if (thought.trim() === '') {
    stderr.write('Thought cannot be empty\n');
    return 1;
  }

  const repoDir = getLocalRepoDir();
  await ensureGitRepo(repoDir);
  await captureThought(repoDir, thought);

  stdout.write('Saved locally\n');

  const upstreamUrl = getUpstreamUrl();
  if (!upstreamUrl) {
    return 0;
  }

  const backedUp = pushWarpRefs(repoDir, upstreamUrl, GRAPH_NAME);
  stdout.write(backedUp ? 'Backed up\n' : 'Backup pending\n');
  return 0;
}

async function runRecent(stdout) {
  const repoDir = getLocalRepoDir();
  await ensureGitRepo(repoDir);

  const entries = await listRecent(repoDir);
  if (entries.length > 0) {
    stdout.write(`${entries.map(entry => entry.text).join('\n')}\n`);
  }

  return 0;
}
