import Plumbing from '@git-stunts/plumbing';
import { GitGraphAdapter, createStateReader } from '@git-stunts/git-warp';
import { CborPatchJournalAdapter } from '../../node_modules/@git-stunts/git-warp/src/infrastructure/adapters/CborPatchJournalAdapter.ts';
import { CborCheckpointStoreAdapter } from '../../node_modules/@git-stunts/git-warp/src/infrastructure/adapters/CborCheckpointStoreAdapter.ts';
import { loadCheckpoint } from '../../node_modules/@git-stunts/git-warp/src/domain/services/state/checkpointLoad.ts';
import { reduceV5 } from '../../node_modules/@git-stunts/git-warp/src/domain/services/JoinReducer.ts';
import { DEFAULT_COMMIT_MESSAGE_CODEC } from '../../node_modules/@git-stunts/git-warp/src/domain/services/codec/WarpMessageCodec.ts';
import defaultCodec from '../../node_modules/@git-stunts/git-warp/src/domain/utils/defaultCodec.ts';
import {
  ENTRY_PREFIX,
  GRAPH_META_ID,
  GRAPH_MODEL_VERSION,
  GRAPH_NAME,
} from './constants.js';
import { storesTextContent } from './model.js';
import { StoredEntry } from './runtime.js';

const CHECKPOINT_REF = `refs/warp/${GRAPH_NAME}/checkpoints/head`;
const WRITER_REF_PREFIX = `refs/warp/${GRAPH_NAME}/writers/`;

class CheckpointReadModel {
  constructor({ blobStorage, reader }) {
    this._blobStorage = blobStorage;
    this._reader = reader;
    Object.freeze(this);
  }

  static async open(repoDir) {
    const persistence = new GitGraphAdapter({
      plumbing: Plumbing.createDefault({ cwd: repoDir }),
    });
    const checkpointSha = await persistence.readRef(CHECKPOINT_REF);
    if (checkpointSha === null) {
      return null;
    }

    const blobStorage = await persistence.createRuntimeBlobStorage();
    const state = await loadCurrentState({ persistence, checkpointSha, blobStorage });
    return new CheckpointReadModel({
      blobStorage,
      reader: createStateReader(state),
    });
  }

  graphModelStatus() {
    if (this._latestCaptureId() === null) {
      return {
        currentGraphModelVersion: 1,
        requiredGraphModelVersion: GRAPH_MODEL_VERSION,
        migrationRequired: true,
      };
    }

    const props = this._reader.getNodeProps(GRAPH_META_ID);
    const currentGraphModelVersion = Number(props?.graphModelVersion ?? 1);
    return {
      currentGraphModelVersion,
      requiredGraphModelVersion: GRAPH_MODEL_VERSION,
      migrationRequired: currentGraphModelVersion < GRAPH_MODEL_VERSION,
    };
  }

  async listEntriesByKind(kind) {
    if (kind !== 'capture') {
      return null;
    }

    const entryNodes = this._entryNodeIds()
      .map((nodeId) => this._entryCandidate(nodeId, kind))
      .filter(Boolean);
    return await Promise.all(
      entryNodes.map(({ nodeId, props }) => this._storedEntry(nodeId, props)),
    );
  }

  _entryNodeIds() {
    return this._reader.project().nodes.filter((nodeId) => nodeId.startsWith(ENTRY_PREFIX));
  }

  _latestCaptureId() {
    return this._singleOutgoingNodeId(GRAPH_META_ID, 'latest_capture');
  }

  _singleOutgoingNodeId(nodeId, label) {
    const neighbors = this._reader.neighbors(nodeId, 'outgoing', label);
    return neighbors[0]?.nodeId ?? null;
  }

  _entryCandidate(nodeId, kind) {
    const props = this._reader.getNodeProps(nodeId);
    if (props?.kind !== kind) {
      return null;
    }
    return { nodeId, props };
  }

  async _storedEntry(nodeId, props) {
    const text = storesTextContent(props.kind)
      ? await this._readNodeText(nodeId)
      : '';
    return new StoredEntry(nodeId, props, text);
  }

  async _readNodeText(nodeId) {
    const oid = this._reader.getNodeContentMeta(nodeId)?.oid;
    if (typeof oid !== 'string' || oid.length === 0) {
      return '';
    }
    return new TextDecoder().decode(await this._blobStorage.retrieve(oid));
  }
}

export async function getCheckpointGraphModelStatus(repoDir) {
  const readModel = await CheckpointReadModel.open(repoDir);
  if (readModel === null) {
    return null;
  }
  return readModel.graphModelStatus();
}

export async function listCheckpointEntriesByKind(repoDir, kind) {
  const readModel = await CheckpointReadModel.open(repoDir);
  if (readModel === null) {
    return null;
  }
  return await readModel.listEntriesByKind(kind);
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
