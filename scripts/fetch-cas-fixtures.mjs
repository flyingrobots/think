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
 * - A failed fetch is never fatal. No remote, no network, or no permission simply
 *   leaves the fixtures absent, and the tests that need them skip with a reason.
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

const fetched = spawnSync('git', ['fetch', '--no-tags', '--quiet', 'origin', REFSPEC], {
  cwd: repoRoot,
  encoding: 'utf8',
  // This runs in front of every acceptance suite, so it must never sit waiting.
  // A credential prompt would otherwise hang `npm test` indefinitely.
  timeout: FETCH_TIMEOUT_MS,
  env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_ASKPASS: '', SSH_ASKPASS: '' },
});

if (fetched.status !== 0) {
  reportAndExit(
    `cas-fixtures: could not fetch ${REFSPEC} (${describeFetchFailure(fetched)}). `
    + `${String(missing.length)} fixture(s) will skip.\n`
  );
}

const stillMissing = missing.filter(({ treeOid }) => !isPresent(treeOid));
if (stillMissing.length > 0) {
  reportAndExit(
    `cas-fixtures: fetched ${REFSPEC} but ${stillMissing.map(({ name }) => name).join(', ')} `
    + 'remain unresolved; those fixtures will skip.\n'
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
 * Write a diagnostic and exit successfully. writeSync avoids the truncation an
 * immediate process.exit can cause on a piped, asynchronous stderr.
 */
function reportAndExit(message) {
  writeSync(process.stderr.fd, message);
  process.exit(0);
}

process.stdout.write(`cas-fixtures: fetched ${String(missing.length)} fixture asset(s) from refs/cas/*\n`);
