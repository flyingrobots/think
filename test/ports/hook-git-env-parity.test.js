import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { GIT_LOCATION_ENV_VARS, repoRoot } from '../fixtures/runtime.js';

/**
 * The git variables to scrub are applied in two places: JavaScript for spawned
 * Think processes, and shell for the git hooks. Both exist because hooks cannot
 * import the module and the fixtures cannot source the shell function.
 *
 * An earlier version of this file only asserted the two hand-maintained lists
 * agreed with each other. They did — and both were missing eight variables
 * including GIT_CONFIG. Agreement between two incomplete lists proves nothing,
 * so these tests assert *completeness* against `git rev-parse --local-env-vars`,
 * which is what git itself considers repository-local.
 */

const SCRUB_SCRIPT = join(repoRoot, 'scripts', 'hooks', 'lib', 'scrub-git-env.sh');

function gitLocalEnvVars() {
  const result = spawnSync('git', ['rev-parse', '--local-env-vars'], { encoding: 'utf8' });
  assert.equal(result.status, 0, 'Expected git rev-parse --local-env-vars to succeed.');

  return String(result.stdout).split('\n').map((line) => line.trim()).filter(Boolean).sort();
}

test('the JavaScript scrub list covers everything git calls repository-local', () => {
  const authoritative = gitLocalEnvVars();
  const covered = new Set(GIT_LOCATION_ENV_VARS);
  const missing = authoritative.filter((name) => !covered.has(name));

  assert.deepEqual(
    missing,
    [],
    [
      'GIT_LOCATION_ENV_VARS is missing variables git reports as repository-local.',
      'A spawned Think process could still resolve the invoking repository through them.',
      `missing: ${missing.join(', ')}`,
    ].join('\n')
  );
});

test('the shell hook derives its scrub set from git rather than hand-maintaining it', () => {
  const source = readFileSync(SCRUB_SCRIPT, 'utf8');

  assert.match(
    source,
    /git rev-parse --local-env-vars/u,
    'Expected the hook to query git for the authoritative set, so it cannot drift as git adds variables.'
  );
  assert.match(source, /unset "\$\{name\}"/u, 'Expected the queried names to actually be unset.');
});

test('both scrub paths cover the same extra repository-scoping variables', () => {
  // A few variables scope lookups but are absent from --local-env-vars, so they
  // are still listed by hand. Those hand-maintained additions must agree.
  const source = readFileSync(SCRUB_SCRIPT, 'utf8');
  const declared = /GIT_EXTRA_SCRUBBED_ENV_VARS="([^"]+)"/u.exec(source);

  assert.ok(declared, 'Expected the shell helper to declare its extra variables in one place.');

  const shellExtras = declared[1].trim().split(/\s+/u).sort();
  const authoritative = new Set(gitLocalEnvVars());
  const jsExtras = GIT_LOCATION_ENV_VARS.filter((name) => !authoritative.has(name)).sort();

  assert.deepEqual(
    shellExtras,
    jsExtras,
    'Expected the hand-maintained extras to match between shell and JavaScript.'
  );
});

test('no identity or transport variable is scrubbed', () => {
  // Dropping GIT_SSH_COMMAND or GIT_AUTHOR_NAME would change push and commit
  // behaviour rather than isolate a repository.
  const forbidden = GIT_LOCATION_ENV_VARS.filter((name) => (
    /AUTHOR|COMMITTER|SSH|TERMINAL|ASKPASS|EDITOR|PAGER/u.test(name)
  ));

  assert.deepEqual(forbidden, [], 'Expected only repository-scoping variables in the scrub set.');
});

test('both hooks invoke the shared scrub before running anything', () => {
  for (const hook of ['pre-commit', 'pre-push']) {
    const source = readFileSync(join(repoRoot, 'scripts', 'hooks', hook), 'utf8');

    assert.match(
      source,
      /scrub_git_location_env/u,
      `Expected scripts/hooks/${hook} to scrub inherited git location state.`
    );

    const scrubAt = source.indexOf('scrub_git_location_env\n');
    const npmAt = source.indexOf('npm run');
    assert.ok(
      scrubAt !== -1 && scrubAt < npmAt,
      `Expected scripts/hooks/${hook} to scrub before invoking npm.`
    );
  }
});
