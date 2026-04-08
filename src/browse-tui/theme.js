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

  status: {
    success: tv('#41b797'),
    error: tv('#ed555d'),
    warning: tv('#eda126'),
    info: tv('#fffcc9'),
    pending: tv('#7b5770', ['dim']),
    active: tv('#41b797'),
    muted: tv('#7b5770', ['dim']),
  },

  semantic: {
    success: tv('#41b797'),
    error: tv('#ed555d'),
    warning: tv('#eda126'),
    info: tv('#fffcc9'),
    accent: tv('#41b797'),
    muted: tv('#7b5770'),
    primary: tv('#fffcc9', ['bold']),
  },

  border: {
    primary: tv('#7b5770'),
    secondary: tv('#41b797'),
    success: tv('#41b797'),
    warning: tv('#eda126'),
    error: tv('#ed555d'),
    muted: tv('#5a3d4f'),
  },

  surface: {
    primary: { hex: '#fffcc9', bg: '#2d1922' },
    secondary: { hex: '#fffcc9', bg: '#3a2230' },
    elevated: { hex: '#fffcc9', bg: '#46293a' },
    overlay: { hex: '#fffcc9', bg: '#2d1922' },
    muted: { hex: '#7b5770', bg: '#1e1018' },
  },

  ui: {
    cursor: tv('#41b797'),
    scrollThumb: tv('#7b5770'),
    scrollTrack: tv('#3a2230'),
    sectionHeader: tv('#eda126', ['bold']),
    logo: tv('#41b797'),
    tableHeader: tv('#fffcc9'),
    trackEmpty: tv('#3a2230'),
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
