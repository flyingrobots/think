import { existsSync } from 'node:fs';

import { hasGitRepo } from './git.js';

/**
 * Core diagnostic logic for think --doctor.
 * Pure, testable — no CLI or MCP dependencies.
 *
 * Optional async callbacks (getGraphModelStatus, getEntryCount) allow
 * callers to supply real store access while keeping tests fast.
 */
export async function runDiagnostics(options = {}) {
  const context = createDiagnosticContext(options);
  const checks = await collectChecks(context);

  if (options.fix === true) {
    return await runDiagnosticsFixPass(context, checks, options);
  }

  return { checks, fixes: [] };
}

function createDiagnosticContext(options) {
  const { repoDir } = options;
  return {
    thinkDir: options.thinkDir,
    repoDir,
    upstreamUrl: defaultString(options.upstreamUrl),
    repoOk: isRepoOk(repoDir),
    getGraphModelStatus: optionalCallback(options.getGraphModelStatus),
    getEntryCount: optionalCallback(options.getEntryCount),
    getFsmonitorStatus: optionalCallback(options.getFsmonitorStatus),
    getCheckpointStatus: optionalCallback(options.getCheckpointStatus),
    checkUpstreamReachable: optionalCallback(options.checkUpstreamReachable),
  };
}

function defaultString(value) {
  return value ?? '';
}

function optionalCallback(value) {
  return value ?? null;
}

function isRepoOk(repoDir) {
  return Boolean(repoDir && existsSync(repoDir) && hasGitRepo(repoDir));
}

async function runDiagnosticsFixPass(context, checks, fixers) {
  const fixes = await runFixes({
    checks,
    repoDir: context.repoDir,
    ...fixers,
  });

  if (fixes.some((candidate) => candidate.status === 'ok')) {
    return { checks: await collectChecks(context), fixes };
  }

  return { checks, fixes };
}

async function collectChecks({
  thinkDir,
  repoDir,
  upstreamUrl,
  repoOk,
  getGraphModelStatus,
  getEntryCount,
  getFsmonitorStatus,
  getCheckpointStatus,
  checkUpstreamReachable,
}) {
  const checks = [];
  checks.push(checkThinkDir(thinkDir));
  checks.push(checkLocalRepo(repoDir));
  checks.push(await checkCheckpoint(repoOk, repoDir, getCheckpointStatus));
  checks.push(await checkGitFsmonitor(repoOk, repoDir, getFsmonitorStatus));
  checks.push(await checkGraphModel(repoOk, getGraphModelStatus));
  checks.push(await checkEntryCount(repoOk, getEntryCount));
  checks.push(await checkUpstream(upstreamUrl, checkUpstreamReachable));

  return checks;
}

async function runFixes({ checks, repoDir, fixFsmonitor, fixCheckpoint }) {
  return [
    ...await runSingleFix(checks, {
      name: 'checkpoint',
      fixer: fixCheckpoint,
      skipMessage: 'Checkpoint cache fix skipped (no fixer available)',
      okMessage: `Deleted unsupported checkpoint cache for local repo (${repoDir})`,
      failMessage: `Failed to delete unsupported checkpoint cache for local repo (${repoDir})`,
    }),
    ...await runSingleFix(checks, {
      name: 'git_fsmonitor',
      fixer: fixFsmonitor,
      skipMessage: 'Git fsmonitor fix skipped (no fixer available)',
      okMessage: `Disabled Git fsmonitor for local repo (${repoDir})`,
      failMessage: `Failed to disable Git fsmonitor for local repo (${repoDir})`,
    }),
  ];
}

async function runSingleFix(checks, { name, fixer, skipMessage, okMessage, failMessage }) {
  const check = checks.find((candidate) => candidate.name === name);
  if (check?.status !== 'fail') {
    return [];
  }

  if (fixer) {
    return await attemptFix(name, fixer, okMessage, failMessage);
  }

  return [{ name, status: 'skip', message: skipMessage }];
}

async function attemptFix(name, fixer, okMessage, failMessage) {
  try {
    await fixer();
    return [{ name, status: 'ok', message: okMessage }];
  } catch {
    return [{ name, status: 'fail', message: failMessage }];
  }
}

async function checkCheckpoint(repoOk, repoDir, getCheckpointStatus) {
  if (!repoOk) {
    return { name: 'checkpoint', status: 'skip', message: 'Checkpoint cache check skipped (no repo)' };
  }
  if (!getCheckpointStatus) {
    return { name: 'checkpoint', status: 'skip', message: 'Checkpoint cache check skipped (no checker)' };
  }

  try {
    return describeCheckpointStatus(await getCheckpointStatus(), repoDir);
  } catch {
    return { name: 'checkpoint', status: 'warn', message: 'Checkpoint cache check failed' };
  }
}

function describeCheckpointStatus(status, repoDir) {
  if (status.exists === false) {
    return {
      name: 'checkpoint',
      status: 'warn',
      message: 'No checkpoint cache found; reads may be slower until a checkpoint is regenerated',
    };
  }

  if (status.supported) {
    return { name: 'checkpoint', status: 'ok', message: `Checkpoint cache is supported (schema ${status.schema})` };
  }

  return {
    name: 'checkpoint',
    status: 'fail',
    message: `Checkpoint cache schema ${status.schema ?? 'unknown'} is unsupported by this runtime (expected schema ${status.supportedSchema}). Run: git -C ${repoDir} update-ref -d ${status.ref}`,
  };
}

function checkThinkDir(thinkDir) {
  if (!thinkDir || !existsSync(thinkDir)) {
    return { name: 'think_dir', status: 'fail', message: `Think directory not found (${thinkDir ?? '?'})` };
  }
  return { name: 'think_dir', status: 'ok', message: `Think directory exists (${thinkDir})` };
}

function checkLocalRepo(repoDir) {
  if (!repoDir || !existsSync(repoDir)) {
    return { name: 'local_repo', status: 'fail', message: `Local repo not found (${repoDir ?? '?'})` };
  }
  if (!hasGitRepo(repoDir)) {
    return { name: 'local_repo', status: 'fail', message: `Local repo is not a git repo (${repoDir})` };
  }
  return { name: 'local_repo', status: 'ok', message: 'Local repo is a valid git repo' };
}

async function checkGitFsmonitor(repoOk, repoDir, getFsmonitorStatus) {
  if (!repoOk) {
    return { name: 'git_fsmonitor', status: 'skip', message: 'Git fsmonitor check skipped (no repo)' };
  }
  if (!getFsmonitorStatus) {
    return { name: 'git_fsmonitor', status: 'skip', message: 'Git fsmonitor check skipped (no checker)' };
  }

  try {
    const status = await getFsmonitorStatus();
    const effective = normalizeGitConfigValue(status.effectiveValue);
    const local = normalizeGitConfigValue(status.localValue);
    const globalValue = normalizeGitConfigValue(status.globalValue);

    if (!gitConfigEnablesFsmonitor(effective)) {
      if (gitConfigEnablesFsmonitor(globalValue) && gitConfigExplicitlyDisablesFsmonitor(local)) {
        return {
          name: 'git_fsmonitor',
          status: 'ok',
          message: 'Git fsmonitor is disabled locally; global fsmonitor is overridden for this repo',
        };
      }

      if (effective === null) {
        return { name: 'git_fsmonitor', status: 'ok', message: 'Git fsmonitor is not configured for this repo' };
      }

      return { name: 'git_fsmonitor', status: 'ok', message: 'Git fsmonitor is disabled for this repo' };
    }

    return {
      name: 'git_fsmonitor',
      status: 'fail',
      message: `Git fsmonitor is enabled for this repo (${describeFsmonitorSource(status)}). Run: git -C ${repoDir} config core.fsmonitor false`,
    };
  } catch {
    return { name: 'git_fsmonitor', status: 'warn', message: 'Git fsmonitor check failed' };
  }
}

async function checkGraphModel(repoOk, getGraphModelStatus) {
  if (!repoOk) {
    return { name: 'graph_model', status: 'skip', message: 'History model check skipped (no repo)' };
  }
  if (!getGraphModelStatus) {
    return { name: 'graph_model', status: 'skip', message: 'History model check skipped (no fast checker)' };
  }

  try {
    const status = await getGraphModelStatus();
    if (status.migrationRequired) {
      return {
        name: 'graph_model',
        status: 'warn',
        message: `History model needs migration (v${status.currentGraphModelVersion} → v${status.requiredGraphModelVersion})`,
      };
    }
    return {
      name: 'graph_model',
      status: 'ok',
      message: `History model is current (v${status.currentGraphModelVersion})`,
    };
  } catch {
    return { name: 'graph_model', status: 'fail', message: 'History model check failed' };
  }
}

async function checkEntryCount(repoOk, getEntryCount) {
  if (!repoOk) {
    return { name: 'entry_count', status: 'skip', message: 'Entry count check skipped (no repo)' };
  }
  if (!getEntryCount) {
    return { name: 'entry_count', status: 'skip', message: 'Entry count check skipped (no fast checker)' };
  }

  try {
    const total = await getEntryCount();
    if (total === 0) {
      return { name: 'entry_count', status: 'warn', message: 'No thoughts captured yet' };
    }
    return { name: 'entry_count', status: 'ok', message: `${total} thoughts captured` };
  } catch {
    return { name: 'entry_count', status: 'fail', message: 'Entry count check failed' };
  }
}

function describeFsmonitorSource(status) {
  const value = String(status.effectiveValue ?? 'unknown');
  const source = status.effectiveSource ? ` from ${status.effectiveSource}` : '';
  return `core.fsmonitor=${value}${source}`;
}

function normalizeGitConfigValue(value) {
  if (value === null || value === undefined) {
    return null;
  }
  return String(value).trim().toLowerCase();
}

function gitConfigDisablesFsmonitor(value) {
  return value === null || value === '' || value === 'false' || value === '0' || value === 'no' || value === 'off';
}

function gitConfigExplicitlyDisablesFsmonitor(value) {
  return value !== null && gitConfigDisablesFsmonitor(value);
}

function gitConfigEnablesFsmonitor(value) {
  return !gitConfigDisablesFsmonitor(value);
}

async function checkUpstream(upstreamUrl, checkUpstreamReachable) {
  if (!upstreamUrl) {
    return { name: 'upstream', status: 'skip', message: 'Upstream not configured' };
  }

  if (!checkUpstreamReachable) {
    return { name: 'upstream', status: 'skip', message: `Upstream configured but not verified (${upstreamUrl})` };
  }

  try {
    const reachable = await checkUpstreamReachable(upstreamUrl);
    if (reachable) {
      return { name: 'upstream', status: 'ok', message: `Upstream reachable (${upstreamUrl})` };
    }
    return { name: 'upstream', status: 'warn', message: `Upstream unreachable (${upstreamUrl})` };
  } catch {
    return { name: 'upstream', status: 'warn', message: `Upstream check failed (${upstreamUrl})` };
  }
}
