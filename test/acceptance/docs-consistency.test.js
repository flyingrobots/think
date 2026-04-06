import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function readRepoFile(relativePath) {
  return readFileSync(new URL(`../../${relativePath}`, import.meta.url), 'utf8');
}

test('METHOD docs use one consistent README closeout policy', () => {
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
  assert.match(
    release,
    /4\. CHANGELOG is updated at every cycle close\. README is updated when the user-facing surface changed\./,
    'Expected docs/method/release.md to use the same conditional README update rule as CONTRIBUTING.md.'
  );
});

test('cycle 0006 retrospective restarts ordered numbering for the human playback section', () => {
  const retro = readRepoFile('docs/method/retro/0006/refresh-contributing.md');

  assert.match(
    retro,
    /### Human perspective\s+1\. Can a new contributor understand the current workflow from one doc\?[\s\S]*\n2\. Is the capture doctrine still obvious\?/,
    'Expected the Human perspective list to restart numbering at 1 and 2.'
  );
});
