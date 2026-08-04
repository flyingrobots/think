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
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixtureDir = path.join(repoRoot, 'test', 'fixtures', 'cas');
const REFSPEC = '+refs/cas/*:refs/cas/*';

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
      if (treeOid) {
        oids.push({ name, treeOid });
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
});

if (fetched.status !== 0) {
  // git's first stderr line carries the actual cause; later lines are advice that
  // reads as nonsense when quoted out of context.
  const [reason = 'unknown error'] = (fetched.stderr || fetched.error?.message || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  process.stderr.write(
    `cas-fixtures: could not fetch ${REFSPEC} (${reason}). `
    + `${String(missing.length)} fixture(s) will skip.\n`
  );
  process.exit(0);
}

const stillMissing = missing.filter(({ treeOid }) => !isPresent(treeOid));
if (stillMissing.length > 0) {
  process.stderr.write(
    `cas-fixtures: fetched ${REFSPEC} but ${stillMissing.map(({ name }) => name).join(', ')} `
    + 'remain unresolved; those fixtures will skip.\n'
  );
  process.exit(0);
}

process.stdout.write(`cas-fixtures: fetched ${String(missing.length)} fixture asset(s) from refs/cas/*\n`);
