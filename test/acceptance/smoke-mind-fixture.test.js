import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import { createHermeticThinkEnv, repoRoot } from '../fixtures/runtime.js';
import { createTempDir } from '../fixtures/tmp.js';
import { assertSuccess } from '../support/assertions.js';

/**
 * A canonical Think mind, committed to the repository as a ~34KB tarball so every
 * clone — including CI — can read a real Git-backed mind without seeding one.
 *
 * It is in-repo rather than in git-cas on purpose: git-cas keeps its objects
 * under refs/cas/*, the default push refspec is refs/heads/*, so a fresh clone
 * cannot restore them (see CI-004). At this size no such transport is needed.
 *
 * It pins what a completed capture actually looks like end to end: exact stored
 * text, entry identity, and a populated derived layer. A deferred capture was
 * tried and dropped — that state is not reproducible, because the abandoned
 * followthrough usually completes before the tarball is written, so asserting it
 * would be asserting a race. The deferral defect itself is tracked in
 * docs/method/backlog/bad-code/CORE_deferred-capture-corrupts-the-recent-read-model.md.
 */

const FIXTURE_DIR = path.join(repoRoot, 'test', 'fixtures', 'minds');
const MANIFEST_PATH = path.join(FIXTURE_DIR, 'smoke-mind.json');
const CLI = path.join(repoRoot, 'bin', 'think.js');

async function readManifest() {
  return JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
}

async function extractFixture(manifest) {
  const parentDir = await createTempDir('think-smoke-mind-');
  const mindDir = path.join(parentDir, 'mind');
  const tarballPath = path.join(FIXTURE_DIR, manifest.tarball.name);

  const bytes = await readFile(tarballPath);
  assert.equal(bytes.byteLength, manifest.tarball.bytes, 'Fixture tarball size does not match its manifest.');
  assert.equal(
    createHash('sha256').update(bytes).digest('hex'),
    manifest.tarball.sha256,
    'Fixture tarball digest does not match its manifest; rebuild it with the documented command.'
  );

  await mkdir(mindDir, { recursive: true });
  const extract = spawnSync('tar', ['-xzf', tarballPath, '-C', mindDir], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  assertSuccess(extract, 'Expected tar to extract the canonical smoke mind.');

  return mindDir;
}

function inspect(mindDir, entryId) {
  const result = spawnSync(process.execPath, [CLI, `--inspect=${entryId}`, '--json'], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: createHermeticThinkEnv({ homeDir: mindDir, upstreamUrl: '', extraEnv: { THINK_REPO_DIR: mindDir } }),
  });
  assertSuccess(result, `Expected inspect to read ${entryId} from the restored fixture.`);

  for (const line of result.stdout.trim().split('\n')) {
    const event = JSON.parse(line);
    if (event.event === 'inspect.entry') {
      return event;
    }
  }
  throw new assert.AssertionError({ message: `No inspect.entry event for ${entryId}.` });
}

test('the canonical smoke mind extracts into a real Git-backed mind', async () => {
  const manifest = await readManifest();
  const mindDir = await extractFixture(manifest);

  assert.ok(existsSync(path.join(mindDir, '.git')), 'Expected the fixture to carry a Git repository.');

  const revList = spawnSync('git', ['-C', mindDir, 'rev-list', '--count', '--all'], {
    encoding: 'utf8',
  });
  assertSuccess(revList, 'Expected the restored fixture to be a readable Git repository.');
  assert.ok(
    Number.parseInt(revList.stdout.trim(), 10) > 0,
    'Expected the restored mind to carry real Git history.'
  );
});

test('every capture in the fixture is durable and readable', async () => {
  const manifest = await readManifest();
  const mindDir = await extractFixture(manifest);
  const { healthy, totalCaptureCount } = manifest.expected;

  assert.equal(healthy.length, totalCaptureCount, 'Manifest capture counts disagree.');

  for (const capture of healthy) {
    const entry = inspect(mindDir, capture.entryId);
    assert.equal(entry.text, capture.text, `Expected exact stored text for ${capture.entryId}.`);
    assert.equal(entry.entryId, capture.entryId);
    assert.equal(entry.kind, 'raw_capture');
  }
});

test('each capture carries its derived layer', async () => {
  const manifest = await readManifest();
  const mindDir = await extractFixture(manifest);
  for (const capture of manifest.expected.healthy) {
    const entry = inspect(mindDir, capture.entryId);

    assert.equal(
      entry.canonicalThought.stored,
      true,
      `Expected a completed followthrough to store the canonical thought for ${capture.entryId}.`
    );
    assert.notEqual(
      entry.sessionAttribution,
      null,
      `Expected a completed followthrough to attribute a session for ${capture.entryId}.`
    );
    assert.match(entry.sessionAttribution.sessionId, /^session:/u);
  }
});
