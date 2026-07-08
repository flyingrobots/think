import WarpApp, * as GitWarp from '@git-stunts/git-warp';
import { DependencyError } from '../errors.js';
import { createThinkPlumbing } from '../git.js';
import { createAppContentReader } from './content-reader.js';
import { CHECKPOINT_POLICY, GRAPH_NAME } from './constants.js';
import { createWriterId } from './model.js';

export const LEGACY_CHECKPOINT_REF = `refs/warp/${GRAPH_NAME}/checkpoints/head`;
export const CHECKPOINT_REF = LEGACY_CHECKPOINT_REF;
export const STATE_CACHE_REF = `refs/warp/${GRAPH_NAME}/state-cache`;
export const SUPPORTED_CHECKPOINT_SCHEMA = 5;

export async function openCheckpointStateRead(repoDir, app = null) {
  const persistence = new GitWarp.GitGraphAdapter({
    plumbing: createThinkPlumbing(repoDir),
  });
  const cachedState = await readCachedStateSource(persistence);
  if (cachedState === null) {
    return null;
  }

  const resolvedApp = await resolveApp({
    app,
    persistence,
  });
  const state = await resolvedApp.core().materialize();

  return Object.freeze({
    blobStorage: await createRuntimeBlobStorage(persistence),
    checkpointSha: cachedState.oid,
    cachedState,
    readContent: createAppContentReader(resolvedApp),
    reader: createCheckpointStateReader(state),
  });
}

export async function getCheckpointRefStatus(repoDir) {
  const persistence = new GitWarp.GitGraphAdapter({
    plumbing: createThinkPlumbing(repoDir),
  });
  const legacyStatus = await getLegacyCheckpointRefStatus(persistence);
  if (legacyStatus.exists && !legacyStatus.supported) {
    return legacyStatus;
  }

  const stateCacheOid = await persistence.readRef(STATE_CACHE_REF);
  if (stateCacheOid !== null) {
    return Object.freeze({
      cacheOid: stateCacheOid,
      exists: true,
      kind: 'state_cache',
      ref: STATE_CACHE_REF,
      checkpointSha: null,
      schema: null,
      supportedSchema: SUPPORTED_CHECKPOINT_SCHEMA,
      supported: true,
    });
  }

  return legacyStatus;
}

export async function deleteCheckpointRef(repoDir) {
  const persistence = new GitWarp.GitGraphAdapter({
    plumbing: createThinkPlumbing(repoDir),
  });
  await persistence.deleteRef(LEGACY_CHECKPOINT_REF);
}

export function isUnsupportedCheckpointSchemaError(error) {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return error?.code === 'E_CHECKPOINT_UNSUPPORTED_SCHEMA'
    || message.includes('E_CHECKPOINT_UNSUPPORTED_SCHEMA')
    || /Checkpoint .* is schema:\d+\. Only schema:\d+ checkpoints are supported/.test(message);
}

async function readCachedStateSource(persistence) {
  const stateCacheOid = await persistence.readRef(STATE_CACHE_REF);
  if (stateCacheOid !== null) {
    return Object.freeze({
      kind: 'state_cache',
      oid: stateCacheOid,
      ref: STATE_CACHE_REF,
    });
  }

  const checkpointSha = await persistence.readRef(LEGACY_CHECKPOINT_REF);
  if (checkpointSha !== null) {
    return Object.freeze({
      kind: 'legacy_checkpoint',
      oid: checkpointSha,
      ref: LEGACY_CHECKPOINT_REF,
    });
  }

  return null;
}

async function getLegacyCheckpointRefStatus(persistence) {
  const checkpointSha = await persistence.readRef(LEGACY_CHECKPOINT_REF);
  if (checkpointSha === null) {
    return Object.freeze({
      exists: false,
      kind: 'legacy_checkpoint',
      ref: LEGACY_CHECKPOINT_REF,
      checkpointSha: null,
      schema: null,
      supportedSchema: SUPPORTED_CHECKPOINT_SCHEMA,
      supported: true,
    });
  }

  const message = await persistence.showNode(checkpointSha);
  const schema = parseCheckpointSchema(message);
  return Object.freeze({
    exists: true,
    kind: 'legacy_checkpoint',
    ref: LEGACY_CHECKPOINT_REF,
    checkpointSha,
    schema,
    supportedSchema: SUPPORTED_CHECKPOINT_SCHEMA,
    supported: schema === SUPPORTED_CHECKPOINT_SCHEMA,
  });
}

function parseCheckpointSchema(message) {
  const match = String(message).match(/^eg-schema:\s*(\d+)\s*$/m);
  return match ? Number.parseInt(match[1], 10) : null;
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
