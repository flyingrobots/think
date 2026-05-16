import Plumbing from '@git-stunts/plumbing';
import WarpApp, * as GitWarp from '@git-stunts/git-warp';
import { DependencyError } from '../errors.js';
import { createAppContentReader } from './content-reader.js';
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

  const resolvedApp = await resolveApp({
    app,
    persistence,
  });
  const state = await resolvedApp.core().materialize();

  return Object.freeze({
    blobStorage: await createRuntimeBlobStorage(persistence),
    checkpointSha,
    readContent: createAppContentReader(resolvedApp),
    reader: createCheckpointStateReader(state),
  });
}

function createRuntimeBlobStorage(persistence) {
  const createStorage = persistence.createRuntimeBlobStorage;
  if (typeof createStorage !== 'function') {
    return null;
  }
  return createStorage.call(persistence);
}

async function resolveApp({ app, persistence }) {
  return app ?? await WarpApp.open({
    persistence,
    graphName: GRAPH_NAME,
    writerId: createWriterId(),
    checkpointPolicy: CHECKPOINT_POLICY,
  });
}

function createCheckpointStateReader(state) {
  const createReader = GitWarp.createStateReader ?? GitWarp.createStateReaderV5;
  if (typeof createReader !== 'function') {
    throw new DependencyError('Installed @git-stunts/git-warp does not expose a public state reader factory');
  }
  return createReader(state);
}
