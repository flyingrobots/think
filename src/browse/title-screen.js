import { showSplash } from '../browse-tui/app.js';

const TITLE_SCREEN_RESULTS = Object.freeze({
  enter: (result, minds) => ({
    action: 'enter',
    mind: result?.mind ?? minds[0] ?? null,
  }),
  quit: () => ({ action: 'quit', mind: null }),
});

const DEFAULT_TITLE_SCREEN_RESULT = TITLE_SCREEN_RESULTS.enter;

export async function selectBrowseMindWithTitleScreen({
  minds = [],
  showTitleScreen = showSplash,
} = {}) {
  const result = await showTitleScreen({ minds });
  return (TITLE_SCREEN_RESULTS[result?.action] ?? DEFAULT_TITLE_SCREEN_RESULT)(result, minds);
}
