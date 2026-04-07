import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { flex } from '@flyingrobots/bijou-tui';

const LOGOS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'logos');

function loadLogo(relativePath) {
  return readFileSync(join(LOGOS_DIR, relativePath), 'utf8').trimEnd();
}

const LOGOS = [
  { name: 'large', art: loadLogo('large/think.txt') },
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

const PADDING = 6;
const PROMPT_ROWS = 2;

export function selectLogo(columns, rows) {
  for (const logo of LOGOS) {
    if (logo.width + PADDING <= columns && logo.height + PROMPT_ROWS + PADDING <= rows) {
      return logo.art;
    }
  }
  return LOGOS[LOGOS.length - 1].art;
}

const ANSI_DIM = '\x1b[2m';
const ANSI_RESET = '\x1b[0m';

export function renderSplash(columns, rows) {
  const logo = selectLogo(columns, rows);
  const logoLines = logo.split('\n');
  const logoHeight = logoLines.length;
  const prompt = `${ANSI_DIM}Press [ Enter ]${ANSI_RESET}`;

  const contentHeight = logoHeight + PROMPT_ROWS;
  const topPad = Math.max(0, Math.floor((rows - contentHeight) / 2));
  const bottomPad = Math.max(0, rows - topPad - contentHeight);

  return flex(
    { direction: 'column', width: columns, height: rows },
    { basis: topPad, content: '' },
    { basis: logoHeight, content: logo, align: 'center' },
    { basis: 1, content: '' },
    { basis: 1, content: prompt, align: 'center' },
    { basis: bottomPad, content: '' },
  );
}
