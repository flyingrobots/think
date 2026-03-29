import { initDefaultContext } from '@flyingrobots/bijou-node';
import { parseAnsiToSurface } from '@flyingrobots/bijou';
import {
  composite,
  commandPalette,
  createCommandPaletteState,
  cpFilter,
  cpFocusNext,
  cpFocusPrev,
  cpPageDown,
  cpPageUp,
  cpSelectedItem,
  createKeyMap,
  createScrollState,
  flex,
  helpShort,
  modal,
  pageDown,
  pageUp,
  quit,
  run,
  drawer,
  viewport,
} from '@flyingrobots/bijou-tui';

const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
};

const DEFAULT_COLUMNS = 120;
const DEFAULT_ROWS = 32;
const DEFAULT_JUMP_HEIGHT = 8;

const browseKeymap = createKeyMap()
  .group('Navigation', (group) => group
    .bind('j', 'Older', { type: 'move', delta: 1 })
    .bind('down', 'Older', { type: 'move', delta: 1 })
    .bind('k', 'Newer', { type: 'move', delta: -1 })
    .bind('up', 'Newer', { type: 'move', delta: -1 })
    .bind('home', 'Newest', { type: 'jump', target: 'newest' })
    .bind('end', 'Oldest', { type: 'jump', target: 'oldest' }))
  .group('Session', (group) => group
    .bind('[', 'Prev session', { type: 'session_move', direction: 'previous' })
    .bind(']', 'Next session', { type: 'session_move', direction: 'next' }))
  .group('View', (group) => group
    .bind('i', 'Inspect', { type: 'toggle_inspect' })
    .bind('s', 'Session', { type: 'toggle_session' })
    .bind('l', 'Log', { type: 'toggle_log' })
    .bind('/', 'Jump', { type: 'open_jump' })
    .bind('pageup', 'Scroll up', { type: 'scroll', direction: 'up' })
    .bind('pagedown', 'Scroll down', { type: 'scroll', direction: 'down' }))
  .group('Actions', (group) => group
    .bind('r', 'Reflect', { type: 'reflect' })
    .bind('q', 'Quit', { type: 'quit' })
    .bind('escape', 'Close/Quit', { type: 'escape' }));

export async function runBrowseTui({
  bootstrap,
  loadBrowseWindow = null,
  loadChronologyEntries = null,
  loadInspectEntry = null,
  previewReflectEntry = null,
  startReflectSession = null,
  saveReflectSessionResponse = null,
}) {
  let effect = { type: 'quit' };

  const app = {
    init() {
      return [createWindowedBrowseModel({
        bootstrap,
        inspectCache: new Map(),
        loadBrowseWindow,
        loadChronologyEntries,
      }), []];
    },
    update(msg, model) {
      if (msg.type === 'resize') {
        return [resizeBrowseModel(model, msg.columns, msg.rows), []];
      }

      if (msg.type === 'inspect_loaded') {
        const nextCache = new Map(model.inspectCache);
        if (msg.inspectEntry) {
          nextCache.set(msg.entryId, msg.inspectEntry);
        }
        return [{
          ...model,
          inspectCache: nextCache,
          inspectLoadingEntryId: model.inspectLoadingEntryId === msg.entryId
            ? null
            : model.inspectLoadingEntryId,
        }, []];
      }

      if (msg.type === 'browse_window_loaded') {
        const [nextModel, cmds] = applyBrowseWindowLoaded(model, msg, loadInspectEntry);
        return [nextModel, cmds];
      }

      if (msg.type === 'chronology_loaded') {
        return [applyChronologyLoaded(model, msg), []];
      }

      if (msg.type === 'reflect_previewed') {
        return [applyReflectPreviewed(model, msg), []];
      }

      if (msg.type === 'reflect_saved') {
        return [applyReflectSaved(model, msg), []];
      }

      if (msg.type === 'reflect_failed') {
        return [applyReflectFailed(model, msg), []];
      }

      if (msg.type !== 'key') {
        return [model, []];
      }

      const maybeCleared = clearNoticeOnKey(model);
      model = maybeCleared;

      const jumpResult = handleJumpKey(model, msg);
      if (jumpResult) {
        const [nextModel, cmds] = maybeQueueInspectLoad(jumpResult.model, loadInspectEntry);
        return [nextModel, cmds];
      }

      const reflectResult = handleReflectKey(model, msg);
      if (reflectResult) {
        const [nextModel, cmds] = maybeQueueInspectLoad(reflectResult.model, loadInspectEntry);
        return [nextModel, [...(reflectResult.cmds ?? []), ...cmds]];
      }

      let action = browseKeymap.handle(msg);
      if (!action) {
        return [model, []];
      }

      if (action.type === 'reflect') {
        action = {
          ...action,
          previewReflectEntry,
          startReflectSession,
          saveReflectSessionResponse,
          loadInspectEntry,
        };
      }

      const result = applyBrowseAction(model, action);
      if (result.effect?.type === 'quit') {
        effect = result.effect;
        return [result.model, [quit()]];
      }

      const [nextModel, cmds] = maybeQueueInspectLoad(result.model, loadInspectEntry);
      return [nextModel, [...(result.cmds ?? []), ...cmds]];
    },
    view(model) {
      return parseAnsiToSurface(renderBrowseModel(model), model.columns, model.rows);
    },
  };

  await run(app, { ctx: initDefaultContext() });
  return effect;
}

export async function runBrowseTuiScript({
  entries,
  inspectById,
  initialEntryId = null,
  actions = [],
  previewReflectEntry = null,
  startReflectSession = null,
  saveReflectSessionResponse = null,
  loadInspectEntry = null,
}) {
  let model = createBrowseModel({ entries, inspectCache: inspectById, initialEntryId });
  const frames = [renderBrowseModel(model)];
  let effect = { type: 'quit' };

  for (const rawAction of actions) {
    if (isScriptJumpAction(rawAction)) {
      const opened = applyBrowseAction(model, {
        type: 'open_jump',
        query: rawAction.query ?? '',
      });
      model = opened.model;
      frames.push(renderBrowseModel(model));

      const selectedEntryId = rawAction.entryId
        ?? cpSelectedItem(model.jumpPalette)?.id
        ?? null;
      const completed = applyBrowseAction(model, {
        type: 'apply_jump_target',
        entryId: selectedEntryId,
      });
      model = completed.model;
      frames.push(renderBrowseModel(model));
      continue;
    }

    if (isScriptReflectAction(rawAction)) {
      const result = await runScriptReflectAction(model, rawAction, {
        previewReflectEntry,
        startReflectSession,
        saveReflectSessionResponse,
        loadInspectEntry,
      });
      model = result.model;
      frames.push(...result.frames);
      continue;
    }

    const action = normalizeScriptAction(rawAction);
    const result = applyBrowseAction(model, action);
    model = result.model;
    frames.push(renderBrowseModel(model));

    if (result.effect?.type === 'quit') {
      effect = result.effect;
      break;
    }
  }

  return {
    effect,
    output: frames.join('\n\n' + styleDim('-----') + '\n\n'),
  };
}

function createBrowseModel({ entries, inspectCache, initialEntryId }) {
  return {
    mode: 'scripted',
    entries,
    inspectCache,
    inspectLoadingEntryId: null,
    currentIndex: resolveInitialIndex(entries, initialEntryId),
    panelMode: 'none',
    columns: process.stdout.columns ?? DEFAULT_COLUMNS,
    rows: process.stdout.rows ?? DEFAULT_ROWS,
    contentScrollY: 0,
    jumpPalette: createJumpPalette(entries),
    previousPanelMode: 'none',
    notice: null,
    reflect: {
      status: 'idle',
      entryId: null,
      promptType: null,
      question: '',
      draft: '',
    },
  };
}

function createWindowedBrowseModel({
  bootstrap,
  inspectCache,
  loadBrowseWindow,
  loadChronologyEntries,
}) {
  return {
    mode: 'windowed',
    entries: bootstrap?.current ? [bootstrap.current] : [],
    inspectCache,
    inspectLoadingEntryId: null,
    currentIndex: 0,
    currentWindow: bootstrap ?? null,
    chronologyLoaded: false,
    chronologyLoading: false,
    loadBrowseWindow,
    loadChronologyEntries,
    columns: process.stdout.columns ?? DEFAULT_COLUMNS,
    rows: process.stdout.rows ?? DEFAULT_ROWS,
    contentScrollY: 0,
    jumpPalette: createJumpPalette([]),
    previousPanelMode: 'none',
    notice: null,
    reflect: {
      status: 'idle',
      entryId: null,
      promptType: null,
      question: '',
      draft: '',
    },
  };
}

function resizeBrowseModel(model, columns, rows) {
  return {
    ...model,
    columns,
    rows,
  };
}

function resolveInitialIndex(entries, initialEntryId) {
  if (!initialEntryId) {
    return 0;
  }

  const index = entries.findIndex((entry) => entry.id === initialEntryId);
  return index === -1 ? 0 : index;
}

function applyBrowseAction(model, action) {
  switch (action.type) {
    case 'move': {
      if (model.mode === 'windowed') {
        const neighbors = resolveNeighbors(model);
        const targetEntry = action.delta > 0 ? neighbors.older : neighbors.newer;

        if (!targetEntry) {
          return {
            model,
            effect: null,
          };
        }

        return queueBrowseWindowLoad(model, targetEntry.id);
      }

      const nextIndex = clamp(model.currentIndex + action.delta, 0, model.entries.length - 1);
      return {
        model: {
          ...model,
          currentIndex: nextIndex,
          contentScrollY: 0,
        },
        effect: null,
      };
    }
    case 'jump': {
      if (model.mode === 'windowed') {
        if (!model.chronologyLoaded) {
          return queueChronologyLoad({
            ...model,
            panelMode: model.panelMode === 'jump' ? 'jump' : model.panelMode,
            notice: action.target === 'oldest'
              ? 'Loading chronology to jump to the oldest thought...'
              : 'Loading chronology to jump to the newest thought...',
          });
        }

        const targetEntry = action.target === 'oldest'
          ? model.entries.at(-1)
          : model.entries[0];

        if (!targetEntry) {
          return {
            model,
            effect: null,
          };
        }

        return queueBrowseWindowLoad(model, targetEntry.id, { panelMode: 'none' });
      }

      const nextIndex = action.target === 'oldest' ? model.entries.length - 1 : 0;
      return {
        model: {
          ...model,
          currentIndex: nextIndex,
          contentScrollY: 0,
          notice: null,
        },
        effect: null,
      };
    }
    case 'session_move': {
      const sessionTraversal = resolveSessionTraversal(model);
      const targetEntry = action.direction === 'previous'
        ? sessionTraversal.previous
        : sessionTraversal.next;

      if (!targetEntry) {
        return {
          model: {
            ...model,
            notice: action.direction === 'previous'
              ? 'No previous thought in this session.'
              : 'No next thought in this session.',
          },
          effect: null,
        };
      }

      if (model.mode === 'windowed') {
        return queueBrowseWindowLoad(model, targetEntry.id);
      }

      const nextIndex = model.entries.findIndex((entry) => entry.id === targetEntry.id);
      if (nextIndex === -1) {
        return {
          model,
          effect: null,
        };
      }

      return {
        model: {
          ...model,
          currentIndex: nextIndex,
          contentScrollY: 0,
          notice: null,
        },
        effect: null,
      };
    }
    case 'toggle_inspect':
      return {
        model: {
          ...model,
          panelMode: model.panelMode === 'inspect' ? 'none' : 'inspect',
          contentScrollY: 0,
          notice: null,
        },
        effect: null,
      };
    case 'toggle_session':
      return {
        model: {
          ...model,
          panelMode: model.panelMode === 'session' ? 'none' : 'session',
          contentScrollY: 0,
          notice: null,
        },
        effect: null,
      };
    case 'toggle_log':
      if (model.mode === 'windowed' && model.panelMode !== 'log' && !model.chronologyLoaded) {
        return queueChronologyLoad({
          ...model,
          panelMode: 'log',
          contentScrollY: 0,
          notice: null,
        });
      }
      return {
        model: {
          ...model,
          panelMode: model.panelMode === 'log' ? 'none' : 'log',
          contentScrollY: 0,
          notice: null,
        },
        effect: null,
      };
    case 'open_jump':
      if (model.mode === 'windowed' && !model.chronologyLoaded) {
        return queueChronologyLoad({
          ...model,
          panelMode: 'jump',
          contentScrollY: 0,
          notice: null,
        }, action.query ?? '');
      }
      return {
        model: {
          ...model,
          panelMode: 'jump',
          jumpPalette: cpFilter(createJumpPalette(resolveJumpEntries(model)), action.query ?? ''),
          contentScrollY: 0,
          notice: null,
        },
        effect: null,
      };
    case 'apply_jump_target': {
      if (!action.entryId) {
        return {
          model,
          effect: null,
        };
      }

      if (model.mode === 'windowed') {
        return queueBrowseWindowLoad(model, action.entryId, { panelMode: 'none' });
      }

      const nextIndex = model.entries.findIndex((entry) => entry.id === action.entryId);
      if (nextIndex === -1) {
        return {
          model,
          effect: null,
        };
      }

      return {
        model: {
          ...model,
          currentIndex: nextIndex,
          panelMode: 'none',
          contentScrollY: 0,
          notice: null,
        },
        effect: null,
      };
    }
    case 'close_panel':
      return {
        model: {
          ...model,
          panelMode: 'none',
          notice: null,
        },
        effect: null,
      };
    case 'scroll': {
      const state = getCurrentViewportState(model);
      const nextState = action.direction === 'down'
        ? pageDown(state)
        : pageUp(state);
      return {
        model: {
          ...model,
          contentScrollY: nextState.y,
          notice: null,
        },
        effect: null,
      };
    }
    case 'reflect':
      return {
        model: openReflectModel(model, action.promptType ?? null),
        effect: null,
        cmds: action.previewReflectEntry
          ? [createReflectPreviewCommand(currentEntry(model).id, action.promptType ?? null, action.previewReflectEntry)]
          : [],
      };
    case 'escape':
      if (model.panelMode !== 'none') {
        return {
          model: {
            ...model,
            panelMode: 'none',
          },
          effect: null,
        };
      }
      return {
        model,
        effect: { type: 'quit' },
      };
    case 'quit':
      return {
        model,
        effect: { type: 'quit' },
      };
    default:
      return {
        model,
        effect: null,
      };
  }
}

function handleJumpKey(model, msg) {
  if (model.panelMode !== 'jump') {
    return null;
  }

  if (msg.key === 'escape') {
    return applyBrowseAction(model, { type: 'close_panel' });
  }

  if (msg.key === 'enter') {
    return applyBrowseAction(model, {
      type: 'apply_jump_target',
      entryId: cpSelectedItem(model.jumpPalette)?.id ?? null,
    });
  }

  if (msg.key === 'backspace') {
    return {
      model: {
        ...model,
        jumpPalette: cpFilter(
          createJumpPalette(resolveJumpEntries(model)),
          model.jumpPalette.query.slice(0, -1)
        ),
      },
      effect: null,
    };
  }

  if (msg.key === 'down' || (msg.ctrl && msg.key === 'n')) {
    return {
      model: {
        ...model,
        jumpPalette: cpFocusNext(model.jumpPalette),
      },
      effect: null,
    };
  }

  if (msg.key === 'up' || (msg.ctrl && msg.key === 'p')) {
    return {
      model: {
        ...model,
        jumpPalette: cpFocusPrev(model.jumpPalette),
      },
      effect: null,
    };
  }

  if (msg.key === 'pagedown' || (msg.ctrl && msg.key === 'd')) {
    return {
      model: {
        ...model,
        jumpPalette: cpPageDown(model.jumpPalette),
      },
      effect: null,
    };
  }

  if (msg.key === 'pageup' || (msg.ctrl && msg.key === 'u')) {
    return {
      model: {
        ...model,
        jumpPalette: cpPageUp(model.jumpPalette),
      },
      effect: null,
    };
  }

  const character = keyMsgToPrintableChar(msg);
  if (!character) {
    return {
      model,
      effect: null,
    };
  }

  return {
    model: {
      ...model,
      jumpPalette: cpFilter(
        createJumpPalette(resolveJumpEntries(model)),
        `${model.jumpPalette.query}${character}`
      ),
    },
    effect: null,
  };
}

function handleReflectKey(model, msg) {
  if (model.panelMode !== 'reflect') {
    return null;
  }

  if (model.reflect.status === 'loading' || model.reflect.status === 'saving') {
    return {
      model,
      effect: null,
      cmds: [],
    };
  }

  if (msg.key === 'escape') {
    return {
      model: closeReflectModel(model, null),
      effect: null,
      cmds: [],
    };
  }

  if (msg.key === 'backspace') {
    return {
      model: {
        ...model,
        reflect: {
          ...model.reflect,
          draft: model.reflect.draft.slice(0, -1),
        },
      },
      effect: null,
      cmds: [],
    };
  }

  if (msg.key === 'enter') {
    if (model.reflect.draft.trim() === '') {
      return {
        model: closeReflectModel(model, 'Reflect skipped'),
        effect: null,
        cmds: [],
      };
    }

    if (!model.reflect.startReflectSession || !model.reflect.saveReflectSessionResponse) {
      return {
        model: closeReflectModel(model, 'Reflect is not available in this shell'),
        effect: null,
        cmds: [],
      };
    }

    return {
      model: {
        ...model,
        reflect: {
          ...model.reflect,
          status: 'saving',
        },
      },
      effect: null,
      cmds: [
        createReflectSaveCommand(
          currentEntry(model).id,
          model.reflect.promptType,
          model.reflect.draft,
          model.reflect.startReflectSession,
          model.reflect.saveReflectSessionResponse,
          model.reflect.loadInspectEntry
        ),
      ],
    };
  }

  const character = keyMsgToPrintableChar(msg);
  if (!character) {
    return {
      model,
      effect: null,
      cmds: [],
    };
  }

  return {
    model: {
      ...model,
      reflect: {
        ...model.reflect,
        draft: `${model.reflect.draft}${character}`,
      },
    },
    effect: null,
    cmds: [],
  };
}

function keyMsgToPrintableChar(msg) {
  if (msg.ctrl || msg.alt) {
    return null;
  }

  if (msg.key === 'space') {
    return ' ';
  }

  if (msg.key.length !== 1) {
    return null;
  }

  if (msg.shift && /^[a-z]$/.test(msg.key)) {
    return msg.key.toUpperCase();
  }

  return msg.key;
}

function normalizeScriptAction(rawAction) {
  if (typeof rawAction === 'object' && rawAction !== null) {
    if (rawAction.type === 'reflect') {
      return {
        type: 'reflect',
        promptType: rawAction.mode ?? null,
      };
    }
    return rawAction;
  }

  switch (rawAction) {
    case 'older':
      return { type: 'move', delta: 1 };
    case 'newer':
      return { type: 'move', delta: -1 };
    case 'session_previous':
      return { type: 'session_move', direction: 'previous' };
    case 'session_next':
      return { type: 'session_move', direction: 'next' };
    case 'inspect':
      return { type: 'toggle_inspect' };
    case 'session':
      return { type: 'toggle_session' };
    case 'log':
      return { type: 'toggle_log' };
    case 'quit':
      return { type: 'quit' };
    case 'reflect':
      return { type: 'reflect', promptType: null };
    default:
      return { type: 'quit' };
  }
}

function isScriptJumpAction(rawAction) {
  return typeof rawAction === 'object'
    && rawAction !== null
    && rawAction.type === 'jump';
}

function renderBrowseModel(model) {
  const layout = resolveLayout(model);
  const help = resolveHelpLine(model);
  const counter = resolveBrowseCounter(model);
  const background = flex(
    { direction: 'column', width: model.columns, height: model.rows },
    {
      basis: 1,
      content: counter
        ? `${styleTitle('THINK BROWSE')} ${styleDim(counter)}`
        : styleTitle('THINK BROWSE'),
    },
    {
      flex: 1,
      content: (width, height) => flex(
        {
          direction: 'column',
          width,
          height,
          gap: 0,
        },
        {
          flex: 1,
          content: (paneWidth, paneHeight) => renderThoughtPane(model, paneWidth, paneHeight),
        }
      ),
    },
    {
      basis: 1,
      content: styleDim(truncatePlain(help, model.columns)),
    }
  );

  const overlays = [];

  if (model.panelMode !== 'none' && model.panelMode !== 'reflect') {
    overlays.push(drawer({
      anchor: 'bottom',
      title: resolveDrawerTitle(model.panelMode),
      content: renderDrawerContent(model, layout),
      screenWidth: model.columns,
      screenHeight: model.rows,
      region: {
        row: 1,
        col: 0,
        width: model.columns,
        height: layout.bodyHeight,
      },
      height: layout.panelHeight,
    }));
  }

  if (model.panelMode === 'reflect') {
    overlays.push(modal({
      title: 'REFLECT',
      body: renderReflectModalBody(model, Math.max(48, Math.min(model.columns - 8, 92))),
      hint: resolveReflectHint(model),
      screenWidth: model.columns,
      screenHeight: model.rows,
      width: Math.max(48, Math.min(model.columns - 8, 92)),
    }));
  }

  if (overlays.length === 0) {
    return background;
  }

  return composite(background, overlays, { dim: model.panelMode === 'reflect' });
}

function renderThoughtPane(model, width, height) {
  const content = buildThoughtContent(model, width);
  const state = createScrollState(content, height);
  const scrollY = clamp(model.contentScrollY, 0, state.maxY);
  return viewport({
    width,
    height,
    content,
    scrollY,
  });
}

function renderBottomPanel(model, width, height) {
  switch (model.panelMode) {
    case 'inspect':
      return renderInspectPane(model, width, height);
    case 'session':
      return renderSessionPane(model, width, height);
    case 'log':
      return renderLogPane(model, width, height);
    case 'jump':
      return renderJumpPane(model, width, height);
    default:
      return viewport({
        width,
        height,
        content: '',
        scrollY: 0,
      });
  }
}

function renderDrawerContent(model, layout) {
  const innerWidth = Math.max(1, model.columns - 4);
  const innerHeight = Math.max(1, layout.panelHeight - 2);
  return renderBottomPanel(model, innerWidth, innerHeight);
}

function renderInspectPane(model, width, height) {
  const inspectEntry = currentInspectEntry(model);
  const lines = [];
  const entry = currentEntry(model);

  if (!inspectEntry) {
    lines.push(styleDim(
      model.inspectLoadingEntryId === entry.id
        ? 'Loading inspect receipts...'
        : 'Inspect data not loaded yet.'
    ));
  } else {
    lines.push(`Thought ID: ${inspectEntry.thoughtId}`);
    lines.push(`Entry ID: ${inspectEntry.entryId}`);
    lines.push(`Kind: ${inspectEntry.kind}`);
    lines.push(`Sort Key: ${inspectEntry.sortKey}`);
    lines.push('');
    lines.push(styleSection('RECEIPTS'));

    if (inspectEntry.derivedReceipts.length === 0) {
      lines.push(styleDim('No direct derived receipts yet.'));
    } else {
      for (const receipt of inspectEntry.derivedReceipts) {
        lines.push(
          wrapLine(
            `Reflect: ${receipt.entryId} (${receipt.promptType}, ${receipt.relation}, session ${receipt.sessionId})`,
            width
          )
        );
      }
    }
  }

  return viewport({
    width,
    height,
    content: lines.join('\n'),
    scrollY: 0,
  });
}

function renderSessionPane(model, width, height) {
  const entry = currentEntry(model);
  const sessionTraversal = resolveSessionTraversal(model);
  const sessionEntries = sessionTraversal.entries;
  const lines = [];

  if (!entry.sessionId) {
    lines.push(styleDim('Session context is not available for this thought yet.'));
  } else {
    lines.push(`Session ID: ${entry.sessionId}`);
    if (sessionEntries[0]?.createdAt) {
      lines.push(`Started: ${formatWhen(sessionEntries[0].createdAt)}`);
    }
    if (sessionTraversal.position && sessionTraversal.count) {
      lines.push(`Session Position: ${sessionTraversal.position} of ${sessionTraversal.count}`);
    }
    lines.push('');

    if (sessionEntries.length === 0) {
      lines.push(styleDim('Session entries are not available for this thought yet.'));
    } else {
      const currentIndex = sessionEntries.findIndex((candidate) => candidate.id === entry.id);

      for (const [index, sessionEntry] of sessionEntries.entries()) {
        const timestamp = formatCompactWhen(sessionEntry.createdAt);
        const summary = wrapLine(
          `${formatSessionEntryLabel(sessionEntry, entry.id, index, currentIndex)} ${formatVisibleEntryId(sessionEntry.id)} ${timestamp} ${normalizeWhitespace(sessionEntry.text)}`,
          width
        );
        lines.push(summary);
        if (index + 1 < sessionEntries.length) {
          lines.push('');
        }
      }
    }
  }

  return viewport({
    width,
    height,
    content: lines.join('\n'),
    scrollY: 0,
  });
}

function renderLogPane(model, width, height) {
  if (model.mode === 'windowed' && !model.chronologyLoaded) {
    return viewport({
      width,
      height,
      content: model.chronologyLoading
        ? styleDim('Loading thought log...')
        : styleDim('Thought log is not loaded yet.'),
      scrollY: 0,
    });
  }

  const lines = [];

  for (const [index, entry] of model.entries.entries()) {
    const prefix = index === model.currentIndex ? styleTitle('>') : styleDim(' ');
    const timestamp = formatCompactWhen(entry.createdAt);
    const label = truncatePlain(normalizeWhitespace(entry.text), Math.max(10, width - timestamp.length - 4));
    lines.push(`${prefix} ${timestamp} ${label}`);
  }

  return viewport({
    width,
    height,
    content: lines.join('\n'),
    scrollY: computeLogScroll(model, height),
  });
}

function renderJumpPane(model, width, height) {
  if (model.mode === 'windowed' && !model.chronologyLoaded) {
    return viewport({
      width,
      height,
      content: model.chronologyLoading
        ? styleDim('Loading jump candidates...')
        : styleDim('Jump candidates are not loaded yet.'),
      scrollY: 0,
    });
  }

  const lines = [commandPalette(model.jumpPalette, {
    width,
    showCategory: false,
    showShortcut: false,
  })];

  return viewport({
    width,
    height,
    content: lines.join('\n'),
    scrollY: 0,
  });
}

function renderReflectModalBody(model, width) {
  const lines = [];

  if (model.reflect.status === 'loading') {
    lines.push('Preparing reflect prompt...');
    return lines.join('\n');
  }

  if (model.reflect.status === 'saving') {
    lines.push('Saving reflect response...');
    return lines.join('\n');
  }

  lines.push(`Mode: ${capitalize(model.reflect.promptType ?? 'challenge')}`);
  lines.push('');
  lines.push('Question:');
  lines.push(wrapParagraphs(model.reflect.question, width - 4));
  lines.push('');
  lines.push('Response:');
  lines.push(
    wrapParagraphs(
      model.reflect.draft.length > 0 ? model.reflect.draft : '(type your reflect response)',
      width - 4
    )
  );

  return lines.join('\n');
}

function buildThoughtContent(model, width) {
  const entry = currentEntry(model);
  const neighbors = resolveNeighbors(model);
  const sessionTraversal = resolveSessionTraversal(model);
  const chronologyPosition = resolveChronologyPosition(model);
  const lines = [
    styleSection('THOUGHT'),
    '',
    `When: ${formatWhen(entry.createdAt)}`,
    `Relative: ${formatRelativeTime(entry.createdAt)}`,
    ...(chronologyPosition ? [`Position: ${chronologyPosition}`] : []),
    `Entry ID: ${formatVisibleEntryId(entry.id)}`,
    `Session: ${entry.sessionId ?? 'pending'}`,
    `Session Position: ${formatSessionPosition(sessionTraversal)}`,
    '',
    wrapParagraphs(entry.text, width),
    '',
    styleSection('NEIGHBORS'),
    '',
    wrapLine(`Newer: ${neighbors.newer ? neighbors.newer.text : 'none'}`, width),
    wrapLine(`Older: ${neighbors.older ? neighbors.older.text : 'none'}`, width),
    '',
    styleSection('SESSION'),
    '',
    wrapLine(
      `Previous in session: ${sessionTraversal.previous ? sessionTraversal.previous.text : 'none'}`,
      width
    ),
    wrapLine(
      `Next in session: ${sessionTraversal.next ? sessionTraversal.next.text : 'none'}`,
      width
    ),
  ];

  return lines.join('\n');
}

function getCurrentViewportState(model) {
  const layout = resolveLayout(model);
  const content = buildThoughtContent(model, layout.bodyWidth);
  return createScrollState(content, layout.thoughtHeight);
}

function resolveLayout(model) {
  const bodyHeight = Math.max(1, model.rows - 2);
  const panelHeight = resolvePanelHeight(bodyHeight);
  const thoughtHeight = bodyHeight;

  return {
    bodyHeight,
    bodyWidth: model.columns,
    panelHeight,
    thoughtHeight,
  };
}

function resolvePanelHeight(bodyHeight) {
  const target = Math.floor(bodyHeight * 0.35);
  return clamp(target, 6, Math.max(6, bodyHeight - 8));
}

function resolveNeighbors(model) {
  if (model.mode === 'windowed' && model.currentWindow) {
    return {
      newer: model.currentWindow.newer ?? null,
      older: model.currentWindow.older ?? null,
    };
  }

  return {
    newer: model.currentIndex > 0 ? model.entries[model.currentIndex - 1] : null,
    older: model.currentIndex + 1 < model.entries.length ? model.entries[model.currentIndex + 1] : null,
  };
}

function resolveSessionTraversal(model) {
  const entry = currentEntry(model);

  if (model.mode === 'windowed' && model.currentWindow) {
    const sessionContext = model.currentWindow.sessionContext;
    const previous = model.currentWindow.sessionSteps
      .find((step) => step.direction === 'previous') ?? null;
    const next = model.currentWindow.sessionSteps
      .find((step) => step.direction === 'next') ?? null;

    return {
      entries: [entry, ...model.currentWindow.sessionEntries].sort(compareEntriesOldestFirst),
      count: sessionContext?.sessionCount ?? model.currentWindow.sessionEntries.length + 1,
      position: sessionContext?.sessionPosition ?? null,
      previous,
      next,
    };
  }

  if (!entry?.sessionId) {
    return {
      entries: [],
      count: 0,
      position: null,
      previous: null,
      next: null,
    };
  }

  const sessionEntries = model.entries
    .filter((candidate) => candidate.sessionId === entry.sessionId)
    .sort(compareEntriesOldestFirst);
  const sessionIndex = sessionEntries.findIndex((candidate) => candidate.id === entry.id);

  if (sessionIndex === -1) {
    return {
      entries: sessionEntries,
      count: sessionEntries.length,
      position: null,
      previous: null,
      next: null,
    };
  }

  return {
    entries: sessionEntries,
    count: sessionEntries.length,
    position: sessionIndex + 1,
    previous: sessionIndex > 0 ? sessionEntries[sessionIndex - 1] : null,
    next: sessionIndex + 1 < sessionEntries.length ? sessionEntries[sessionIndex + 1] : null,
  };
}

function currentEntry(model) {
  if (model.mode === 'windowed' && model.currentWindow?.current) {
    return model.currentWindow.current;
  }
  return model.entries[model.currentIndex];
}

function currentInspectEntry(model) {
  return model.inspectCache.get(currentEntry(model).id) ?? null;
}

function createJumpPalette(entries) {
  return createCommandPaletteState(
    entries.map((entry) => ({
      id: entry.id,
      label: normalizeWhitespace(entry.text),
      description: formatCompactWhen(entry.createdAt),
    })),
    DEFAULT_JUMP_HEIGHT
  );
}

function computeLogScroll(model, height) {
  if (model.mode === 'windowed' && !model.chronologyLoaded) {
    return 0;
  }

  const selectedLine = 2 + model.currentIndex;
  const visibleHeight = Math.max(1, height);
  const target = selectedLine - Math.floor(visibleHeight / 2);
  const maxY = Math.max(0, model.entries.length + 2 - visibleHeight);
  return clamp(target, 0, maxY);
}

function resolveHelpLine(model) {
  if (model.panelMode === 'reflect') {
    return model.notice
      ? `${model.notice} • Type to respond • Enter save • Backspace delete • Esc cancel`
      : 'Type to respond • Enter save • Backspace delete • Esc cancel';
  }

  if (model.panelMode === 'jump') {
    return 'Type to filter • ↑/↓ move • Enter open • Backspace erase • Esc close';
  }

  const help = helpShort(browseKeymap);
  return model.notice ? `${model.notice} • ${help}` : help;
}

function resolveBrowseCounter(model) {
  if (model.mode === 'windowed' && !model.chronologyLoaded) {
    return null;
  }

  return `(${model.currentIndex + 1}/${model.entries.length})`;
}

function resolveChronologyPosition(model) {
  if (model.mode === 'windowed' && !model.chronologyLoaded) {
    return null;
  }

  return `${model.currentIndex + 1} of ${model.entries.length}`;
}

function resolveJumpEntries(model) {
  if (model.mode !== 'windowed') {
    return model.entries;
  }

  return model.chronologyLoaded ? model.entries : [];
}

function queueBrowseWindowLoad(model, entryId, overrides = {}) {
  if (!model.loadBrowseWindow) {
    return {
      model,
      effect: null,
    };
  }

  return {
    model: {
      ...model,
      notice: null,
      contentScrollY: 0,
      ...overrides,
    },
    effect: null,
    cmds: [createBrowseWindowLoadCommand(entryId, model.loadBrowseWindow)],
  };
}

function queueChronologyLoad(model, query = null) {
  if (!model.loadChronologyEntries || model.chronologyLoaded || model.chronologyLoading) {
    return {
      model: {
        ...model,
        panelMode: model.panelMode,
      },
      effect: null,
    };
  }

  return {
    model: {
      ...model,
      chronologyLoading: true,
      jumpPalette: query != null ? cpFilter(createJumpPalette([]), query) : model.jumpPalette,
    },
    effect: null,
    cmds: [createChronologyLoadCommand(model.loadChronologyEntries, query)],
  };
}

function createBrowseWindowLoadCommand(entryId, loadBrowseWindow) {
  return async (emit) => {
    const browseWindow = await loadBrowseWindow(entryId);
    emit({
      type: 'browse_window_loaded',
      entryId,
      browseWindow,
    });
  };
}

function createChronologyLoadCommand(loadChronologyEntries, query) {
  return async (emit) => {
    const entries = await loadChronologyEntries();
    emit({
      type: 'chronology_loaded',
      entries,
      query,
    });
  };
}

function applyBrowseWindowLoaded(model, msg, loadInspectEntry) {
  if (!msg.browseWindow?.ok && !msg.browseWindow?.current && msg.browseWindow !== null) {
    return [model, []];
  }

  const nextWindow = msg.browseWindow;
  if (!nextWindow?.current) {
    return [model, []];
  }

  const nextEntries = model.chronologyLoaded
    ? model.entries
    : [nextWindow.current];
  const nextIndex = nextEntries.findIndex((entry) => entry.id === nextWindow.current.id);

  const nextModel = {
    ...model,
    currentWindow: nextWindow,
    entries: nextEntries,
    currentIndex: nextIndex === -1 ? 0 : nextIndex,
    contentScrollY: 0,
    notice: null,
  };

  return maybeQueueInspectLoad(nextModel, loadInspectEntry);
}

function applyChronologyLoaded(model, msg) {
  const entries = msg.entries ?? [];
  const currentId = currentEntry(model)?.id ?? null;
  const nextIndex = currentId
    ? Math.max(0, entries.findIndex((entry) => entry.id === currentId))
    : 0;

  return {
    ...model,
    chronologyLoaded: true,
    chronologyLoading: false,
    entries,
    currentIndex: nextIndex,
    jumpPalette: cpFilter(createJumpPalette(entries), msg.query ?? model.jumpPalette.query ?? ''),
    notice: null,
  };
}

function resolveDrawerTitle(panelMode) {
  switch (panelMode) {
    case 'inspect':
      return 'INSPECT';
    case 'session':
      return 'SESSION';
    case 'log':
      return 'THOUGHT LOG';
    case 'jump':
      return 'JUMP';
    default:
      return '';
  }
}

function wrapParagraphs(text, width) {
  return String(text)
    .split(/\n+/)
    .map((paragraph) => wrapLine(paragraph, width))
    .join('\n');
}

function wrapLine(text, width) {
  const safeWidth = Math.max(8, width);
  const words = normalizeWhitespace(text).split(' ');
  const lines = [];
  let current = '';

  for (const word of words) {
    if (current.length === 0) {
      current = word;
      continue;
    }

    if ((current + ' ' + word).length <= safeWidth) {
      current += ` ${word}`;
    } else {
      lines.push(current);
      current = word.length > safeWidth
        ? chunkWord(word, safeWidth)
        : word;
    }
  }

  if (current.length > 0) {
    lines.push(current);
  }

  return lines.flatMap((line) => line.split('\n')).join('\n');
}

function chunkWord(word, width) {
  const chunks = [];
  for (let index = 0; index < word.length; index += width) {
    chunks.push(word.slice(index, index + width));
  }
  return chunks.join('\n');
}

function formatWhen(createdAt) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(createdAt));
  } catch {
    return String(createdAt);
  }
}

function formatCompactWhen(createdAt) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(createdAt));
  } catch {
    return String(createdAt);
  }
}

function formatRelativeTime(createdAt) {
  const timestamp = new Date(createdAt);
  const deltaMs = timestamp.getTime() - Date.now();
  const absMs = Math.abs(deltaMs);
  const rtf = new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' });

  if (absMs < 60_000) {
    return rtf.format(Math.round(deltaMs / 1000), 'second');
  }

  if (absMs < 3_600_000) {
    return rtf.format(Math.round(deltaMs / 60_000), 'minute');
  }

  if (absMs < 86_400_000) {
    return rtf.format(Math.round(deltaMs / 3_600_000), 'hour');
  }

  return rtf.format(Math.round(deltaMs / 86_400_000), 'day');
}

function normalizeWhitespace(text) {
  return String(text).replace(/\s+/g, ' ').trim();
}

function truncatePlain(text, width) {
  const safeWidth = Math.max(1, width);
  const normalized = normalizeWhitespace(text);
  if (normalized.length <= safeWidth) {
    return normalized;
  }
  if (safeWidth <= 1) {
    return '…';
  }
  return `${normalized.slice(0, safeWidth - 1)}…`;
}

function formatVisibleEntryId(entryId) {
  const value = String(entryId ?? '').trim();
  if (!value) {
    return 'pending';
  }
  return value.slice(0, 12);
}

function formatSessionEntryLabel(sessionEntry, currentEntryId, index, currentIndex) {
  if (sessionEntry.id === currentEntryId) {
    return 'Current:';
  }
  if (index === 0) {
    return 'Start:';
  }
  if (currentIndex !== -1 && index < currentIndex) {
    return 'Earlier:';
  }
  if (currentIndex !== -1 && index > currentIndex) {
    return 'Later:';
  }
  return 'Thought:';
}

function styleTitle(text) {
  return `${ANSI.bold}${ANSI.cyan}${text}${ANSI.reset}`;
}

function styleSection(text) {
  return `${ANSI.bold}${ANSI.yellow}${text}${ANSI.reset}`;
}

function styleDim(text) {
  return `${ANSI.dim}${text}${ANSI.reset}`;
}

function capitalize(text) {
  return String(text).charAt(0).toUpperCase() + String(text).slice(1);
}

function compareEntriesOldestFirst(left, right) {
  if (left.sortKey === right.sortKey) {
    return left.id.localeCompare(right.id);
  }

  return left.sortKey.localeCompare(right.sortKey);
}

function formatSessionPosition(sessionTraversal) {
  if (!sessionTraversal.position || !sessionTraversal.count) {
    return 'pending';
  }

  return `${sessionTraversal.position} of ${sessionTraversal.count}`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function maybeQueueInspectLoad(model, loadInspectEntry) {
  if (!loadInspectEntry) {
    return [model, []];
  }

  const entryId = currentEntry(model).id;
  if (model.panelMode !== 'inspect') {
    return [model, []];
  }
  if (model.inspectCache.has(entryId)) {
    return [model, []];
  }
  if (model.inspectLoadingEntryId === entryId) {
    return [model, []];
  }

  return [{
    ...model,
    inspectLoadingEntryId: entryId,
  }, [createInspectLoadCommand(entryId, loadInspectEntry)]];
}

function createInspectLoadCommand(entryId, loadInspectEntry) {
  return async (emit) => {
    const inspectEntry = await loadInspectEntry(entryId);
    emit({
      type: 'inspect_loaded',
      entryId,
      inspectEntry,
    });
  };
}

function openReflectModel(model, promptType = null, deps = {}) {
  return {
    ...model,
    previousPanelMode: model.panelMode === 'reflect' ? model.previousPanelMode : model.panelMode,
    panelMode: 'reflect',
    notice: null,
    reflect: {
      status: 'loading',
      entryId: currentEntry(model).id,
      promptType,
      question: '',
      draft: '',
      previewReflectEntry: deps.previewReflectEntry ?? model.reflect.previewReflectEntry ?? null,
      startReflectSession: deps.startReflectSession ?? model.reflect.startReflectSession ?? null,
      saveReflectSessionResponse: deps.saveReflectSessionResponse ?? model.reflect.saveReflectSessionResponse ?? null,
      loadInspectEntry: deps.loadInspectEntry ?? model.reflect.loadInspectEntry ?? null,
    },
  };
}

function closeReflectModel(model, notice = null) {
  return {
    ...model,
    panelMode: model.previousPanelMode ?? 'none',
    previousPanelMode: 'none',
    notice,
    reflect: {
      status: 'idle',
      entryId: null,
      promptType: null,
      question: '',
      draft: '',
      previewReflectEntry: model.reflect.previewReflectEntry ?? null,
      startReflectSession: model.reflect.startReflectSession ?? null,
      saveReflectSessionResponse: model.reflect.saveReflectSessionResponse ?? null,
      loadInspectEntry: model.reflect.loadInspectEntry ?? null,
    },
  };
}

function applyReflectPreviewed(model, msg) {
  if (!msg.result?.ok) {
    return closeReflectModel(model, formatReflectFailureMessage(msg.result));
  }

  return {
    ...model,
    panelMode: 'reflect',
    reflect: {
      ...model.reflect,
      status: 'ready',
      promptType: msg.result.promptType,
      question: msg.result.question,
    },
  };
}

function applyReflectSaved(model, msg) {
  let nextModel = closeReflectModel(model, 'Reflect saved');
  if (msg.inspectEntry) {
    const nextCache = new Map(nextModel.inspectCache);
    nextCache.set(msg.entryId, msg.inspectEntry);
    nextModel = {
      ...nextModel,
      inspectCache: nextCache,
    };
  }
  return nextModel;
}

function applyReflectFailed(model, msg) {
  return closeReflectModel(model, msg.message ?? 'Reflect failed');
}

function clearNoticeOnKey(model) {
  if (!model.notice) {
    return model;
  }

  return {
    ...model,
    notice: null,
  };
}

function createReflectPreviewCommand(entryId, promptType, previewReflectEntry) {
  return async (emit) => {
    const result = await previewReflectEntry(entryId, promptType);
    emit({
      type: 'reflect_previewed',
      entryId,
      result,
    });
  };
}

function createReflectSaveCommand(
  entryId,
  promptType,
  response,
  startReflectSession,
  saveReflectSessionResponse,
  loadInspectEntry
) {
  return async (emit) => {
    const session = await startReflectSession(entryId, promptType);
    if (!session?.ok) {
      emit({
        type: 'reflect_failed',
        entryId,
        message: formatReflectFailureMessage(session),
      });
      return;
    }

    const saved = await saveReflectSessionResponse(session.sessionId, response);
    if (!saved) {
      emit({
        type: 'reflect_failed',
        entryId,
        message: 'Reflect session could not be saved',
      });
      return;
    }

    const inspectEntry = loadInspectEntry ? await loadInspectEntry(entryId) : null;
    emit({
      type: 'reflect_saved',
      entryId,
      sessionId: session.sessionId,
      savedEntryId: saved.id,
      inspectEntry,
    });
  };
}

function formatReflectFailureMessage(result) {
  if (!result) {
    return 'Reflect failed';
  }

  if (result.code === 'seed_not_found') {
    return 'Seed entry not found';
  }

  if (result.code === 'seed_ineligible') {
    return result.eligibility?.text ?? 'This thought is not a good reflect seed';
  }

  return 'Reflect failed';
}

function resolveReflectHint(model) {
  if (model.reflect.status === 'loading') {
    return 'Preparing prompt...';
  }
  if (model.reflect.status === 'saving') {
    return 'Saving...';
  }
  return 'Type to respond • Enter save • Backspace delete • Esc cancel';
}

function isScriptReflectAction(rawAction) {
  return typeof rawAction === 'object'
    && rawAction !== null
    && rawAction.type === 'reflect';
}

async function runScriptReflectAction(model, rawAction, deps) {
  const frames = [];
  const openedModel = openReflectModel(model, rawAction.mode ?? null, deps);
  frames.push(renderBrowseModel(openedModel));

  const previewResult = deps.previewReflectEntry
    ? await deps.previewReflectEntry(currentEntry(openedModel).id, rawAction.mode ?? null)
    : {
        ok: false,
        code: 'seed_not_found',
      };
  let nextModel = applyReflectPreviewed(openedModel, {
    type: 'reflect_previewed',
    entryId: currentEntry(openedModel).id,
    result: previewResult,
  });
  frames.push(renderBrowseModel(nextModel));

  if (!previewResult.ok) {
    return {
      model: nextModel,
      frames,
    };
  }

  nextModel = {
    ...nextModel,
    reflect: {
      ...nextModel.reflect,
      draft: rawAction.response ?? '',
    },
  };
  frames.push(renderBrowseModel(nextModel));

  if ((rawAction.response ?? '').trim() === '') {
    return {
      model: closeReflectModel(nextModel, 'Reflect skipped'),
      frames: [...frames, renderBrowseModel(closeReflectModel(nextModel, 'Reflect skipped'))],
    };
  }

  const session = await deps.startReflectSession(currentEntry(nextModel).id, nextModel.reflect.promptType);
  if (!session?.ok) {
    const failedModel = applyReflectFailed(nextModel, {
      type: 'reflect_failed',
      entryId: currentEntry(nextModel).id,
      message: formatReflectFailureMessage(session),
    });
    return {
      model: failedModel,
      frames: [...frames, renderBrowseModel(failedModel)],
    };
  }

  const saved = await deps.saveReflectSessionResponse(session.sessionId, rawAction.response);
  const inspectEntry = deps.loadInspectEntry
    ? await deps.loadInspectEntry(currentEntry(nextModel).id)
    : null;
  const savedModel = applyReflectSaved(nextModel, {
    type: 'reflect_saved',
    entryId: currentEntry(nextModel).id,
    savedEntryId: saved?.id ?? null,
    sessionId: session.sessionId,
    inspectEntry,
  });

  return {
    model: savedModel,
    frames: [...frames, renderBrowseModel(savedModel)],
  };
}
