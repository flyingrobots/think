import {
  composite,
  compositeSurface,
  createScrollState,
  drawer,
  flex,
  flexSurface,
  modal,
  viewport,
  viewportSurface,
} from '@flyingrobots/bijou-tui';
import { styleTitle, styleDim, styleSection, BG_TOKEN } from './style.js';
import {
  capitalize,
  formatWhen,
  formatRelativeTime,
  formatVisibleEntryId,
  formatSessionPosition,
  truncatePlain,
  wrapParagraphs,
  wrapLine,
  clamp,
} from './format.js';
import {
  currentEntry,
  resolveNeighbors,
  resolveSessionTraversal,
  resolveChronologyPosition,
  resolveLayout,
  resolveHelpLine,
  resolveBrowseCounter,
  resolveDrawerTitle,
  resolveReflectHint,
  computeLogScroll,
} from './resolve.js';
import {
  renderBottomPanel,
  buildInspectContent,
  buildSessionContent,
  buildLogContent,
  buildJumpContent,
} from './panels.js';

export function renderBrowseModel(model, ctx = null) {
  const layout = resolveLayout(model);
  const baseHelp = resolveHelpLine(model);
  const help = model.notice ? `${model.notice} • ${baseHelp}` : baseHelp;
  const counter = resolveBrowseCounter(model);
  const background = flex(
    { direction: 'column', width: model.columns, height: model.rows },
    {
      basis: 1,
      content: counter
        ? `${styleTitle(ctx, 'THINK BROWSE')} ${styleDim(ctx, counter)}`
        : styleTitle(ctx, 'THINK BROWSE'),
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
          content: (paneWidth, paneHeight) => renderThoughtPane(model, paneWidth, paneHeight, ctx),
        }
      ),
    },
    {
      basis: 1,
      content: styleDim(ctx, truncatePlain(help, model.columns)),
    }
  );

  const overlays = [];

  if (model.panelMode !== 'none' && model.panelMode !== 'reflect') {
    overlays.push(drawer({
      anchor: 'bottom',
      title: resolveDrawerTitle(model.panelMode),
      content: renderDrawerContent(model, layout, ctx),
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
    const modalWidth = Math.max(48, Math.min(model.columns - 8, 92));
    overlays.push(modal({
      title: 'REFLECT',
      body: renderReflectModalBody(model, modalWidth, ctx),
      hint: resolveReflectHint(model),
      screenWidth: model.columns,
      screenHeight: model.rows,
      width: modalWidth,
    }));
  }

  if (overlays.length === 0) {
    return background;
  }

  return composite(background, overlays, { dim: model.panelMode === 'reflect' });
}

export function renderBrowseView(model, ctx) {
  const layout = resolveLayout(model);
  const help = resolveHelpLine(model);
  const counter = resolveBrowseCounter(model);
  const background = flexSurface(
    { direction: 'column', width: model.columns, height: model.rows, ctx, bgToken: BG_TOKEN },
    {
      basis: 1,
      content: counter
        ? `${styleTitle(ctx, 'THINK BROWSE')} ${styleDim(ctx, counter)}`
        : styleTitle(ctx, 'THINK BROWSE'),
    },
    {
      flex: 1,
      content: (width, height) => renderThoughtPaneSurface(model, width, height, ctx),
    },
    {
      basis: 1,
      content: styleDim(ctx, truncatePlain(help, model.columns)),
    }
  );

  const overlays = [];

  if (model.panelMode !== 'none' && model.panelMode !== 'reflect') {
    overlays.push(drawer({
      anchor: 'bottom',
      title: resolveDrawerTitle(model.panelMode),
      content: renderDrawerContentSurface(model, layout, ctx),
      screenWidth: model.columns,
      screenHeight: model.rows,
      ctx,
      bgToken: BG_TOKEN,
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
    const modalWidth = Math.max(48, Math.min(model.columns - 8, 92));
    overlays.push(modal({
      title: 'REFLECT',
      body: renderReflectModalBody(model, modalWidth, ctx),
      hint: resolveReflectHint(model),
      screenWidth: model.columns,
      screenHeight: model.rows,
      width: modalWidth,
      ctx,
      bgToken: BG_TOKEN,
    }));
  }

  if (overlays.length === 0) {
    return background;
  }

  return compositeSurface(background, overlays, { dim: model.panelMode === 'reflect' });
}

export function browseLayout(model, ctx) {
  return {
    kind: 'pane',
    paneId: 'thought',
    render: (width, height) => {
      const content = buildThoughtContent(model, width, ctx);
      const state = createScrollState(content, height);
      const scrollY = clamp(model.contentScrollY, 0, state.maxY);
      return viewportSurface({ width, height, content, scrollY });
    },
  };
}

function renderThoughtPaneSurface(model, width, height, ctx) {
  const content = buildThoughtContent(model, width, ctx);
  const state = createScrollState(content, height);
  const scrollY = clamp(model.contentScrollY, 0, state.maxY);
  return viewportSurface({
    width,
    height,
    content,
    scrollY,
  });
}

function renderDrawerContentSurface(model, layout, ctx) {
  const innerWidth = Math.max(1, model.columns - 4);
  const innerHeight = Math.max(1, layout.panelHeight - 2);
  return renderBottomPanelSurfaceDispatch(model, innerWidth, innerHeight, ctx);
}

function renderBottomPanelSurfaceDispatch(model, width, height, ctx) {
  switch (model.panelMode) {
    case 'inspect':
      return viewportSurface({ width, height, content: buildInspectContent(model, width, ctx), scrollY: 0 });
    case 'session':
      return viewportSurface({ width, height, content: buildSessionContent(model, width, ctx), scrollY: 0 });
    case 'log':
      return viewportSurface({ width, height, content: buildLogContent(model, width, ctx), scrollY: computeLogScroll(model, height) });
    case 'jump':
      return viewportSurface({ width, height, content: buildJumpContent(model, width, ctx), scrollY: 0 });
    default:
      return viewportSurface({ width, height, content: '', scrollY: 0 });
  }
}

function renderThoughtPane(model, width, height, ctx) {
  const content = buildThoughtContent(model, width, ctx);
  const state = createScrollState(content, height);
  const scrollY = clamp(model.contentScrollY, 0, state.maxY);
  return viewport({
    width,
    height,
    content,
    scrollY,
  });
}

function renderDrawerContent(model, layout, ctx) {
  const innerWidth = Math.max(1, model.columns - 4);
  const innerHeight = Math.max(1, layout.panelHeight - 2);
  return renderBottomPanel(model, innerWidth, innerHeight, ctx);
}

function renderReflectModalBody(model, width, _ctx) {
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

export function buildThoughtContent(model, width, ctx = null) {
  const entry = currentEntry(model);
  const neighbors = resolveNeighbors(model);
  const sessionTraversal = resolveSessionTraversal(model);
  const chronologyPosition = resolveChronologyPosition(model);

  const metadata = [
    `When: ${formatWhen(entry.createdAt)}`,
    `Relative: ${formatRelativeTime(entry.createdAt)}`,
    ...(chronologyPosition ? [`Position: ${chronologyPosition}`] : []),
    `Entry ID: ${formatVisibleEntryId(entry.id)}`,
    `Session: ${entry.sessionId ?? 'pending'}`,
    `Session Position: ${formatSessionPosition(sessionTraversal)}`,
  ].join('\n');

  const thoughtBody = `${metadata}\n\n${wrapParagraphs(entry.text, width)}`;

  const neighborsBody = [
    wrapLine(`Newer: ${neighbors.newer ? neighbors.newer.text : 'none'}`, width),
    wrapLine(`Older: ${neighbors.older ? neighbors.older.text : 'none'}`, width),
  ].join('\n');

  const sessionBody = [
    wrapLine(
      `Previous in session: ${sessionTraversal.previous ? sessionTraversal.previous.text : 'none'}`,
      width
    ),
    wrapLine(
      `Next in session: ${sessionTraversal.next ? sessionTraversal.next.text : 'none'}`,
      width
    ),
  ].join('\n');

  return [
    styleSection(ctx, 'THOUGHT'), '', thoughtBody, '',
    styleSection(ctx, 'NEIGHBORS'), '', neighborsBody, '',
    styleSection(ctx, 'SESSION'), '', sessionBody,
  ].join('\n');
}
