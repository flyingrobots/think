import assert from 'node:assert/strict';
import test from 'node:test';

import { selectLogo, renderSplash } from '../../src/splash.js';
import { createWindowedBrowseModel } from '../../src/browse-tui/model.js';

test('selectLogo picks large mind logo when terminal is wide and tall enough', () => {
  const { art, type } = selectLogo(80, 40);
  assert.ok(art.includes('⣿'), 'Expected large logo to contain braille characters');
  assert.ok(art.split('\n').length > 20, 'Expected large logo to be tall');
  assert.equal(type, 'mind');
});

test('selectLogo picks medium mind logo when terminal fits medium but not large', () => {
  const { art, type } = selectLogo(55, 24);
  assert.ok(/[\u2801-\u28FF]/.test(art), 'Expected medium mind logo to contain braille characters');
  assert.ok(art.split('\n').length <= 20, 'Expected medium logo to be shorter than large');
  assert.equal(type, 'mind');
});

test('selectLogo picks text logo when terminal is too small for mind', () => {
  const { art, type } = selectLogo(80, 18);
  assert.ok(art.includes('+++'), 'Expected text logo to contain + characters');
  assert.equal(type, 'text');
});

test('selectLogo always returns something even for tiny terminals', () => {
  const { art, type } = selectLogo(20, 5);
  assert.ok(typeof art === 'string', 'Expected a string');
  assert.ok(art.length > 0, 'Expected non-empty logo');
  assert.ok(typeof type === 'string', 'Expected a type');
});

test('renderSplash contains the logo', () => {
  const frame = renderSplash(160, 44);
  assert.ok(frame.includes('⣿') || frame.includes('██') || frame.includes('+++') || frame.includes('THINK'),
    'Expected splash frame to contain logo content');
});

test('renderSplash contains the Enter prompt', () => {
  const frame = renderSplash(80, 24);
  assert.ok(frame.includes('Press [ Enter ]'), 'Expected splash to show Enter prompt');
});

test('renderSplash output fits within the given dimensions', () => {
  const cols = 80;
  const rows = 24;
  const frame = renderSplash(cols, rows);
  const lines = frame.split('\n');
  assert.ok(lines.length <= rows, `Expected at most ${rows} lines, got ${lines.length}`);
});

test('renderSplash centers the prompt horizontally', () => {
  const cols = 80;
  const rows = 24;
  const frame = renderSplash(cols, rows);
  const lines = frame.split('\n');
  const promptLine = lines.find((l) => l.includes('Press [ Enter ]'));
  assert.ok(promptLine, 'Expected to find prompt line');
  // eslint-disable-next-line no-control-regex -- stripping ANSI escapes requires matching control chars
  const stripped = promptLine.replace(/\x1b\[[0-9;]*m/gu, '');
  const leadingSpaces = stripped.length - stripped.trimStart().length;
  const promptText = 'Press [ Enter ]';
  const expectedPad = Math.floor((cols - promptText.length) / 2);
  assert.ok(
    Math.abs(leadingSpaces - expectedPad) <= 1,
    `Expected prompt to be roughly centered (leading=${leadingSpaces}, expected~${expectedPad})`
  );
});

const STUB_BOOTSTRAP = {
  ok: true,
  current: {
    id: 'entry:1774770801299-4f70e851-0f60-4cfd-acd4-330d293d6fd3',
    createdAt: '2026-03-28T18:33:21.299Z',
    text: 'test thought',
    sessionId: 'session:1774748021299-4f70e851-0f60-4cfd-acd4-330d293d6fd3',
    sortKey: '2026-03-28T18:33:21.299Z',
  },
  newer: null,
  older: null,
  sessionContext: {
    sessionId: 'session:1774748021299-4f70e851-0f60-4cfd-acd4-330d293d6fd3',
    sessionPosition: 1,
    sessionCount: 1,
  },
  sessionEntries: [],
  sessionSteps: [],
};

test('windowed browse model initializes in windowed mode', () => {
  const model = createWindowedBrowseModel({
    bootstrap: STUB_BOOTSTRAP,
    inspectCache: new Map(),
    loadBrowseWindow: null,
    loadChronologyEntries: null,
  });
  assert.equal(model.mode, 'windowed');
  assert.equal(model.panelMode, 'none');
});
