import { execFile, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { promisify } from 'node:util';

import { Runtime } from '@git-stunts/git-warp';
import { captureCoordinate as captureLaneCoordinate } from '@git-stunts/git-warp/advanced';

import { ThinkError } from '../errors.js';
import { GIT_BINARY, THINK_GIT_CONFIG_ARGS } from '../git.js';
import { thinkMemory } from '../generated/think-memory.generated.js';
import { GRAPH_NAME } from './constants.js';
import { createWriterId } from './model.js';
import {
  INDEX_DOCUMENT_KEY,
  INDEX_PAGE_DOCUMENT_KEY,
} from './native-document.js';

const execFileAsync = promisify(execFile);
const nodeRequire = createRequire(import.meta.url);
const packageRoot = path.dirname(nodeRequire.resolve('@git-stunts/git-warp/package.json'));
const gitWarpCli = path.join(packageRoot, 'bin', 'git-warp');
const sessions = new Map();
const MAX_WRITE_ATTEMPTS = 3;

export async function openNativeMemory(repoDir, {
  writerId = createWriterId(),
} = {}) {
  const cacheKey = `${path.resolve(repoDir)}\0${writerId}`;
  let session = sessions.get(cacheKey);
  if (!session) {
    // eslint-disable-next-line no-use-before-define -- the cache factory precedes the session class
    session = await NativeMemorySession.open(repoDir, writerId);
    sessions.set(cacheKey, session);
  }
  return session;
}

export async function closeNativeMemory(repoDir) {
  const resolvedRepo = path.resolve(repoDir);
  const matches = [...sessions.entries()]
    .filter(([cacheKey]) => cacheKey.startsWith(`${resolvedRepo}\0`));
  await Promise.all(matches.map(async ([cacheKey, session]) => {
    sessions.delete(cacheKey);
    await session.close();
  }));
}

export class NativeMemoryCoordinateReader {
  constructor(optic) {
    this.optic = optic;
  }

  async memoryIndex(subject) {
    return await this.readProperty(
      subject,
      INDEX_DOCUMENT_KEY,
      'memory index'
    );
  }

  async memoryIndexPage(subject) {
    return await this.readProperty(
      subject,
      INDEX_PAGE_DOCUMENT_KEY,
      'memory index page'
    );
  }

  async readProperty(subject, key, kind) {
    const result = await this.optic.node(subject).prop(key).read();
    return normalizeObservedBytes(
      result.exists ? result.value : null,
      subject,
      kind
    );
  }
}

export class NativeMemorySession {
  constructor(repoDir, writerId, runtime, lane) {
    this.repoDir = path.resolve(repoDir);
    this.writerId = writerId;
    this.runtime = runtime;
    this.lane = lane;
  }

  static async open(repoDir, writerId) {
    const runtime = await Runtime.open({
      at: repoDir,
      writer: writerId,
    });
    const lane = await runtime.lane(GRAPH_NAME);
    return new NativeMemorySession(repoDir, writerId, runtime, lane);
  }

  async close() {
    await this.runtime.close();
  }

  async reopen() {
    await this.runtime.close();
    this.runtime = await Runtime.open({
      at: this.repoDir,
      writer: this.writerId,
    });
    this.lane = await this.runtime.lane(GRAPH_NAME);
  }

  hasHistory() {
    const result = spawnSync(
      GIT_BINARY,
      [
        ...THINK_GIT_CONFIG_ARGS,
        '-C',
        this.repoDir,
        'for-each-ref',
        '--count=1',
        '--format=%(refname)',
        `refs/warp/${GRAPH_NAME}/writers/`,
      ],
      { encoding: 'utf8' }
    );
    if (result.status !== 0) {
      throw new ThinkError(
        `Unable to inspect native Think writer refs in ${this.repoDir}`,
        'V19_HISTORY_INSPECTION_FAILED'
      );
    }
    return result.stdout.trim().length > 0;
  }

  async declareMemoryObject(subject) {
    return await this.write(thinkMemory.intents.declareMemoryObject({ subject }));
  }

  async storeMemoryDocument(subject, value) {
    return await this.write(thinkMemory.intents.storeMemoryDocument({ subject, value }));
  }

  async storeMemoryIndex(subject, value) {
    return await this.write(thinkMemory.intents.storeMemoryIndex({ subject, value }));
  }

  async storeMemoryIndexPage(subject, value) {
    return await this.write(thinkMemory.intents.storeMemoryIndexPage({ subject, value }));
  }

  async memoryDocument(subject) {
    return normalizeObservedBytes(
      await this.observeOne(thinkMemory.observers.memoryDocument({ subject })),
      subject,
      'memory document'
    );
  }

  async memoryIndex(subject) {
    return normalizeObservedBytes(
      await this.observeOne(thinkMemory.observers.memoryIndex({ subject })),
      subject,
      'memory index'
    );
  }

  async memoryIndexPage(subject) {
    return normalizeObservedBytes(
      await this.observeOne(thinkMemory.observers.memoryIndexPage({ subject })),
      subject,
      'memory index page'
    );
  }

  async writeMemoryDocument({
    id,
    bytes,
    declare = true,
  }) {
    return await this.writeDocument({
      bytes,
      declare,
      id,
      store: value => this.storeMemoryDocument(id, value),
    });
  }

  async writeMemoryIndex({
    id,
    bytes,
    declare = true,
  }) {
    return await this.writeDocument({
      bytes,
      declare,
      id,
      store: value => this.storeMemoryIndex(id, value),
    });
  }

  async writeMemoryIndexPage({
    id,
    bytes,
    declare = true,
  }) {
    return await this.writeDocument({
      bytes,
      declare,
      id,
      store: value => this.storeMemoryIndexPage(id, value),
    });
  }

  async writeDocument({ id, bytes, declare, store }) {
    const receipts = [];
    if (declare) {
      receipts.push(await this.declareMemoryObject(id));
    }
    receipts.push(await store(bytes));
    return Object.freeze(receipts);
  }

  async exists(subject) {
    return await this.observeOne(thinkMemory.observers.memoryObjectExists({ subject }));
  }

  async observeOne(observer) {
    const values = await this.consumeObservation(observer);
    if (values.length !== 1) {
      throw new ThinkError(
        `Observer ${observer.id} emitted ${values.length} readings; expected exactly one`,
        'V19_OBSERVER_CARDINALITY'
      );
    }
    return values[0];
  }

  async consumeObservation(observer) {
    try {
      return await this.consumeObservationOnce(observer);
    } catch (error) {
      if (!isMissingBasisError(error)) {
        throw error;
      }
      await this.repairBasis();
      return await this.consumeObservationOnce(observer);
    }
  }

  async captureBoundedReader() {
    let coordinate;
    try {
      coordinate = await captureLaneCoordinate(this.lane);
    } catch (error) {
      if (!isMissingCoordinateBasisError(error)) {
        throw error;
      }
      await this.repairBasis();
      coordinate = await captureLaneCoordinate(this.lane);
    }
    return new NativeMemoryCoordinateReader(coordinate.optic());
  }

  async consumeObservationOnce(observer) {
    const observation = this.lane.observe(observer);
    const values = [];
    for await (const reading of observation) {
      values.push(reading.value);
    }
    const receipt = await observation.receipt;
    if (receipt.status !== 'completed') {
      const error = new ThinkError(
        `Observer ${observer.id} ${receipt.status}: ${receipt.reason ?? 'no reason provided'}`,
        'V19_OBSERVATION_INCOMPLETE'
      );
      error.receipt = receipt;
      throw error;
    }
    return Object.freeze(values);
  }

  async repairBasis() {
    await this.runtime.close();
    await execFileAsync(process.execPath, [
      gitWarpCli,
      '--repo',
      this.repoDir,
      '--lane',
      GRAPH_NAME,
      '--writer',
      this.writerId,
      '--json',
      'repair',
      '--action',
      'materialization',
    ]);
    this.runtime = await Runtime.open({
      at: this.repoDir,
      writer: this.writerId,
    });
    this.lane = await this.runtime.lane(GRAPH_NAME);
  }

  async write(intent) {
    let attempt = 1;
    /* eslint-disable no-await-in-loop -- admission retries must follow the current writer head */
    while (true) {
      try {
        const receipt = await this.lane.write(intent);
        requireAdmitted(receipt);
        return receipt;
      } catch (error) {
        if (!isWriterCasConflict(error) || attempt >= MAX_WRITE_ATTEMPTS) {
          throw error;
        }
        await this.reopen();
        attempt += 1;
      }
    }
    /* eslint-enable no-await-in-loop */
  }
}

function requireAdmitted(receipt) {
  if (receipt.outcome.kind === 'derived' || receipt.outcome.kind === 'plural') {
    return;
  }
  const error = new ThinkError(
    `Native Think write was ${receipt.outcome.kind}`,
    'V19_WRITE_NOT_ADMITTED'
  );
  error.receipt = receipt;
  throw error;
}

function isWriterCasConflict(error) {
  return error instanceof Error && (
    error.code === 'E_WRITER_CAS_CONFLICT'
    || error.message.includes('writer ref was updated by another process')
  );
}

function isMissingBasisError(error) {
  return error instanceof Error
    && error.code === 'V19_OBSERVATION_INCOMPLETE'
    && error.receipt?.reason === 'missing_bounded_basis';
}

function isMissingCoordinateBasisError(error) {
  return error instanceof Error
    && error.code === 'E_OPTIC_NO_BOUNDED_BASIS';
}

function normalizeObservedBytes(value, subject, kind) {
  if (value === null || value instanceof Uint8Array) {
    return value;
  }
  if (typeof value?.toUint8Array === 'function') {
    return value.toUint8Array();
  }
  throw new ThinkError(
    `Native Think ${kind} for ${subject} returned an unsupported value`,
    'V19_BYTES_VALUE_INVALID'
  );
}
