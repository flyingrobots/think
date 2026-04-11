import {
  commandPalette,
  viewport,
} from '@flyingrobots/bijou-tui';
import {
  inspector,
  stepper,
} from '@flyingrobots/bijou';
import {
  currentEntry,
  currentInspectEntry,
  resolveSessionTraversal,
  computeLogScroll,
} from './resolve.js';
import { styleDim, styleTitle } from './style.js';
import {
  formatWhen,
  formatCompactWhen,
  formatVisibleEntryId,
  formatSessionEntryLabel,
  normalizeWhitespace,
  wrapLine,
} from './format.js';

// --- Content builders (return strings, shared by string and surface paths) ---

export function buildInspectContent(model, width, ctx) {
  const inspectEntry = currentInspectEntry(model);
  const entry = currentEntry(model);

  if (!inspectEntry) {
    return styleDim(ctx,
      model.inspectLoadingEntryId === entry.id
        ? 'Loading inspect receipts...'
        : 'Inspect data not loaded yet.'
    );
  }

  const sections = [];

  if (inspectEntry.derivedReceipts.length === 0) {
    sections.push({
      title: 'Receipts',
      content: 'No direct derived receipts yet.',
      tone: 'muted',
    });
  } else {
    sections.push({
      title: 'Receipts',
      content: inspectEntry.derivedReceipts.map((receipt) =>
        wrapLine(
          `${receipt.entryId} (${receipt.promptType}, ${receipt.relation}, session ${receipt.sessionId})`,
          Math.max(10, width - 4)
        )
      ).join('\n'),
    });
  }

  if (ctx) {
    return inspector({
      title: 'Inspect',
      currentValue: inspectEntry.thoughtId,
      currentValueLabel: 'Thought ID',
      supportingText: [
        `Entry ID: ${inspectEntry.entryId}`,
        `Kind: ${inspectEntry.kind}`,
        `Sort Key: ${inspectEntry.sortKey}`,
      ].join('\n'),
      supportingTextLabel: 'Metadata',
      sections,
      chrome: 'none',
      width,
      ctx,
    });
  }

  // Fallback for script path (no bijou context)
  const lines = [
    `Thought ID: ${inspectEntry.thoughtId}`,
    `Entry ID: ${inspectEntry.entryId}`,
    `Kind: ${inspectEntry.kind}`,
    `Sort Key: ${inspectEntry.sortKey}`,
    '',
    styleDim(null, 'RECEIPTS'),
  ];
  if (inspectEntry.derivedReceipts.length === 0) {
    lines.push(styleDim(null, 'No direct derived receipts yet.'));
  } else {
    for (const receipt of inspectEntry.derivedReceipts) {
      lines.push(wrapLine(
        `Reflect: ${receipt.entryId} (${receipt.promptType}, ${receipt.relation}, session ${receipt.sessionId})`,
        width
      ));
    }
  }
  return lines.join('\n');
}

export function buildSessionContent(model, width, ctx) {
  const entry = currentEntry(model);
  const sessionTraversal = resolveSessionTraversal(model);
  const sessionEntries = sessionTraversal.entries;

  if (!entry.sessionId) {
    return styleDim(ctx, 'Session context is not available for this thought yet.');
  }

  if (sessionEntries.length === 0) {
    return styleDim(ctx, 'Session entries are not available for this thought yet.');
  }

  const currentIndex = sessionEntries.findIndex((candidate) => candidate.id === entry.id);
  const steps = sessionEntries.map((sessionEntry, index) => {
    const timestamp = formatCompactWhen(sessionEntry.createdAt);
    const label = `${formatSessionEntryLabel(sessionEntry, entry.id, index, currentIndex)} ${formatVisibleEntryId(sessionEntry.id)} ${timestamp}`;
    return { label };
  });

  const header = [];
  header.push(`Session ID: ${entry.sessionId}`);
  if (sessionEntries[0]?.createdAt) {
    header.push(`Started: ${formatWhen(sessionEntries[0].createdAt)}`);
  }
  if (sessionTraversal.position && sessionTraversal.count) {
    header.push(`Position: ${sessionTraversal.position} of ${sessionTraversal.count}`);
  }

  if (ctx) {
    return `${header.join('\n')}\n\n${stepper(steps, { current: Math.max(0, currentIndex), ctx })}`;
  }

  // Fallback for script path (no bijou context)
  return `${header.join('\n')}\n\n${steps.map((s, i) => `${i === currentIndex ? '>' : ' '} ${s.label}`).join('\n')}`;
}

export function buildLogContent(model, width, ctx) {
  if (model.mode === 'windowed' && !model.chronologyLoaded) {
    return model.chronologyLoading
      ? styleDim(ctx, 'Loading thought log...')
      : styleDim(ctx, 'Thought log is not loaded yet.');
  }

  const lines = [];

  for (const [index, entry] of model.entries.entries()) {
    const prefix = index === model.currentIndex ? styleTitle(ctx, '>') : styleDim(ctx, ' ');
    const timestamp = formatCompactWhen(entry.createdAt);
    const label = normalizeWhitespace(entry.text);
    const maxLabelWidth = Math.max(10, width - timestamp.length - 4);
    const truncated = label.length <= maxLabelWidth ? label : `${label.slice(0, maxLabelWidth - 1)}…`;
    lines.push(`${prefix} ${timestamp} ${truncated}`);
  }

  return lines.join('\n');
}

export function buildJumpContent(model, width, ctx) {
  if (model.mode === 'windowed' && !model.chronologyLoaded) {
    return model.chronologyLoading
      ? styleDim(ctx, 'Loading jump candidates...')
      : styleDim(ctx, 'Jump candidates are not loaded yet.');
  }

  return commandPalette(model.jumpPalette, {
    width,
    showCategory: false,
    showShortcut: false,
    ctx,
  });
}

export function buildMindContent(model, width, ctx) {
  if (!model.mindPalette) {
    return styleDim(ctx, 'No minds available.');
  }

  return commandPalette(model.mindPalette, {
    width,
    showCategory: false,
    showShortcut: false,
    ctx,
  });
}

// --- String-path renderers (wrap content in viewport for the script path) ---

export function renderBottomPanel(model, width, height, ctx) {
  switch (model.panelMode) {
    case 'inspect':
      return viewport({ width, height, content: buildInspectContent(model, width, ctx), scrollY: 0 });
    case 'session':
      return viewport({ width, height, content: buildSessionContent(model, width, ctx), scrollY: 0 });
    case 'log':
      return viewport({ width, height, content: buildLogContent(model, width, ctx), scrollY: computeLogScroll(model, height) });
    case 'jump':
      return viewport({ width, height, content: buildJumpContent(model, width, ctx), scrollY: 0 });
    case 'mind':
      return viewport({ width, height, content: buildMindContent(model, width, ctx), scrollY: 0 });
    default:
      return viewport({ width, height, content: '', scrollY: 0 });
  }
}
