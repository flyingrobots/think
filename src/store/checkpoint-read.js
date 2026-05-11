import {
  ENTRY_PREFIX,
  GRAPH_META_ID,
  GRAPH_MODEL_VERSION,
} from './constants.js';
import { storesTextContent } from './model.js';
import { BaseEntry } from './runtime.js';
import { openCheckpointStateRead } from './checkpoint-state.js';

class CheckpointReadModel {
  constructor({ blobStorage, reader }) {
    this._blobStorage = blobStorage;
    this._reader = reader;
    Object.freeze(this);
  }

  static async open(repoDir, app = null) {
    const checkpoint = await openCheckpointStateRead(repoDir, app);
    if (checkpoint === null) {
      return null;
    }

    return new CheckpointReadModel({
      blobStorage: checkpoint.blobStorage,
      reader: checkpoint.reader,
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
    return BaseEntry.from(nodeId, props, text);
  }

  async _readNodeText(nodeId) {
    const oid = this._reader.getNodeContentMeta(nodeId)?.oid;
    if (typeof oid !== 'string' || oid.length === 0) {
      return '';
    }
    return new TextDecoder().decode(await this._blobStorage.retrieve(oid));
  }
}

export async function getCheckpointGraphModelStatus(repoDir, app = null) {
  const readModel = await CheckpointReadModel.open(repoDir, app);
  if (readModel === null) {
    return null;
  }
  return readModel.graphModelStatus();
}

export async function listCheckpointEntriesByKind(repoDir, kind, app = null) {
  const readModel = await CheckpointReadModel.open(repoDir, app);
  if (readModel === null) {
    return null;
  }
  return await readModel.listEntriesByKind(kind);
}
