import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { promisify } from 'node:util';

import { Runtime } from '@git-stunts/git-warp';
import {
  captureCoordinate,
  intent,
} from '@git-stunts/git-warp/advanced';

import { DependencyError, ThinkError, ValidationError } from '../errors.js';
import {
  CAPTURE_OCCURRENCE_PROFILE,
  CAPTURE_REPLAY_PROFILE,
  CAPTURE_SUBJECT_NAMESPACE,
  CaptureAdmission,
  CaptureAdmissionReceipt,
  CaptureBasis,
  CaptureEnumerationUnavailableError,
  CaptureOccurrence,
  CaptureOccurrenceStorePort,
  CaptureReplayProvenance,
} from './capture-occurrence.js';

const execFileAsync = promisify(execFile);
const nodeRequire = createRequire(import.meta.url);
const packageJson = nodeRequire('@git-stunts/git-warp/package.json');
const packageRoot = path.dirname(
  nodeRequire.resolve('@git-stunts/git-warp/package.json')
);
const gitWarpCli = path.join(packageRoot, 'bin', 'git-warp');
const REQUIRED_GIT_WARP_VERSION = '19.1.0';

export class GitWarpCaptureOccurrenceStore extends CaptureOccurrenceStorePort {
  constructor(fields) {
    super();
    const options = requireOptions(fields);
    this.repoDir = path.resolve(options.repoDir);
    this.laneName = options.laneName;
    this.writerId = options.writerId;
    this.runtime = options.runtime;
    this.lane = options.lane;
    this.closePromise = null;
  }

  static async open(fields) {
    requireExactGitWarpVersion();
    const options = requireOpenOptions(fields);
    const handles = await openRuntimeLane(options);
    return new GitWarpCaptureOccurrenceStore({ ...options, ...handles });
  }

  async admit(fields) {
    const { capture, replay } = requireAdmission(fields);
    const write = intent.entity.addAuto({
      namespace: CAPTURE_SUBJECT_NAMESPACE,
      properties: {
        [CAPTURE_OCCURRENCE_PROFILE]: capture.toPropertyValue(),
        [CAPTURE_REPLAY_PROFILE]: replay.toPropertyValue(),
      },
    });
    const receipt = await this.lane.write(write);
    return createAdmissionReceipt(capture, receipt);
  }

  async read(representationSubject) {
    const subject = requireNonEmptyString(
      representationSubject,
      'representationSubject'
    );
    const coordinate = await this.captureReadableCoordinate();
    const optic = coordinate.optic().node(subject);
    const [captureResult, replayResult] = await Promise.all([
      optic.prop(CAPTURE_OCCURRENCE_PROFILE).read(),
      optic.prop(CAPTURE_REPLAY_PROFILE).read(),
    ]);
    if (!captureResult.exists && !replayResult.exists) {
      return null;
    }
    requireCompleteOccurrence(captureResult, replayResult, subject);
    return new CaptureOccurrence({
      representationSubject: subject,
      capture: CaptureAdmission.fromPropertyValue(captureResult.value),
      replay: CaptureReplayProvenance.fromPropertyValue(replayResult.value),
      basis: basisFromCoordinate(this.laneName, coordinate),
    });
  }

  async enumerate() {
    const coordinate = await this.captureReadableCoordinate();
    throw new CaptureEnumerationUnavailableError(
      basisFromCoordinate(this.laneName, coordinate)
    );
  }

  async close() {
    this.closePromise ??= this.runtime.close();
    await this.closePromise;
  }

  async captureReadableCoordinate() {
    try {
      return await captureCoordinate(this.lane);
    } catch (error) {
      if (error?.code !== 'E_OPTIC_NO_BOUNDED_BASIS') {
        throw error;
      }
      await this.repairMaterialization();
      return await captureCoordinate(this.lane);
    }
  }

  async repairMaterialization() {
    await this.close();
    await execFileAsync(process.execPath, [
      gitWarpCli,
      '--repo',
      this.repoDir,
      '--lane',
      this.laneName,
      '--writer',
      this.writerId,
      '--json',
      'repair',
      '--action',
      'materialization',
    ]);
    await this.reopen();
  }

  async reopen() {
    const handles = await openRuntimeLane({
      repoDir: this.repoDir,
      laneName: this.laneName,
      writerId: this.writerId,
    });
    this.runtime = handles.runtime;
    this.lane = handles.lane;
    this.closePromise = null;
  }
}

async function openRuntimeLane(options) {
  const runtime = await Runtime.open({
    at: options.repoDir,
    writer: options.writerId,
  });
  try {
    return Object.freeze({
      runtime,
      lane: await runtime.lane(options.laneName),
    });
  } catch (error) {
    await runtime.close();
    throw error;
  }
}

function requireExactGitWarpVersion() {
  if (packageJson.version !== REQUIRED_GIT_WARP_VERSION) {
    throw new DependencyError(
      `Atomic capture requires git-warp ${REQUIRED_GIT_WARP_VERSION}; `
      + `received ${packageJson.version}`
    );
  }
}

function requireOptions(value) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ValidationError('GitWarpCaptureOccurrenceStore options are required');
  }
  requireNonEmptyString(value.repoDir, 'repoDir');
  requireNonEmptyString(value.laneName, 'laneName');
  requireNonEmptyString(value.writerId, 'writerId');
  if (typeof value.runtime?.close !== 'function' || typeof value.lane?.write !== 'function') {
    throw new ValidationError('Runtime and Lane handles are required');
  }
  return value;
}

function requireOpenOptions(value) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ValidationError('Atomic capture open options are required');
  }
  return Object.freeze({
    repoDir: requireNonEmptyString(value.repoDir, 'repoDir'),
    laneName: requireNonEmptyString(value.laneName, 'laneName'),
    writerId: requireNonEmptyString(value.writerId, 'writerId'),
  });
}

function requireAdmission(value) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ValidationError('Atomic capture admission is required');
  }
  if (!(value.capture instanceof CaptureAdmission)) {
    throw new ValidationError('capture must be a CaptureAdmission');
  }
  if (!(value.replay instanceof CaptureReplayProvenance)) {
    throw new ValidationError('replay must be CaptureReplayProvenance');
  }
  return value;
}

function createAdmissionReceipt(capture, receipt) {
  if (!['derived', 'plural'].includes(receipt.outcome.kind)) {
    const error = new ThinkError(
      `Atomic capture was ${receipt.outcome.kind}`,
      'CAPTURE_OCCURRENCE_NOT_ADMITTED'
    );
    error.receipt = receipt;
    throw error;
  }
  if (receipt.occurrence === undefined) {
    throw new ThinkError(
      'Atomic capture receipt omitted its entity occurrence',
      'CAPTURE_OCCURRENCE_MISSING'
    );
  }
  return new CaptureAdmissionReceipt({
    captureId: capture.captureId,
    captureIntentId: capture.captureIntentId,
    representationSubject: receipt.occurrence.subject,
    occurrence: receipt.occurrence.id,
    outcome: receipt.outcome.kind,
    evidenceBasis: receipt.evidence.basis.id,
  });
}

function requireCompleteOccurrence(capture, replay, subject) {
  if (!capture.exists || !replay.exists) {
    throw new ThinkError(
      `Atomic capture ${subject} has a partial initial envelope`,
      'CAPTURE_OCCURRENCE_PARTIAL'
    );
  }
}

function basisFromCoordinate(lane, coordinate) {
  return new CaptureBasis({
    lane,
    checkpointSha: coordinate.checkpointSha,
    frontier: coordinate.frontierEntries,
  });
}

function requireNonEmptyString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ValidationError(`${name} must be a non-empty string`);
  }
  return value;
}
