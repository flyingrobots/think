import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseAnsiToSurface } from '@flyingrobots/bijou';

const LOGOS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'logos');

function loadLogo(relativePath) {
  return readFileSync(join(LOGOS_DIR, relativePath), 'utf8').trimEnd();
}

const LOGOS = [
  { name: 'large', art: loadLogo('large/mind.txt') },
  { name: 'medium', art: loadLogo('medium/think.txt') },
  { name: 'small', art: loadLogo('small/think-2.txt') },
];

function measure(text) {
  const lines = text.split('\n');
  return {
    width: Math.max(...lines.map((l) => l.length)),
    height: lines.length,
  };
}

for (const logo of LOGOS) {
  Object.assign(logo, measure(logo.art));
}

const H_PADDING = 0;
const V_PADDING = 4;
const PROMPT_ROWS = 2;

export function selectLogo(columns, rows) {
  for (const logo of LOGOS) {
    if (logo.width + H_PADDING <= columns && logo.height + PROMPT_ROWS + V_PADDING <= rows) {
      return logo.art;
    }
  }
  return LOGOS[LOGOS.length - 1].art;
}

const ANSI_DIM = '\x1b[2m';
const ANSI_RESET = '\x1b[0m';

export function renderSplashView(columns, rows, ctx) {
  const prompt = ctx
    ? ctx.style.styled(ctx.semantic('muted'), 'Press [ Enter ]')
    : `${ANSI_DIM}Press [ Enter ]${ANSI_RESET}`;

  const ansi = renderSplashString(columns, rows, prompt);
  return parseAnsiToSurface(ansi, columns, rows);
}

// eslint-disable-next-line no-control-regex -- stripping ANSI escapes requires matching control chars
const ANSI_PATTERN = /\x1b\[[0-9;]*m/g;

function visualLength(text) {
  return text.replace(ANSI_PATTERN, '').length;
}

function centerLine(text, width) {
  const pad = Math.max(0, Math.floor((width - visualLength(text)) / 2));
  return ' '.repeat(pad) + text;
}

function renderSplashString(columns, rows, prompt) {
  const logo = selectLogo(columns, rows);
  const logoLines = logo.split('\n');

  const contentHeight = logoLines.length + PROMPT_ROWS;
  const topPad = Math.max(0, Math.floor((rows - contentHeight) / 2));

  const lines = [];
  for (let i = 0; i < topPad; i++) {
    lines.push('');
  }
  for (const line of logoLines) {
    lines.push(centerLine(line, columns));
  }
  lines.push('');
  lines.push(centerLine(prompt, columns));
  while (lines.length < rows) {
    lines.push('');
  }
  return lines.slice(0, rows).join('\n');
}

export function renderSplash(columns, rows) {
  const prompt = `${ANSI_DIM}Press [ Enter ]${ANSI_RESET}`;
  return renderSplashString(columns, rows, prompt);
}
