import assert from 'node:assert/strict';
import test from 'node:test';

import { createWindowedBrowseModel } from '../../src/browse-tui/model.js';
import { renderBrowseModel } from '../../src/browse-tui/view.js';

test('windowed browse initializes with no drawer open', () => {
  const model = createWindowedBrowseModel({
    bootstrap: {
      ok: true,
      current: {
        id: 'entry:1774770801299-4f70e851-0f60-4cfd-acd4-330d293d6fd3',
        createdAt: '2026-03-28T18:33:21.299Z',
        text: 'git-warp needs some serious perf work',
        sessionId: 'session:1774748021299-4f70e851-0f60-4cfd-acd4-330d293d6fd3',
        sortKey: '2026-03-28T18:33:21.299Z',
      },
      newer: null,
      older: null,
      sessionContext: {
        sessionId: 'session:1774748021299-4f70e851-0f60-4cfd-acd4-330d293d6fd3',
        sessionPosition: 1,
        sessionCount: 1,
      },
      sessionEntries: [],
      sessionSteps: [],
    },
    inspectCache: new Map(),
    loadBrowseWindow: null,
    loadChronologyEntries: null,
  });

  assert.equal(model.panelMode, 'none', 'Expected the live windowed browse model to start with no drawer open.');

  const frame = renderBrowseModel(model);
  assert.doesNotMatch(
    frame,
    /┌|└|┐|┘/,
    'Expected the initial live browse frame not to render any drawer border before the user opens a panel.'
  );
});
