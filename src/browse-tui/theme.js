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
    pending: tv('#7b5770', ['dim']),
    active: tv('#41b797'),
    muted: tv('#7b5770', ['dim', 'strikethrough']),
  },

  semantic: {
    success: tv('#41b797'),
    warning: tv('#eda126'),
    error: tv('#ed555d'),
    info: tv('#41b797'),
    accent: tv('#41b797'),
    header: tv('#eda126'),
    dim: tv('#7b5770'),
    highlight: tv('#ed555d'),
    muted: tv('#7b5770', ['dim']),
    primary: tv('#fffcc9', ['bold']),
    text: tv('#fffcc9'),
    bg: tv('#2d1922'),
  },

  border: {
    primary: tv('#41b797'),
    secondary: tv('#eda126'),
    success: tv('#41b797'),
    warning: tv('#eda126'),
    error: tv('#ed555d'),
    muted: tv('#7b5770'),
  },

  ui: {
    border: tv('#7b5770'),
    selection: tv('#41b797'),
    focus: tv('#eda126'),
    cursor: tv('#41b797'),
    scrollThumb: tv('#41b797'),
    scrollTrack: tv('#7b5770'),
    sectionHeader: tv('#eda126', ['bold']),
    logo: tv('#fffcc9'),
    tableHeader: tv('#fffcc9'),
    trackEmpty: tv('#24141c'),
  },

  surface: {
    primary: { hex: '#fffcc9', bg: '#2d1922' },
    secondary: { hex: '#fffcc9', bg: '#24141c' },
    elevated: { hex: '#fffcc9', bg: '#3a212b' },
    overlay: { hex: '#fffcc9', bg: '#3a212b' },
    muted: { hex: '#7b5770', bg: '#24141c' },
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

  status: {
    success: tv('#00ff41'),
    warning: tv('#d1ffbd'),
    error: tv('#ff4141'),
    info: tv('#008f11'),
    pending: tv('#003b00', ['dim']),
    active: tv('#00ff41'),
    muted: tv('#003b00', ['dim', 'strikethrough']),
  },

  semantic: {
    success: tv('#00ff41'),
    warning: tv('#d1ffbd'),
    error: tv('#ff4141'),
    info: tv('#008f11'),
    accent: tv('#00ff41'),
    header: tv('#008f11'),
    dim: tv('#003b00'),
    highlight: tv('#d1ffbd'),
    muted: tv('#003b00', ['dim']),
    primary: tv('#00ff41', ['bold']),
    text: tv('#00ff41'),
    bg: tv('#000000'),
  },

  border: {
    primary: tv('#00ff41'),
    secondary: tv('#008f11'),
    success: tv('#00ff41'),
    warning: tv('#d1ffbd'),
    error: tv('#ff4141'),
    muted: tv('#003b00'),
  },

  ui: {
    border: tv('#008f11'),
    selection: tv('#00ff41'),
    focus: tv('#d1ffbd'),
    cursor: tv('#00ff41'),
    scrollThumb: tv('#00ff41'),
    scrollTrack: tv('#003b00'),
    sectionHeader: tv('#008f11', ['bold']),
    logo: tv('#00ff41'),
    tableHeader: tv('#00ff41'),
    trackEmpty: tv('#000500'),
  },

  surface: {
    primary: { hex: '#00ff41', bg: '#000000' },
    secondary: { hex: '#00ff41', bg: '#000500' },
    elevated: { hex: '#00ff41', bg: '#001100' },
    overlay: { hex: '#00ff41', bg: '#001100' },
    muted: { hex: '#003b00', bg: '#000500' },
    panel: tv('#001100'),
    well: tv('#000500'),
  },
};

export const cyberTheme = {
  name: 'cyber',
  label: 'Cyberpunk',

  status: {
    success: tv('#00ff9f'),
    warning: tv('#fcee0a'),
    error: tv('#ff003c'),
    info: tv('#3d1a5d'),
    pending: tv('#3d1a5d', ['dim']),
    active: tv('#fcee0a'),
    muted: tv('#3d1a5d', ['dim', 'strikethrough']),
  },

  semantic: {
    success: tv('#00ff9f'),
    warning: tv('#fcee0a'),
    error: tv('#ff003c'),
    info: tv('#00ff9f'),
    accent: tv('#fcee0a'),
    header: tv('#00ff9f'),
    dim: tv('#3d1a5d'),
    highlight: tv('#ff003c'),
    muted: tv('#3d1a5d', ['dim']),
    primary: tv('#00ff9f', ['bold']),
    text: tv('#00ff9f'),
    bg: tv('#050a0e'),
  },

  border: {
    primary: tv('#00ff9f'),
    secondary: tv('#fcee0a'),
    success: tv('#00ff9f'),
    warning: tv('#fcee0a'),
    error: tv('#ff003c'),
    muted: tv('#3d1a5d'),
  },

  ui: {
    border: tv('#3d1a5d'),
    selection: tv('#fcee0a'),
    focus: tv('#ff003c'),
    cursor: tv('#fcee0a'),
    scrollThumb: tv('#fcee0a'),
    scrollTrack: tv('#3d1a5d'),
    sectionHeader: tv('#00ff9f', ['bold']),
    logo: tv('#00ff9f'),
    tableHeader: tv('#00ff9f'),
    trackEmpty: tv('#0f0f1b'),
  },

  surface: {
    primary: { hex: '#00ff9f', bg: '#050a0e' },
    secondary: { hex: '#00ff9f', bg: '#0f0f1b' },
    elevated: { hex: '#00ff9f', bg: '#1a1a2e' },
    overlay: { hex: '#00ff9f', bg: '#1a1a2e' },
    muted: { hex: '#3d1a5d', bg: '#0f0f1b' },
    panel: tv('#1a1a2e'),
    well: tv('#0f0f1b'),
  },
};

export const thinkThemes = [thinkTheme, matrixTheme, cyberTheme];

export const thinkShellThemes = thinkThemes.map((theme) => Object.freeze({
  id: theme.name,
  label: theme.label,
  theme,
}));
