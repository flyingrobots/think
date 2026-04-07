import {
  commandPalette,
  viewport,
} from '@flyingrobots/bijou-tui';
import {
  currentEntry,
  currentInspectEntry,
  resolveSessionTraversal,
  computeLogScroll,
} from './resolve.js';
import { styleDim, styleSection, styleTitle } from './style.js';
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
  const lines = [];
  const entry = currentEntry(model);

  if (inspectEntry) {
    lines.push(`Thought ID: ${inspectEntry.thoughtId}`);
    lines.push(`Entry ID: ${inspectEntry.entryId}`);
    lines.push(`Kind: ${inspectEntry.kind}`);
    lines.push(`Sort Key: ${inspectEntry.sortKey}`);
    lines.push('');
    lines.push(styleSection(ctx, 'RECEIPTS'));

    if (inspectEntry.derivedReceipts.length === 0) {
      lines.push(styleDim(ctx, 'No direct derived receipts yet.'));
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
  } else {
    lines.push(styleDim(ctx,
      model.inspectLoadingEntryId === entry.id
        ? 'Loading inspect receipts...'
        : 'Inspect data not loaded yet.'
    ));
  }

  return lines.join('\n');
}

export function buildSessionContent(model, width, ctx) {
  const entry = currentEntry(model);
  const sessionTraversal = resolveSessionTraversal(model);
  const sessionEntries = sessionTraversal.entries;
  const lines = [];

  if (entry.sessionId) {
    lines.push(`Session ID: ${entry.sessionId}`);
    if (sessionEntries[0]?.createdAt) {
      lines.push(`Started: ${formatWhen(sessionEntries[0].createdAt)}`);
    }
    if (sessionTraversal.position && sessionTraversal.count) {
      lines.push(`Session Position: ${sessionTraversal.position} of ${sessionTraversal.count}`);
    }
    lines.push('');

    if (sessionEntries.length === 0) {
      lines.push(styleDim(ctx, 'Session entries are not available for this thought yet.'));
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
  } else {
    lines.push(styleDim(ctx, 'Session context is not available for this thought yet.'));
  }

  return lines.join('\n');
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
    default:
      return viewport({ width, height, content: '', scrollY: 0 });
  }
}
