#!/usr/bin/env node

/**
 * Make git-cas fixture assets available before the acceptance suite runs.
 *
 * git-cas keeps its objects under `refs/cas/*`. Neither a normal clone nor
 * `actions/checkout` fetches that namespace, so CAS-backed fixtures are missing
 * until it is fetched explicitly. Wiring it here rather than into the CI workflow
 * keeps one copy of the knowledge, so a local `npm test` and a CI run behave the
 * same way.
 *
 * Two rules make this safe to sit in front of every acceptance run:
 *
 * - If every manifest's tree is already present, do nothing. The common local
 *   case makes no network call at all, so the suite still runs offline.
 * - Absence and failure are not the same thing. A remote that cannot be reached,
 *   or that publishes no `refs/cas/*` at all, leaves the fixtures absent and the
 *   tests that need them skip with a reason — that is the offline local run. But
 *   once the remote is known to publish `refs/cas/*`, a fixture that stays
 *   unresolved is a transport, permission or refspec regression, and exiting 0
 *   there would delete CAS coverage from CI without anyone noticing. That case
 *   fails loudly.
 */

import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, writeSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixtureDir = path.join(repoRoot, 'test', 'fixtures', 'cas');
const REFSPEC = '+refs/cas/*:refs/cas/*';
const FETCH_TIMEOUT_MS = 60_000;

function readManifestTreeOids() {
  let names;
  try {
    names = readdirSync(fixtureDir).filter((name) => name.endsWith('.json'));
  } catch {
    return [];
  }

  const oids = [];
  for (const name of names) {
    try {
      const { treeOid } = JSON.parse(readFileSync(path.join(fixtureDir, name), 'utf8'));
      // Only a non-empty string may reach spawnSync; a manifest carrying a number
      // or an object would otherwise escape this parse guard and land in argv.
      if (typeof treeOid === 'string' && treeOid.trim() !== '') {
        oids.push({ name, treeOid: treeOid.trim() });
      }
    } catch {
      // A manifest we cannot read is a problem for the test that owns it, not here.
    }
  }
  return oids;
}

function isPresent(treeOid) {
  const probe = spawnSync('git', ['cat-file', '-t', treeOid], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  return probe.status === 0 && probe.stdout.trim() === 'tree';
}

const manifests = readManifestTreeOids();
if (manifests.length === 0) {
  process.exit(0);
}

const missing = manifests.filter(({ treeOid }) => !isPresent(treeOid));
if (missing.length === 0) {
  process.exit(0);
}

const remote = probeRemoteCasRefs();

if (!remote.reachable) {
  reportAndExit(
    `cas-fixtures: cannot reach origin (${remote.reason}); `
    + `${String(missing.length)} fixture(s) will skip.\n`,
    0
  );
}

if (!remote.publishesCasRefs) {
  reportAndExit(
    `cas-fixtures: origin publishes no refs/cas/*; `
    + `${String(missing.length)} fixture(s) will skip.\n`,
    0
  );
}

const fetched = runGitWithoutPrompting(['fetch', '--no-tags', '--quiet', 'origin', REFSPEC]);

// Past this point the remote is known to publish refs/cas/*, so an absent
// fixture is a failure rather than a fact about the environment.
if (fetched.status !== 0) {
  reportAndExit(
    `cas-fixtures: origin publishes refs/cas/* but fetching ${REFSPEC} failed `
    + `(${describeFetchFailure(fetched)}).\n`,
    1
  );
}

const stillMissing = missing.filter(({ treeOid }) => !isPresent(treeOid));
if (stillMissing.length > 0) {
  const described = stillMissing.map(({ name, treeOid }) => `${name} (${treeOid})`).join(', ');
  reportAndExit(
    `cas-fixtures: fetched ${REFSPEC} from a remote that publishes it, but `
    + `${described} remain unresolved.\n`,
    1
  );
}

/**
 * git's first stderr line carries the cause; later lines are advice that reads as
 * nonsense quoted out of context. stderr and the spawn error are considered
 * independently, because a whitespace-only stderr is truthy and previously
 * suppressed a perfectly good error message in favour of "unknown error".
 */
function describeFetchFailure(result) {
  const firstLine = (text) => String(text ?? '')
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean);

  return firstLine(result.stderr) ?? firstLine(result.error?.message) ?? 'unknown error';
}

/**
 * Run git with every interactive prompt disabled and a hard time limit, so this
 * can never sit in front of the acceptance suite waiting for a credential.
 */
function runGitWithoutPrompting(args) {
  return spawnSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: FETCH_TIMEOUT_MS,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_ASKPASS: '', SSH_ASKPASS: '' },
  });
}

/**
 * Ask the remote what it publishes before deciding whether a missing fixture is
 * a fact or a fault. Unreachable and empty are reported separately because only
 * the first is compatible with an offline local run.
 */
function probeRemoteCasRefs() {
  const listed = runGitWithoutPrompting(['ls-remote', '--refs', 'origin', 'refs/cas/*']);

  if (listed.status !== 0) {
    return { reachable: false, publishesCasRefs: false, reason: describeFetchFailure(listed) };
  }

  return {
    reachable: true,
    publishesCasRefs: String(listed.stdout ?? '').trim() !== '',
    reason: null,
  };
}

/**
 * Write a diagnostic and exit with the given code. writeSync avoids the
 * truncation an immediate process.exit can cause on a piped, asynchronous
 * stderr.
 */
function reportAndExit(message, code) {
  writeSync(process.stderr.fd, message);
  process.exit(code);
}

process.stdout.write(`cas-fixtures: fetched ${String(missing.length)} fixture asset(s) from refs/cas/*\n`);
