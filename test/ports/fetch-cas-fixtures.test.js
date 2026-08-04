import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { repoRoot } from '../fixtures/runtime.js';
import { createTempDir } from '../fixtures/tmp.js';

/**
 * `scripts/fetch-cas-fixtures.mjs` runs in front of every acceptance suite, so
 * how it reacts to a failed fetch decides whether CAS-backed coverage can vanish
 * without anyone noticing.
 *
 * The distinction it has to draw is between two very different situations that
 * both end with the fixture absent:
 *
 * - the remote genuinely publishes no `refs/cas/*`, or cannot be reached at all
 *   (an offline local run) — a legitimate skip, and the suite must still run;
 * - the remote does publish `refs/cas/*` and the fixture is still unresolved
 *   afterwards — a real regression in transport, permission or refspec, which
 *   must fail loudly rather than quietly deleting coverage from CI.
 *
 * The script derives its repository root from its own location, so each case
 * copies it into a throwaway repository and runs it there.
 */

const SCRIPT_SOURCE = path.join(repoRoot, 'scripts', 'fetch-cas-fixtures.mjs');
const ABSENT_OID = '0123456789abcdef0123456789abcdef01234567';

function git(cwd, args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(
    result.status,
    0,
    `git ${args.join(' ')} failed in ${cwd}: ${result.stderr}`
  );
  return result.stdout.trim();
}

async function createOriginRepo({ publishesCasRefs }) {
  const dir = await createTempDir('cas-origin-');
  git(dir, ['init', '-q', '--bare']);

  if (publishesCasRefs) {
    const seed = await createTempDir('cas-seed-');
    git(seed, ['init', '-q']);
    git(seed, ['-c', 'user.email=t@t.invalid', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'seed']);
    const head = git(seed, ['rev-parse', 'HEAD']);
    git(seed, ['push', '-q', dir, `${head}:refs/cas/seed`]);
  }

  return dir;
}

/** A throwaway repo holding the script and one manifest naming an absent tree. */
async function createConsumerRepo({ originDir }) {
  const dir = await createTempDir('cas-consumer-');
  git(dir, ['init', '-q']);
  mkdirSync(path.join(dir, 'scripts'), { recursive: true });
  copyFileSync(SCRIPT_SOURCE, path.join(dir, 'scripts', 'fetch-cas-fixtures.mjs'));

  const fixtureDir = path.join(dir, 'test', 'fixtures', 'cas');
  mkdirSync(fixtureDir, { recursive: true });
  writeFileSync(
    path.join(fixtureDir, 'absent-fixture.json'),
    `${JSON.stringify({ treeOid: ABSENT_OID }, null, 2)}\n`
  );

  if (originDir) {
    git(dir, ['remote', 'add', 'origin', originDir]);
  }

  return dir;
}

function runScript(cwd) {
  return spawnSync(process.execPath, [path.join(cwd, 'scripts', 'fetch-cas-fixtures.mjs')], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  });
}

test('a remote publishing no refs/cas/* is a legitimate skip', async () => {
  const originDir = await createOriginRepo({ publishesCasRefs: false });
  const consumer = await createConsumerRepo({ originDir });

  const result = runScript(consumer);

  assert.equal(result.status, 0, `Expected a clean skip, got: ${result.stderr}`);
  assert.match(
    result.stderr,
    /no refs\/cas\/\*|will skip/u,
    'Expected the skip to say why the fixture is unavailable.'
  );
});

test('an unreachable remote is a legitimate skip so offline runs still work', async () => {
  const consumer = await createConsumerRepo({ originDir: null });

  const result = runScript(consumer);

  assert.equal(result.status, 0, `Expected an offline run to survive, got: ${result.stderr}`);
});

test('a remote that publishes refs/cas/* but leaves the fixture unresolved fails loudly', async () => {
  const originDir = await createOriginRepo({ publishesCasRefs: true });
  const consumer = await createConsumerRepo({ originDir });

  const result = runScript(consumer);

  assert.notEqual(
    result.status,
    0,
    'A reachable remote that publishes refs/cas/* and still leaves the fixture '
    + 'missing is a real regression; exiting 0 deletes CAS coverage from CI silently.'
  );
  assert.match(
    result.stderr,
    new RegExp(ABSENT_OID.slice(0, 8), 'u'),
    'Expected the failure to name the unresolved fixture.'
  );
});

test('present fixtures short-circuit before any network call', async () => {
  const consumer = await createConsumerRepo({ originDir: null });

  // Point the manifest at a tree this repository certainly has: its own root
  // tree. There is no remote at all, so reaching the network would fail — the
  // clean exit is only possible if the present-fixture check short-circuits.
  git(consumer, ['-c', 'user.email=t@t.invalid', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'seed']);
  const treeOid = git(consumer, ['rev-parse', 'HEAD^{tree}']);
  writeFileSync(
    path.join(consumer, 'test', 'fixtures', 'cas', 'absent-fixture.json'),
    `${JSON.stringify({ treeOid }, null, 2)}\n`
  );

  const result = runScript(consumer);

  assert.equal(result.status, 0, `Expected a present fixture to succeed, got: ${result.stderr}`);
  assert.equal(result.stderr.trim(), '', 'A present fixture should need no diagnostic at all.');
});
