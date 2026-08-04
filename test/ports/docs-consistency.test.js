import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function readRepoFile(relativePath) {
  return readFileSync(new URL(`../../${relativePath}`, import.meta.url), 'utf8');
}

test('METHOD docs use one consistent cycle-only release and README closeout policy', () => {
  const contributing = readRepoFile('CONTRIBUTING.md');
  const release = readRepoFile('docs/method/release.md');

  assert.match(
    contributing,
    /- update \[`README\.md`\]\(\.\/README\.md\) when the user-facing surface changed/,
    'Expected CONTRIBUTING.md cycle closeout guidance to use the conditional README update rule.'
  );
  assert.match(
    contributing,
    /- every cycle close updates the changelog; update README when the user-facing surface changed/,
    'Expected CONTRIBUTING.md release discipline to repeat the same conditional README update rule.'
  );
  assert.doesNotMatch(
    contributing,
    /every cycle close updates the changelog and README, even if no release is cut/i,
    'CONTRIBUTING.md should not contain contradictory mandatory README-on-every-cycle wording.'
  );
  assert.doesNotMatch(
    contributing,
    /milestone or cycle closeout produces the release-candidate state/i,
    'CONTRIBUTING.md should keep METHOD release discipline cycle-only.'
  );
  assert.match(
    release,
    /4\. CHANGELOG is updated at every cycle close\. README is updated when the user-facing surface changed\./,
    'Expected docs/method/release.md to use the same conditional README update rule as CONTRIBUTING.md.'
  );
  assert.doesNotMatch(
    release,
    /README.*every cycle close/i,
    'docs/method/release.md should not contain contradictory mandatory README-on-every-cycle wording.'
  );
  assert.doesNotMatch(
    release,
    /milestone or cycle closeout produces the release candidate state/i,
    'docs/method/release.md should keep METHOD release discipline cycle-only.'
  );
});

test('README presents the capture followthrough budget as a default, not a fixed constant', () => {
  const readme = readRepoFile('README.md');
  const prose = readme.split('```').filter((_, index) => index % 2 === 0).join('\n');

  const absoluteClaims = prose
    .split('\n')
    .filter((line) => /(?:abandoned|deferred|defers|gives up)[^.\n]*\b6 seconds\b/iu.test(line))
    .filter((line) => !/default|configurable/iu.test(line));

  assert.deepEqual(
    absoluteClaims,
    [],
    [
      'README prose states the followthrough budget as an absolute 6 seconds.',
      'It is configurable through THINK_CAPTURE_FOLLOWTHROUGH_TIMEOUT_MS, so every',
      'mention outside a code example must say "default" or "configurable".',
    ].join('\n')
  );
});

test('README documents the followthrough budget knob in its environment table', () => {
  const readme = readRepoFile('README.md');

  assert.match(
    readme,
    /\|\s*`THINK_CAPTURE_FOLLOWTHROUGH_TIMEOUT_MS`\s*\|/u,
    'Expected the environment table to carry a row for the followthrough budget.'
  );
});

test('README does not describe the URL-validated capture field as free-form', () => {
  // sourceURL is z.string().url() at the MCP boundary and the runtime keeps only
  // http(s). Calling it free-form invites an agent to pass an internal id, which
  // rejects the whole capture before the thought is saved.
  const readme = readRepoFile('README.md');
  const claims = readme
    .split('\n')
    .filter((line) => /sourceURL/u.test(line))
    .filter((line) => /free-form/iu.test(line));

  assert.deepEqual(
    claims,
    [],
    'Expected sourceURL never to be described as free-form; it is URL-validated.'
  );

  assert.match(
    readme,
    /`sourceURL`[\s\S]{0,400}?valid URL/u,
    'Expected the README to state that sourceURL must be a valid URL.'
  );
});

test('the agent instruction block does not contradict the capture contract', () => {
  // This block is inside a fenced code block, so the prose guards deliberately
  // skip it — and a correction to the prose once left the block, which is the part
  // agents actually paste into CLAUDE.md, still carrying the retracted claim.
  const readme = readRepoFile('README.md');
  const blocks = readme.split('```').filter((_, index) => index % 2 === 1);
  const raw = blocks.find((block) => block.startsWith('markdown')) ?? '';
  // Normalise first: the claims wrap across lines and carry backticks, so a
  // literal match silently passed while the block still said the wrong thing.
  const instructions = raw.replace(/`/gu, '').replace(/\s+/gu, ' ');

  assert.ok(instructions.length > 0, 'Expected to find the fenced agent instruction block.');

  assert.doesNotMatch(
    instructions,
    /remember will still find it/iu,
    'Which surfaces see a deferred capture is nondeterministic; the block must not promise remember does.'
  );
  assert.doesNotMatch(
    instructions,
    /returns[^.]*as soon as the raw text is committed/iu,
    'capture awaits followthrough and backup before returning, so it is not immediate.'
  );
  assert.match(
    instructions,
    /do not\s*\n?\s*retry/iu,
    'The block must still tell agents not to retry a deferred capture.'
  );
});

test('MIND_ORCHESTRATION.md exists and is linked from GUIDE.md', () => {
  const mindDoc = readRepoFile('docs/MIND_ORCHESTRATION.md');
  assert.ok(mindDoc.length > 0, 'Expected docs/MIND_ORCHESTRATION.md to exist and have content.');
  assert.match(mindDoc, /mind/i, 'Expected the doc to mention minds.');

  const guide = readRepoFile('GUIDE.md');
  assert.match(
    guide,
    /MIND_ORCHESTRATION/,
    'Expected GUIDE.md to link to MIND_ORCHESTRATION.md.'
  );
});

test('cycle 0006 retrospective restarts ordered numbering for the human playback section', () => {
  const retro = readRepoFile('docs/method/retro/0006/refresh-contributing.md');
  const humanPerspective = retro.match(
    /### Human perspective[\s\S]*?(?=\n### |\n## |\n# |$)/
  )?.[0] ?? '';

  assert.match(
    humanPerspective,
    /(^|\n)1\. Can a new contributor understand the current workflow from one doc\?[\s\S]*\n2\. Is the capture doctrine still obvious\?/,
    'Expected the Human perspective list to restart numbering at 1 and 2.'
  );
});
