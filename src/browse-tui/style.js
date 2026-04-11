// Warm palette — used by both ctx-aware (bijou theme) and fallback (raw ANSI) paths.
// The custom theme in theme.js maps these to bijou's token vocabulary.

const PALETTE = {
  bg: [45, 25, 34],
  cream: [255, 252, 201],
  coral: [237, 85, 93],
  teal: [65, 183, 151],
  amber: [237, 161, 38],
  mauve: [123, 87, 112],
  dimCream: [140, 138, 110],
};

function fg(rgb) {
  return `\x1b[38;2;${rgb[0]};${rgb[1]};${rgb[2]}m`;
}

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

export function styleTitle(ctx, text) {
  if (ctx) {
    return ctx.style.styled(ctx.semantic('accent'), ctx.style.bold(text));
  }
  return `${BOLD}${fg(PALETTE.teal)}${text}${RESET}`;
}

export function styleSection(ctx, text) {
  if (ctx) {
    return ctx.style.styled(ctx.ui('sectionHeader'), text);
  }
  return `${BOLD}${fg(PALETTE.amber)}${text}${RESET}`;
}

export function styleDim(ctx, text) {
  if (ctx) {
    return ctx.style.styled(ctx.semantic('muted'), text);
  }
  return `${fg(PALETTE.mauve)}${text}${RESET}`;
}

export function styleAccent(ctx, text) {
  if (ctx) {
    return ctx.style.styled(ctx.semantic('accent'), text);
  }
  return `${fg(PALETTE.coral)}${text}${RESET}`;
}

export function stylePrimary(ctx, text) {
  if (ctx) {
    return ctx.style.styled(ctx.semantic('primary'), text);
  }
  return `${fg(PALETTE.cream)}${text}${RESET}`;
}

function toHex(rgb) {
  return `#${rgb.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

export const BG_TOKEN = {
  hex: toHex(PALETTE.cream),
  bg: toHex(PALETTE.bg),
};

export { PALETTE };
