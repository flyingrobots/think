import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { GIT_LOCATION_ENV_VARS, repoRoot } from '../fixtures/runtime.js';

/**
 * The set of git repository-location variables to scrub is expressed twice:
 * once in JavaScript for spawned Think processes, and once in shell for the
 * git hooks. Both exist because hooks cannot import the JS module and the JS
 * fixtures cannot source the shell function.
 *
 * Nothing else forces the two to agree. Adding a variable to one list alone
 * silently leaves the other path redirectable — the exact failure that made the
 * pre-push hook impossible to satisfy in the first place. This test is the
 * enforcement.
 */

const SCRUB_SCRIPT = join(repoRoot, 'scripts', 'hooks', 'lib', 'scrub-git-env.sh');

function readShellScrubbedVars() {
  const source = readFileSync(SCRUB_SCRIPT, 'utf8');
  const body = source.slice(source.indexOf('scrub_git_location_env()'));

  return [...body.matchAll(/^\s*unset\s+(GIT_[A-Z_]+)\s*$/gmu)]
    .map(([, name]) => name)
    .sort();
}

test('the shell hook scrubs exactly the git location variables the JS fixtures scrub', () => {
  const shellVars = readShellScrubbedVars();
  const jsVars = [...GIT_LOCATION_ENV_VARS].sort();

  assert.deepEqual(
    shellVars,
    jsVars,
    [
      'scripts/hooks/lib/scrub-git-env.sh and GIT_LOCATION_ENV_VARS have drifted.',
      'Both must scrub the same variables or one execution path stays redirectable.',
      `shell only: ${shellVars.filter((name) => !jsVars.includes(name)).join(', ') || '(none)'}`,
      `js only:    ${jsVars.filter((name) => !shellVars.includes(name)).join(', ') || '(none)'}`,
    ].join('\n')
  );
});

test('the shell scrub function unsets each variable exactly once', () => {
  const shellVars = readShellScrubbedVars();

  assert.deepEqual(
    shellVars,
    [...new Set(shellVars)],
    'Expected no duplicate unset lines, which would hide a typo in a neighbouring name.'
  );
});

test('every scrubbed variable actually redirects git rather than configuring identity', () => {
  // Identity and transport variables must not creep into this list: the product
  // sets its own commit identity, and dropping GIT_SSH_COMMAND would change
  // push behaviour rather than isolate a repository.
  const forbidden = GIT_LOCATION_ENV_VARS.filter((name) => (
    /AUTHOR|COMMITTER|SSH|TERMINAL|ASKPASS|EDITOR|PAGER|CONFIG/u.test(name)
  ));

  assert.deepEqual(
    forbidden,
    [],
    'Expected only repository-location variables in the scrub list.'
  );
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
