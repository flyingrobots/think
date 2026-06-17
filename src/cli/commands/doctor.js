import { runDiagnostics } from '../../doctor.js';
import { getFsmonitorStatus, hasGitRepo, lsRemote, setFsmonitorDisabled } from '../../git.js';
import { getLocalRepoDir, getThinkDir } from '../../paths.js';
import { deleteCheckpointRef, getCheckpointRefStatus } from '../../store/checkpoint-state.js';

const DOCTOR_SYMBOLS = { ok: '✓', warn: '!', fail: '✗', skip: '○' };

export async function runDoctor(output, reporter, options = {}) {
  const context = createDoctorContext();
  reporter.event('doctor.start', { fix: Boolean(options.fix) });

  const result = await runDiagnostics(createDiagnosticsOptions(context, options));
  renderDoctorResult(output, result, options);

  reporter.event('doctor.done', { fix: Boolean(options.fix), fixes: result.fixes.length });
  return 0;
}

function createDoctorContext() {
  const repoDir = getLocalRepoDir();
  return {
    thinkDir: getThinkDir(),
    repoDir,
    repoPresent: hasGitRepo(repoDir),
    upstreamUrl: (process.env.THINK_UPSTREAM_URL || '').trim(),
  };
}

function createDiagnosticsOptions(context, options) {
  return {
    thinkDir: context.thinkDir,
    repoDir: context.repoDir,
    upstreamUrl: context.upstreamUrl,
    fix: Boolean(options.fix),
    ...createRepoDiagnostics(context),
    checkUpstreamReachable: context.upstreamUrl ? () => lsRemote(context.upstreamUrl) : null,
  };
}

function createRepoDiagnostics(context) {
  if (context.repoPresent) {
    return createPresentRepoDiagnostics(context);
  }
  return {
    getGraphModelStatus: null,
    getEntryCount: null,
    getFsmonitorStatus: null,
    fixFsmonitor: null,
    getCheckpointStatus: null,
    fixCheckpoint: null,
  };
}

function createPresentRepoDiagnostics(context) {
  return {
    getGraphModelStatus: null,
    getEntryCount: null,
    getFsmonitorStatus: () => getFsmonitorStatus(context.repoDir),
    fixFsmonitor: () => setFsmonitorDisabled(context.repoDir),
    getCheckpointStatus: () => getCheckpointRefStatus(context.repoDir),
    fixCheckpoint: () => deleteCheckpointRef(context.repoDir),
  };
}

function renderDoctorResult(output, result, options) {
  if (output.json) {
    output.data('doctor.result', { checks: result.checks, fixes: result.fixes });
    return;
  }

  output.out('think doctor');
  renderRows(output, result.checks);
  renderFixes(output, result.fixes, options);
}

function renderRows(output, rows) {
  for (const row of rows) {
    const symbol = DOCTOR_SYMBOLS[row.status] ?? '?';
    output.out(`  ${symbol} ${row.message}`);
  }
}

function renderFixes(output, fixes, options) {
  if (!options.fix) {
    return;
  }

  output.out('fixes');
  if (fixes.length === 0) {
    output.out('  ○ No automatic fixes were applied');
    return;
  }
  renderRows(output, fixes);
}
