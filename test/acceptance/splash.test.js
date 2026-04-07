import assert from 'node:assert/strict';
import test from 'node:test';

import { selectLogo, renderSplash } from '../../src/splash.js';
import { createWindowedBrowseModel } from '../../src/browse-tui/model.js';

test('selectLogo picks xlarge think logo on very wide terminals', () => {
  const logo = selectLogo(160, 43);
  assert.ok(logo.includes('██'), 'Expected xlarge logo to contain block characters');
  assert.ok(logo.split('\n').length > 20, 'Expected xlarge logo to be tall');
});

test('selectLogo picks large mind logo when terminal fits but not xlarge', () => {
  const logo = selectLogo(80, 40);
  assert.ok(logo.includes('⣿'), 'Expected large logo to contain braille characters');
  assert.ok(logo.split('\n').length > 20, 'Expected large logo to be tall');
});

test('selectLogo picks medium logo when terminal fits medium but not large', () => {
  const logo = selectLogo(80, 24);
  assert.ok(logo.includes('+++'), 'Expected medium logo to contain + characters');
  assert.ok(logo.split('\n').length <= 20, 'Expected medium logo to be shorter than large');
});

test('selectLogo picks small logo when terminal is narrow', () => {
  const logo = selectLogo(60, 12);
  const lines = logo.split('\n');
  assert.ok(lines.length <= 10, 'Expected small logo to be compact');
});

test('selectLogo always returns something even for tiny terminals', () => {
  const logo = selectLogo(20, 5);
  assert.ok(typeof logo === 'string', 'Expected a string');
  assert.ok(logo.length > 0, 'Expected non-empty logo');
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
  // Find the line containing the prompt (strip ANSI for matching)
  const promptLine = lines.find((l) => l.includes('Press [ Enter ]'));
  assert.ok(promptLine, 'Expected to find prompt line');
  // The prompt should have leading whitespace for centering
  // eslint-disable-next-line no-control-regex -- stripping ANSI escapes requires matching control chars
  const stripped = promptLine.replace(/\x1b\[[0-9;]*m/gu, '');
  const leadingSpaces = stripped.length - stripped.trimStart().length;
  const promptText = 'Press [ Enter ]';
  const expectedPad = Math.floor((cols - promptText.length) / 2);
  // Allow +/- 1 for rounding
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

test('windowed browse model starts in splash phase', () => {
  const model = createWindowedBrowseModel({
    bootstrap: STUB_BOOTSTRAP,
    inspectCache: new Map(),
    loadBrowseWindow: null,
    loadChronologyEntries: null,
  });
  assert.equal(model.phase, 'splash');
});
