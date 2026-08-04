#!/usr/bin/env node

/**
 * Publish a canonical Think mind into git-cas and write its fixture manifest.
 *
 * The mind is a real archive with real history, tarred and stored as a CAS asset
 * so tests restore it by tree oid exactly as the pre-v17 Gemini fixture does.
 *
 * Why this mind is worth freezing: it contains a capture whose followthrough
 * budget expired. That state cannot be produced on demand — the abandoned
 * followthrough keeps running and how far it gets before the process exits varies
 * per run, so `recent`, `stats` and `remember` disagree about the capture from one
 * attempt to the next. Frozen as a fixture it becomes deterministic, which turns
 * an unreproducible defect into a regression target. The defect itself is tracked
 * in docs/method/backlog/bad-code/
 * CORE_deferred-capture-corrupts-the-recent-read-model.md.
 *
 * Usage: node ./scripts/build-smoke-mind-fixture.mjs --mind ~/.think/readme-smoke
 */

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ValidationError } from '../src/errors.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const gitCas = path.join(repoRoot, 'node_modules', '@git-stunts', 'git-cas', 'bin', 'git-cas.js');
const manifestPath = path.join(repoRoot, 'test', 'fixtures', 'cas', 'readme-smoke-mind.json');
const tarballName = 'think-readme-smoke-mind.tar.gz';
const slug = 'test-fixtures/readme-smoke-mind-v1';
const DEFERRED_NEEDLE = 'deferred on purpose';

function parseArgs(argv) {
  const index = argv.indexOf('--mind');
  if (index === -1 || index === argv.length - 1) {
    throw new ValidationError('Usage: build-smoke-mind-fixture.mjs --mind <path to a Think mind>');
  }
  return path.resolve(argv[index + 1].replace(/^~/u, process.env.HOME ?? '~'));
}

function run(command, args, { cwd = repoRoot, env = {} } = {}) {
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

function think(mindDir, args) {
  const { stdout } = run(process.execPath, [path.join(repoRoot, 'bin', 'think.js'), ...args, '--json'], {
    env: { THINK_REPO_DIR: mindDir, THINK_UPSTREAM_URL: '' },
  });
  return stdout;
}

function eventsOfKind(stdout, kind) {
  return stdout
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line))
    .filter((event) => event.event === kind);
}

function findGitObjectContaining(mindDir, needle) {
  const { stdout } = run('git', ['-C', mindDir, 'rev-list', '--objects', '--all']);
  for (const line of stdout.trim().split('\n')) {
    const [oid] = line.split(' ');
    const probe = spawnSync('git', ['-C', mindDir, 'cat-file', '-p', oid], { encoding: 'utf8' });
    if (probe.status === 0 && probe.stdout.includes(needle)) {
      return oid;
    }
  }
  return null;
}

function observeMind(mind) {
  const recent = eventsOfKind(think(mind, ['--recent']), 'recent.entry');
  const [stats] = eventsOfKind(think(mind, ['--stats']), 'stats.total');
  const commitCount = Number.parseInt(
    run('git', ['-C', mind, 'rev-list', '--count', '--all']).stdout.trim(),
    10
  );

  const deferredObject = findGitObjectContaining(mind, DEFERRED_NEEDLE);
  if (!deferredObject) {
    throw new ValidationError(`Mind does not contain the deferred capture text "${DEFERRED_NEEDLE}".`);
  }
  if (recent.some((entry) => entry.text.includes(DEFERRED_NEEDLE))) {
    throw new ValidationError('Deferred capture is visible in --recent; this mind no longer shows the split.');
  }

  return { recent, stats, commitCount, deferredObject };
}

function buildManifest({ mind, treeOid, bytes }) {
  const { recent, stats, commitCount, deferredObject } = observeMind(mind);

  return {
    description: 'Canonical Think mind archived from a real capture session, including a capture whose followthrough budget expired.',
    slug,
    treeOid,
    tarball: {
      name: tarballName,
      bytes: bytes.byteLength,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    },
    rebuild: 'node ./scripts/build-smoke-mind-fixture.mjs --mind <path to a Think mind>',
    expected: {
      commitCount,
      visibleEntryCount: recent.length,
      statsTotal: stats.total,
      visibleTexts: recent.map((entry) => entry.text),
      visibleEntryIds: recent.map((entry) => entry.entryId),
      deferred: {
        needle: DEFERRED_NEEDLE,
        gitObject: deferredObject,
        note: [
          'This capture is committed to Git but absent from recent and stats. Which',
          'surfaces can see a deferred capture is nondeterministic in live use, because',
          'the abandoned followthrough keeps running; freezing this mind makes one such',
          'state reproducible so a fix has a regression target.',
        ].join(' '),
      },
    },
  };
}

const sourceMind = parseArgs(process.argv.slice(2));
const workDir = mkdtempSync(path.join(tmpdir(), 'think-cas-fixture-'));
const stagedMind = path.join(workDir, 'mind');
const tarballPath = path.join(workDir, tarballName);

try {
  // Copy first so `git gc` never touches the operator's live mind.
  mkdirSync(stagedMind, { recursive: true });
  cpSync(sourceMind, stagedMind, { recursive: true });
  run('git', ['-C', stagedMind, 'gc', '-q', '--prune=now'], { cwd: workDir });
  run('tar', ['-czf', tarballPath, '-C', stagedMind, '.'], { cwd: workDir });

  const stored = JSON.parse(run(process.execPath, [
    gitCas, '--json', 'store', tarballPath,
    '--slug', slug, '--tree', '--gzip', '--force', '--cwd', repoRoot,
  ]).stdout);

  const manifest = buildManifest({
    mind: stagedMind,
    treeOid: stored.treeOid,
    bytes: readFileSync(tarballPath),
  });

  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  process.stdout.write(`Stored ${slug} as tree ${stored.treeOid} (${String(manifest.tarball.bytes)} bytes)\n`);
  process.stdout.write(`Wrote ${manifestPath}\n`);
  process.stdout.write('Push refs/cas/* so CI can restore this asset.\n');
} finally {
  rmSync(workDir, { recursive: true, force: true });
}
