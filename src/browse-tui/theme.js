import { tv } from '@flyingrobots/bijou';

// Think warm palette
// Background: #2d1922 (dark plum)
// Primary text: #fffcc9 (cream)
// Accent: #41b797 (teal)
// Section headers: #eda126 (amber)
// Dim/muted: #7b5770 (mauve)
// Highlight: #ed555d (coral)

export const thinkTheme = {
  name: 'think',
  label: 'Think Warm',

  status: {
    success: tv('#41b797'),
    warning: tv('#eda126'),
    error: tv('#ed555d'),
    info: tv('#7b5770'),
  },

  semantic: {
    accent: tv('#41b797'),
    header: tv('#eda126'),
    dim: tv('#7b5770'),
    highlight: tv('#ed555d'),
    text: tv('#fffcc9'),
    bg: tv('#2d1922'),
  },

  ui: {
    border: tv('#7b5770'),
    selection: tv('#41b797'),
    focus: tv('#eda126'),
  },

  surface: {
    panel: tv('#3a212b'),
    well: tv('#24141c'),
  },

  gradient: {
    brand: [
      { pos: 0, color: [237, 85, 93] },
      { pos: 0.5, color: [65, 183, 151] },
      { pos: 1, color: [237, 161, 38] },
    ],
    progress: [
      { pos: 0, color: [123, 87, 112] },
      { pos: 1, color: [65, 183, 151] },
    ],
  },
};

export const matrixTheme = {
  name: 'matrix',
  label: 'Matrix',

  semantic: {
    accent: tv('#00ff41'),
    header: tv('#008f11'),
    dim: tv('#003b00'),
    highlight: tv('#d1ffbd'),
    text: tv('#00ff41'),
    bg: tv('#000000'),
  },

  ui: {
    border: tv('#008f11'),
    selection: tv('#00ff41'),
    focus: tv('#d1ffbd'),
  },

  surface: {
    panel: tv('#001100'),
    well: tv('#000500'),
  },
};

export const cyberTheme = {
  name: 'cyber',
  label: 'Cyberpunk',

  semantic: {
    accent: tv('#fcee0a'),
    header: tv('#00ff9f'),
    dim: tv('#3d1a5d'),
    highlight: tv('#ff003c'),
    text: tv('#00ff9f'),
    bg: tv('#050a0e'),
  },

  ui: {
    border: tv('#3d1a5d'),
    selection: tv('#fcee0a'),
    focus: tv('#ff003c'),
  },

  surface: {
    panel: tv('#1a1a2e'),
    well: tv('#0f0f1b'),
  },
};

export const thinkThemes = [thinkTheme, matrixTheme, cyberTheme];
