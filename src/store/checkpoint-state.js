import Plumbing from '@git-stunts/plumbing';
import { GitGraphAdapter, createStateReader } from '@git-stunts/git-warp';
import { CborPatchJournalAdapter } from '../../node_modules/@git-stunts/git-warp/src/infrastructure/adapters/CborPatchJournalAdapter.ts';
import { CborCheckpointStoreAdapter } from '../../node_modules/@git-stunts/git-warp/src/infrastructure/adapters/CborCheckpointStoreAdapter.ts';
import { loadCheckpoint } from '../../node_modules/@git-stunts/git-warp/src/domain/services/state/checkpointLoad.ts';
import { reduceV5 } from '../../node_modules/@git-stunts/git-warp/src/domain/services/JoinReducer.ts';
import { DEFAULT_COMMIT_MESSAGE_CODEC } from '../../node_modules/@git-stunts/git-warp/src/domain/services/codec/WarpMessageCodec.ts';
import defaultCodec from '../../node_modules/@git-stunts/git-warp/src/domain/utils/defaultCodec.ts';
import { GRAPH_NAME } from './constants.js';

const CHECKPOINT_REF = `refs/warp/${GRAPH_NAME}/checkpoints/head`;
const WRITER_REF_PREFIX = `refs/warp/${GRAPH_NAME}/writers/`;

export async function openCheckpointStateRead(repoDir) {
  const persistence = new GitGraphAdapter({
    plumbing: Plumbing.createDefault({ cwd: repoDir }),
  });
  const checkpointSha = await persistence.readRef(CHECKPOINT_REF);
  if (checkpointSha === null) {
    return null;
  }

  const blobStorage = await persistence.createRuntimeBlobStorage();
  const state = await loadCurrentState({ persistence, checkpointSha, blobStorage });
  return Object.freeze({
    blobStorage,
    checkpointSha,
    reader: createStateReader(state),
  });
}

async function loadCurrentState({ persistence, checkpointSha, blobStorage }) {
  const checkpoint = await loadCheckpoint(
    persistence,
    checkpointSha,
    checkpointLoadOptions(persistence, blobStorage),
  );
  const patchLoader = createPatchLoader(persistence, blobStorage);
  const patchGroups = await Promise.all(
    [...(await targetFrontier(persistence, checkpoint.frontier)).entries()]
      .map(async ([writerId, targetSha]) => {
        const checkpointShaForWriter = checkpoint.frontier.get(writerId);
        return await patchLoader(writerId, checkpointShaForWriter ?? null, targetSha);
      }),
  );
  const patches = patchGroups.flat();
  if (patches.length === 0) {
    return checkpoint.state;
  }
  return reduceV5(patches, checkpoint.state);
}

function checkpointLoadOptions(persistence, blobStorage) {
  return {
    codec: defaultCodec,
    checkpointStore: new CborCheckpointStoreAdapter({
      codec: defaultCodec,
      blobPort: persistence,
      blobStorage,
    }),
    commitMessageCodec: DEFAULT_COMMIT_MESSAGE_CODEC,
  };
}

async function targetFrontier(persistence, checkpointFrontier) {
  const frontier = new Map(checkpointFrontier);
  const writerRefs = await persistence.listRefs(WRITER_REF_PREFIX);
  const writerHeads = await Promise.all(
    writerRefs.map(async (ref) => ({
      writerId: ref.slice(WRITER_REF_PREFIX.length),
      sha: await persistence.readRef(ref),
    })),
  );
  for (const writerHead of writerHeads) {
    if (writerHead.sha !== null) {
      frontier.set(writerHead.writerId, writerHead.sha);
    }
  }
  return frontier;
}

function createPatchLoader(persistence, blobStorage) {
  const patchJournal = new CborPatchJournalAdapter({
    codec: defaultCodec,
    blobPort: persistence,
    commitPort: persistence,
    blobStorage,
    commitMessageCodec: DEFAULT_COMMIT_MESSAGE_CODEC,
  });
  return async (writerId, fromSha, toSha) => {
    const entries = await patchJournal.scanPatchRange(writerId, fromSha, toSha).collect();
    return entries.map((entry) => ({ patch: entry.patch, sha: entry.sha }));
  };
}
