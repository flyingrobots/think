import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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
  const prompt = 'Press [ Enter ]';

  const totalHeight = logoLines.length + PROMPT_ROWS;
  const topPad = Math.max(0, Math.floor((rows - totalHeight) / 2));

  const lines = [];

  for (let i = 0; i < topPad; i++) {
    lines.push('');
  }

  for (const line of logoLines) {
    const leftPad = Math.max(0, Math.floor((columns - line.length) / 2));
    lines.push(' '.repeat(leftPad) + line);
  }

  lines.push('');

  const promptPad = Math.max(0, Math.floor((columns - prompt.length) / 2));
  lines.push(' '.repeat(promptPad) + ANSI_DIM + prompt + ANSI_RESET);

  while (lines.length < rows) {
    lines.push('');
  }

  return lines.slice(0, rows).join('\n');
}
