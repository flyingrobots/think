import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseAnsiToSurface } from '@flyingrobots/bijou';

const LOGOS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'logos');

function loadLogo(relativePath) {
  return readFileSync(join(LOGOS_DIR, relativePath), 'utf8').trimEnd();
}

const LOGOS = [
  { name: 'large', art: loadLogo('large/mind.txt'), type: 'mind' },
  { name: 'medium', art: loadLogo('medium/mind.txt'), type: 'mind' },
  { name: 'small', art: loadLogo('medium/think.txt'), type: 'text' },
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
      return { art: logo.art, type: logo.type };
    }
  }
  const fallback = LOGOS[LOGOS.length - 1];
  return { art: fallback.art, type: fallback.type };
}

const ANSI_DIM = '\x1b[2m';
const ANSI_RESET = '\x1b[0m';

export function renderSplashView(columns, rows, ctx) {
  const prompt = ctx
    ? ctx.style.styled(ctx.semantic('muted'), 'Press [ Enter ]')
    : `${ANSI_DIM}Press [ Enter ]${ANSI_RESET}`;

  const ansi = renderSplashString(columns, rows, prompt);
  // Replace braille blank (U+2800) with regular space — visually identical
  // but bijou's surface parser handles regular spaces correctly.
  return parseAnsiToSurface(ansi.replaceAll('⠀', ' '), columns, rows);
}

function centerLogoLines(logoArt, columns) {
  const lines = logoArt.split('\n');
  const maxWidth = Math.max(...lines.map((l) => l.length));
  const offset = Math.max(0, Math.floor((columns - maxWidth) / 2));
  // Pad with braille blank (U+2800) to keep the character space uniform
  const pad = '⠀'.repeat(offset);
  return lines.map((line) => `${pad}${line}`).join('\n');
}

function renderSplashString(columns, rows, prompt) {
  const { art } = selectLogo(columns, rows);
  const centeredLogo = centerLogoLines(art, columns);
  const logoLines = centeredLogo.split('\n');

  const promptText = `Press [ Enter ]`;
  const promptPad = Math.max(0, Math.floor((columns - promptText.length) / 2));
  const centeredPrompt = `${' '.repeat(promptPad)}${prompt}`;

  const contentHeight = logoLines.length + PROMPT_ROWS;
  const topPad = Math.max(0, Math.floor((rows - contentHeight) / 2));

  const output = [];
  for (let i = 0; i < topPad; i++) {
    output.push('');
  }
  output.push(centeredLogo);
  output.push('');
  output.push(centeredPrompt);

  return output.join('\n');
}

export function renderSplash(columns, rows) {
  const prompt = `${ANSI_DIM}Press [ Enter ]${ANSI_RESET}`;
  return renderSplashString(columns, rows, prompt);
}
