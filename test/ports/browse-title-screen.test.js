import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { selectBrowseMindWithTitleScreen } from '../../src/browse/title-screen.js';

test('Browse title screen forwards available minds to the splash renderer', async () => {
  const minds = [
    { name: 'codex', repoDir: '/tmp/codex', isDefault: true },
    { name: 'claude', repoDir: '/tmp/claude', isDefault: false },
  ];
  let receivedOptions = null;

  const selected = await selectBrowseMindWithTitleScreen({
    minds,
    showTitleScreen: (options) => {
      receivedOptions = options;
      return { action: 'enter', mind: minds[1] };
    },
  });

  assert.deepEqual(receivedOptions, { minds });
  assert.deepEqual(selected, { action: 'enter', mind: minds[1] });
});

test('Browse title screen falls back to the first mind when Enter returns no explicit mind', async () => {
  const minds = [
    { name: 'codex', repoDir: '/tmp/codex', isDefault: true },
  ];

  const selected = await selectBrowseMindWithTitleScreen({
    minds,
    showTitleScreen: () => ({ action: 'enter', mind: null }),
  });

  assert.deepEqual(selected, { action: 'enter', mind: minds[0] });
});

test('Browse title screen quits before the AppShell opens', async () => {
  const selected = await selectBrowseMindWithTitleScreen({
    minds: [{ name: 'codex', repoDir: '/tmp/codex', isDefault: true }],
    showTitleScreen: () => ({ action: 'quit' }),
  });

  assert.deepEqual(selected, { action: 'quit', mind: null });
});

test('interactive browse route restores the title screen before AppShell construction', async () => {
  const source = await readFile(new URL('../../src/cli/commands/read.js', import.meta.url), 'utf8');
  const titleScreenOffset = source.indexOf('selectBrowseMindWithTitleScreen({ minds })');
  const appShellOffset = source.indexOf('runBrowseAppShellTui({');

  assert.notEqual(titleScreenOffset, -1);
  assert.notEqual(appShellOffset, -1);
  assert.ok(titleScreenOffset < appShellOffset);
});
