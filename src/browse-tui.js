import { initDefaultContext } from '@flyingrobots/bijou-node';
import { parseAnsiToSurface } from '@flyingrobots/bijou';
import {
  createKeyMap,
  createScrollState,
  flex,
  helpShort,
  pageDown,
  pageUp,
  quit,
  run,
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
    .bind('pageup', 'Scroll up', { type: 'scroll', direction: 'up' })
    .bind('pagedown', 'Scroll down', { type: 'scroll', direction: 'down' }))
  .group('Actions', (group) => group
    .bind('r', 'Reflect', { type: 'reflect' })
    .bind('q', 'Quit', { type: 'quit' })
    .bind('escape', 'Quit', { type: 'quit' }));

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
    inspectVisible: false,
    columns: process.stdout.columns ?? DEFAULT_COLUMNS,
    rows: process.stdout.rows ?? DEFAULT_ROWS,
    contentScrollY: 0,
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
          inspectVisible: !model.inspectVisible,
          contentScrollY: 0,
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
    case 'quit':
      return { type: 'quit' };
    case 'reflect':
      return { type: 'reflect' };
    default:
      return { type: 'quit' };
  }
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
  const help = truncatePlain(helpShort(browseKeymap), model.columns);

  return flex(
    { direction: 'column', width: model.columns, height: model.rows },
    {
      basis: 1,
      content: `${styleTitle('THINK BROWSE')} ${styleDim(`(${model.currentIndex + 1}/${model.entries.length})`)}`,
    },
    {
      flex: 1,
      content: (width, height) => flex(
        { direction: 'row', width, height, gap: 2 },
        {
          basis: layout.sidebarWidth,
          content: (sidebarWidth, sidebarHeight) => renderSidebar(model, sidebarWidth, sidebarHeight),
        },
        {
          flex: 1,
          content: (mainWidth, mainHeight) => renderMainColumn(model, mainWidth, mainHeight),
        }
      ),
    },
    {
      basis: 1,
      content: styleDim(truncatePlain(help, model.columns)),
    }
  );
}

function renderSidebar(model, width, height) {
  const currentIndex = model.currentIndex;
  const header = styleSection('RECENT');
  const lines = [header, ''];

  for (const [index, entry] of model.entries.entries()) {
    const prefix = index === currentIndex ? styleTitle('>') : styleDim(' ');
    lines.push(`${prefix} ${renderSidebarLabel(entry.text, width - 2)}`);
  }

  const content = lines.join('\n');
  const scrollY = computeSidebarScroll(model, height);
  return viewport({
    width,
    height,
    content,
    scrollY,
  });
}

function renderSidebarLabel(text, width) {
  const normalized = normalizeWhitespace(text);
  if (width <= 1) {
    return '';
  }
  return truncatePlain(normalized, width);
}

function renderMainColumn(model, width, height) {
  if (model.inspectVisible) {
    const inspectHeight = clamp(Math.floor(height * 0.35), 8, Math.max(8, height - 8));
    return flex(
      { direction: 'column', width, height, gap: 1 },
      {
        flex: 1,
        content: (paneWidth, paneHeight) => renderThoughtPane(model, paneWidth, paneHeight),
      },
      {
        basis: inspectHeight,
        content: (paneWidth, paneHeight) => renderInspectPane(model, paneWidth, paneHeight),
      }
    );
  }

  return renderThoughtPane(model, width, height);
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

function renderInspectPane(model, width, height) {
  const inspectEntry = currentInspectEntry(model);
  const lines = [
    styleSection('INSPECT'),
    '',
  ];

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

function buildThoughtContent(model, width) {
  const entry = currentEntry(model);
  const neighbors = resolveNeighbors(model);
  const lines = [
    styleSection('CURRENT'),
    '',
    wrapParagraphs(entry.text, width),
    '',
    styleSection('NEIGHBORS'),
    '',
    `Newer: ${neighbors.newer ? neighbors.newer.text : 'none'}`,
    `Older: ${neighbors.older ? neighbors.older.text : 'none'}`,
  ];

  return lines.join('\n');
}

function getCurrentViewportState(model) {
  const layout = resolveLayout(model);
  const mainHeight = model.inspectVisible
    ? Math.max(1, layout.bodyHeight - clamp(Math.floor(layout.bodyHeight * 0.35), 8, Math.max(8, layout.bodyHeight - 8)) - 1)
    : layout.bodyHeight;
  const content = buildThoughtContent(model, layout.mainWidth);
  return createScrollState(content, mainHeight);
}

function resolveLayout(model) {
  const bodyHeight = Math.max(1, model.rows - 2);
  const sidebarWidth = clamp(Math.floor(model.columns * 0.28), 28, 42);
  const mainWidth = Math.max(20, model.columns - sidebarWidth - 2);

  return {
    bodyHeight,
    sidebarWidth,
    mainWidth,
  };
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

function computeSidebarScroll(model, height) {
  const selectedLine = 2 + model.currentIndex;
  const visibleHeight = Math.max(1, height);
  const target = selectedLine - Math.floor(visibleHeight / 2);
  const maxY = Math.max(0, model.entries.length + 2 - visibleHeight);
  return clamp(target, 0, maxY);
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
  if (!model.inspectVisible) {
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
