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
  .group('View', (group) => group
    .bind('i', 'Inspect', { type: 'toggle_inspect' })
    .bind('l', 'Log', { type: 'toggle_log' })
    .bind('/', 'Jump', { type: 'open_jump' })
    .bind('pageup', 'Scroll up', { type: 'scroll', direction: 'up' })
    .bind('pagedown', 'Scroll down', { type: 'scroll', direction: 'down' }))
  .group('Actions', (group) => group
    .bind('r', 'Reflect', { type: 'reflect' })
    .bind('q', 'Quit', { type: 'quit' })
    .bind('escape', 'Close/Quit', { type: 'escape' }));

export async function runBrowseTui({ entries, initialEntryId = null, loadInspectEntry = null }) {
  let effect = { type: 'quit' };

  const app = {
    init() {
      return [createBrowseModel({ entries, inspectCache: new Map(), initialEntryId }), []];
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

      if (msg.type !== 'key') {
        return [model, []];
      }

      const jumpResult = handleJumpKey(model, msg);
      if (jumpResult) {
        const [nextModel, cmds] = maybeQueueInspectLoad(jumpResult.model, loadInspectEntry);
        return [nextModel, cmds];
      }

      const action = browseKeymap.handle(msg);
      if (!action) {
        return [model, []];
      }

      const result = applyBrowseAction(model, action);
      if (result.effect?.type === 'quit') {
        effect = result.effect;
        return [result.model, [quit()]];
      }

      if (result.effect?.type === 'reflect') {
        effect = result.effect;
        return [result.model, [quit()]];
      }

      const [nextModel, cmds] = maybeQueueInspectLoad(result.model, loadInspectEntry);
      return [nextModel, cmds];
    },
    view(model) {
      return parseAnsiToSurface(renderBrowseModel(model), model.columns, model.rows);
    },
  };

  await run(app, { ctx: initDefaultContext() });
  return effect;
}

export function runBrowseTuiScript({ entries, inspectById, initialEntryId = null, actions = [] }) {
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

    const action = normalizeScriptAction(rawAction);
    const result = applyBrowseAction(model, action);
    model = result.model;
    frames.push(renderBrowseModel(model));

    if (result.effect) {
      effect = attachScriptPayload(result.effect, rawAction);
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
    entries,
    inspectCache,
    inspectLoadingEntryId: null,
    currentIndex: resolveInitialIndex(entries, initialEntryId),
    panelMode: 'none',
    columns: process.stdout.columns ?? DEFAULT_COLUMNS,
    rows: process.stdout.rows ?? DEFAULT_ROWS,
    contentScrollY: 0,
    jumpPalette: createJumpPalette(entries),
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
      const nextIndex = action.target === 'oldest' ? model.entries.length - 1 : 0;
      return {
        model: {
          ...model,
          currentIndex: nextIndex,
          contentScrollY: 0,
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
        },
        effect: null,
      };
    case 'toggle_log':
      return {
        model: {
          ...model,
          panelMode: model.panelMode === 'log' ? 'none' : 'log',
          contentScrollY: 0,
        },
        effect: null,
      };
    case 'open_jump':
      return {
        model: {
          ...model,
          panelMode: 'jump',
          jumpPalette: cpFilter(createJumpPalette(model.entries), action.query ?? ''),
          contentScrollY: 0,
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
        },
        effect: null,
      };
    }
    case 'close_panel':
      return {
        model: {
          ...model,
          panelMode: 'none',
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
        },
        effect: null,
      };
    }
    case 'reflect':
      return {
        model,
        effect: {
          type: 'reflect',
          entryId: currentEntry(model).id,
        },
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
          createJumpPalette(model.entries),
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
        createJumpPalette(model.entries),
        `${model.jumpPalette.query}${character}`
      ),
    },
    effect: null,
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
      return { type: 'reflect' };
    }
    return rawAction;
  }

  switch (rawAction) {
    case 'older':
      return { type: 'move', delta: 1 };
    case 'newer':
      return { type: 'move', delta: -1 };
    case 'inspect':
      return { type: 'toggle_inspect' };
    case 'log':
      return { type: 'toggle_log' };
    case 'quit':
      return { type: 'quit' };
    case 'reflect':
      return { type: 'reflect' };
    default:
      return { type: 'quit' };
  }
}

function isScriptJumpAction(rawAction) {
  return typeof rawAction === 'object'
    && rawAction !== null
    && rawAction.type === 'jump';
}

function attachScriptPayload(effect, rawAction) {
  if (effect.type !== 'reflect') {
    return effect;
  }

  if (typeof rawAction === 'object' && rawAction !== null) {
    return {
      ...effect,
      scriptedAction: rawAction,
    };
  }

  return effect;
}

function renderBrowseModel(model) {
  const layout = resolveLayout(model);
  const help = resolveHelpLine(model);
  const background = flex(
    { direction: 'column', width: model.columns, height: model.rows },
    {
      basis: 1,
      content: `${styleTitle('THINK BROWSE')} ${styleDim(`(${model.currentIndex + 1}/${model.entries.length})`)}`,
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

  if (model.panelMode === 'none') {
    return background;
  }

  const overlay = drawer({
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
  });

  return composite(background, [overlay]);
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

  if (!inspectEntry) {
    lines.push(styleDim(
      model.inspectLoadingEntryId === currentEntry(model).id
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

function renderLogPane(model, width, height) {
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

function buildThoughtContent(model, width) {
  const entry = currentEntry(model);
  const neighbors = resolveNeighbors(model);
  const lines = [
    styleSection('THOUGHT'),
    '',
    `When: ${formatWhen(entry.createdAt)}`,
    `Relative: ${formatRelativeTime(entry.createdAt)}`,
    `Position: ${model.currentIndex + 1} of ${model.entries.length}`,
    `Entry ID: ${entry.id}`,
    '',
    wrapParagraphs(entry.text, width),
    '',
    styleSection('NEIGHBORS'),
    '',
    wrapLine(`Newer: ${neighbors.newer ? neighbors.newer.text : 'none'}`, width),
    wrapLine(`Older: ${neighbors.older ? neighbors.older.text : 'none'}`, width),
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
  return {
    newer: model.currentIndex > 0 ? model.entries[model.currentIndex - 1] : null,
    older: model.currentIndex + 1 < model.entries.length ? model.entries[model.currentIndex + 1] : null,
  };
}

function currentEntry(model) {
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
  const selectedLine = 2 + model.currentIndex;
  const visibleHeight = Math.max(1, height);
  const target = selectedLine - Math.floor(visibleHeight / 2);
  const maxY = Math.max(0, model.entries.length + 2 - visibleHeight);
  return clamp(target, 0, maxY);
}

function resolveHelpLine(model) {
  if (model.panelMode === 'jump') {
    return 'Type to filter • ↑/↓ move • Enter open • Backspace erase • Esc close';
  }

  return helpShort(browseKeymap);
}

function resolveDrawerTitle(panelMode) {
  switch (panelMode) {
    case 'inspect':
      return 'INSPECT';
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

function styleTitle(text) {
  return `${ANSI.bold}${ANSI.cyan}${text}${ANSI.reset}`;
}

function styleSection(text) {
  return `${ANSI.bold}${ANSI.yellow}${text}${ANSI.reset}`;
}

function styleDim(text) {
  return `${ANSI.dim}${text}${ANSI.reset}`;
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
