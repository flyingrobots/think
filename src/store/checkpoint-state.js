import Plumbing from '@git-stunts/plumbing';
import WarpApp, * as GitWarp from '@git-stunts/git-warp';
import { CHECKPOINT_POLICY, GRAPH_NAME } from './constants.js';
import { createWriterId } from './model.js';

const CHECKPOINT_REF = `refs/warp/${GRAPH_NAME}/checkpoints/head`;

export async function openCheckpointStateRead(repoDir, app = null) {
  const persistence = new GitWarp.GitGraphAdapter({
    plumbing: Plumbing.createDefault({ cwd: repoDir }),
  });
  const checkpointSha = await persistence.readRef(CHECKPOINT_REF);
  if (checkpointSha === null) {
    return null;
  }

  const blobStorage = await persistence.createRuntimeBlobStorage();
  const state = await materializeCurrentState({
    app,
    persistence,
  });

  return Object.freeze({
    blobStorage,
    checkpointSha,
    reader: createCheckpointStateReader(state),
  });
}

async function materializeCurrentState({ app, persistence }) {
  const resolvedApp = app ?? await WarpApp.open({
    persistence,
    graphName: GRAPH_NAME,
    writerId: createWriterId(),
    checkpointPolicy: CHECKPOINT_POLICY,
  });

  return await resolvedApp.core().materialize();
}

function createCheckpointStateReader(state) {
  const createReader = GitWarp.createStateReader ?? GitWarp.createStateReaderV5;
  if (typeof createReader !== 'function') {
    throw new Error('Installed @git-stunts/git-warp does not expose a public state reader factory');
  }
  return createReader(state);
}
