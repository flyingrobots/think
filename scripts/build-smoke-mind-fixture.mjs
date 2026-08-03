#!/usr/bin/env node

/**
 * Rebuild the canonical smoke mind fixture.
 *
 * The fixture is a real Git-backed mind, tarred and committed to the repository
 * so every clone — including CI — can extract and read it without seeding one
 * first. It is deliberately in-repo rather than in git-cas: git-cas keeps its
 * objects under refs/cas/*, the default push refspec is refs/heads/*, so those
 * objects never reach the remote and a fresh clone cannot restore them. At ~36KB
 * this needs no such transport (~34KB).
 *
 * The fixture contains healthy captures only. A deferred capture was tried first,
 * to pin the state where followthrough runs out of budget, but that state is not
 * reproducible: the abandoned followthrough keeps running and usually completes
 * before the tarball is written, so `canonicalThought.stored` flips back to true.
 * Shipping an assertion on it would be shipping a race. See
 * docs/method/backlog/bad-code/CORE_deferred-capture-corrupts-the-recent-read-model.md.
 *
 * Usage: node ./scripts/build-smoke-mind-fixture.mjs
 */

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ValidationError } from '../src/errors.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixtureDir = path.join(repoRoot, 'test', 'fixtures', 'minds');
const tarballName = 'smoke-mind.tar.gz';
const manifestPath = path.join(fixtureDir, 'smoke-mind.json');
const tarballPath = path.join(fixtureDir, tarballName);

const GENEROUS_BUDGET_MS = '120000';

const HEALTHY_THOUGHTS = Object.freeze([
  'Warp worldlines keep browse startup fast because reads stay bounded.',
  'Capture is a trapdoor: raw text in, immutable entry out, no retrieval first.',
  'Turkey is good in burritos.',
]);

function run(command, args, { cwd, env = {} } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });

  if (result.status !== 0) {
    throw new ValidationError(`${command} ${args.join(' ')} failed:\n${result.stdout}\n${result.stderr}`);
  }
  return result;
}

function capture(mind, text, budgetMs) {
  return run(process.execPath, [path.join(repoRoot, 'bin', 'think.js'), text, '--json'], {
    cwd: repoRoot,
    env: {
      THINK_REPO_DIR: mind,
      THINK_CAPTURE_FOLLOWTHROUGH_TIMEOUT_MS: budgetMs,
      THINK_UPSTREAM_URL: '',
    },
  }).stdout;
}

function entryIdFrom(stdout) {
  for (const line of stdout.trim().split('\n')) {
    const { event, entryId } = JSON.parse(line);
    if (event === 'capture.status') {
      return entryId;
    }
  }
  throw new ValidationError('No capture.status event found in capture output.');
}

function inspectEntry(mind, entryId) {
  const { stdout } = run(process.execPath, [
    path.join(repoRoot, 'bin', 'think.js'),
    `--inspect=${entryId}`,
    '--json',
  ], {
    cwd: repoRoot,
    env: { THINK_REPO_DIR: mind, THINK_UPSTREAM_URL: '' },
  });

  for (const line of stdout.trim().split('\n')) {
    const event = JSON.parse(line);
    if (event.event === 'inspect.entry') {
      return event;
    }
  }
  throw new ValidationError(`No inspect.entry event for ${entryId}.`);
}

const workDir = mkdtempSync(path.join(tmpdir(), 'think-smoke-fixture-'));
const mindDir = path.join(workDir, 'mind');

try {
  mkdirSync(mindDir, { recursive: true });
  run('git', ['init', '-q'], { cwd: mindDir });

  const healthy = HEALTHY_THOUGHTS.map((text) => ({
    text,
    entryId: entryIdFrom(capture(mindDir, text, GENEROUS_BUDGET_MS)),
  }));
  for (const { entryId, text } of healthy) {
    const entry = inspectEntry(mindDir, entryId);
    if (entry.canonicalThought.stored !== true || entry.sessionAttribution === null) {
      throw new ValidationError(`Healthy capture is missing derived artifacts, so its followthrough did not complete: ${text}`);
    }
  }

  run('git', ['gc', '-q', '--prune=now'], { cwd: mindDir });
  mkdirSync(fixtureDir, { recursive: true });
  run('tar', ['-czf', tarballPath, '-C', mindDir, '.']);

  const bytes = readFileSync(tarballPath);
  const manifest = {
    description: 'Canonical Think mind containing three healthy captures with their derived layer intact.',
    tarball: {
      name: tarballName,
      bytes: bytes.byteLength,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    },
    rebuild: 'node ./scripts/build-smoke-mind-fixture.mjs',
    expected: {
      totalCaptureCount: healthy.length,
      healthy,
      note: [
        'Every capture is durable and readable through inspect, with its derived layer',
        'present: canonicalThought.stored is true and sessionAttribution is populated.',
        'A deferred capture was deliberately left out because that state is not',
        'reproducible - the abandoned followthrough usually completes before the',
        'tarball is written.',
      ].join(' '),
    },
  };

  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  process.stdout.write(`Wrote ${tarballPath} (${String(bytes.byteLength)} bytes)\n`);
  process.stdout.write(`Wrote ${manifestPath}\n`);
} finally {
  rmSync(workDir, { recursive: true, force: true });
}
