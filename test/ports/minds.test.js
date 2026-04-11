import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { execSync } from 'node:child_process';
import { createTempDir } from '../fixtures/tmp.js';
import { discoverMinds, shaderForMind } from '../../src/minds.js';

// ---------------------------------------------------------------------------
// Mind discovery
// ---------------------------------------------------------------------------

test('discoverMinds finds all valid repos under the think directory', async () => {
  const thinkDir = await createTempDir('think-minds-');

  // Create three minds with git repos
  for (const name of ['alpha', 'beta', 'gamma']) {
    const mindDir = path.join(thinkDir, name);
    mkdirSync(mindDir, { recursive: true });
    execSync('git init', { cwd: mindDir, stdio: 'ignore' });
  }

  const minds = discoverMinds(thinkDir);

  assert.equal(minds.length, 3, 'Expected three minds discovered.');
  const names = minds.map((m) => m.name);
  assert.ok(names.includes('alpha'), 'Expected alpha mind.');
  assert.ok(names.includes('beta'), 'Expected beta mind.');
  assert.ok(names.includes('gamma'), 'Expected gamma mind.');
});

test('discoverMinds ignores directories without git repos', async () => {
  const thinkDir = await createTempDir('think-minds-');

  // Valid mind
  const validDir = path.join(thinkDir, 'valid');
  mkdirSync(validDir, { recursive: true });
  execSync('git init', { cwd: validDir, stdio: 'ignore' });

  // Not a mind — just a plain directory (like metrics/)
  mkdirSync(path.join(thinkDir, 'metrics'), { recursive: true });

  // Not a mind — a file, not a directory
  const { writeFileSync } = await import('node:fs');
  writeFileSync(path.join(thinkDir, 'config.json'), '{}');

  const minds = discoverMinds(thinkDir);

  assert.equal(minds.length, 1, 'Expected only the valid mind.');
  assert.equal(minds[0].name, 'valid');
});

test('discoverMinds labels ~/.think/repo as "default"', async () => {
  const thinkDir = await createTempDir('think-minds-');

  const repoDir = path.join(thinkDir, 'repo');
  mkdirSync(repoDir, { recursive: true });
  execSync('git init', { cwd: repoDir, stdio: 'ignore' });

  const minds = discoverMinds(thinkDir);

  assert.equal(minds.length, 1);
  assert.equal(minds[0].name, 'default', 'Expected "repo" directory to display as "default".');
  assert.equal(minds[0].isDefault, true);
});

test('discoverMinds sorts with default first, then alphabetical', async () => {
  const thinkDir = await createTempDir('think-minds-');

  for (const name of ['work', 'repo', 'claude']) {
    const mindDir = path.join(thinkDir, name);
    mkdirSync(mindDir, { recursive: true });
    execSync('git init', { cwd: mindDir, stdio: 'ignore' });
  }

  const minds = discoverMinds(thinkDir);
  const names = minds.map((m) => m.name);

  assert.deepEqual(
    names,
    ['default', 'claude', 'work'],
    'Expected default first, then alphabetical.'
  );
});

test('discoverMinds returns empty array when think directory does not exist', () => {
  const minds = discoverMinds(`/tmp/nonexistent-think-dir-${Date.now()}`);
  assert.deepEqual(minds, [], 'Expected empty array for missing directory.');
});

test('discoverMinds includes repoDir for each mind', async () => {
  const thinkDir = await createTempDir('think-minds-');

  const claudeDir = path.join(thinkDir, 'claude');
  mkdirSync(claudeDir, { recursive: true });
  execSync('git init', { cwd: claudeDir, stdio: 'ignore' });

  const minds = discoverMinds(thinkDir);

  assert.equal(minds[0].repoDir, claudeDir, 'Expected repoDir to point to the mind directory.');
});

// ---------------------------------------------------------------------------
// Shader assignment
// ---------------------------------------------------------------------------

test('shaderForMind returns a deterministic index for a given name', () => {
  const a = shaderForMind('claude', 5);
  const b = shaderForMind('claude', 5);

  assert.equal(a, b, 'Expected same name to produce same shader index.');
});

test('shaderForMind returns different indices for different names', () => {
  const indices = new Set();
  for (const name of ['default', 'claude', 'work', 'personal', 'research']) {
    indices.add(shaderForMind(name, 5));
  }

  assert.ok(
    indices.size >= 2,
    'Expected at least 2 distinct shader indices across 5 different mind names.'
  );
});

test('shaderForMind stays within the shader count range', () => {
  for (const name of ['default', 'claude', 'work', 'x', 'a-very-long-mind-name']) {
    const index = shaderForMind(name, 5);
    assert.ok(index >= 0 && index < 5, `Expected index in [0,5) but got ${index} for "${name}".`);
  }
});

test('shaderForMind handles single-character names', () => {
  const index = shaderForMind('x', 5);
  assert.ok(index >= 0 && index < 5);
});
