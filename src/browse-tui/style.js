// Warm palette from the splash screen
// Background: #2d1922 (dark plum)
// Stroke/primary: #fffcc9 (cream)
// Accent colors: #ed555d (coral), #41b797 (teal), #eda126 (amber), #7b5770 (mauve)

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

export function styleTitle(_ctx, text) {
  return `${BOLD}${fg(PALETTE.teal)}${text}${RESET}`;
}

export function styleSection(_ctx, text) {
  return `${BOLD}${fg(PALETTE.amber)}${text}${RESET}`;
}

export function styleDim(_ctx, text) {
  return `${fg(PALETTE.mauve)}${text}${RESET}`;
}

export function styleAccent(_ctx, text) {
  return `${fg(PALETTE.coral)}${text}${RESET}`;
}

export function stylePrimary(_ctx, text) {
  return `${fg(PALETTE.cream)}${text}${RESET}`;
}

export { PALETTE };
