import { stringToSurface } from '@flyingrobots/bijou';

export const BROWSE_LOADING_FRAMES = Object.freeze([
  '⠋',
  '⠙',
  '⠹',
  '⠸',
  '⠼',
  '⠴',
  '⠦',
  '⠧',
  '⠇',
  '⠏',
]);

const BROWSE_STATUS_RENDERERS = Object.freeze({
  loading: (model, width) => renderLoadingLines(model, width),
  ready: (model, width) => renderReadyLines(model.view, width),
  empty: (model, width) => renderMessageLines(
    model,
    'No raw captures available to browse',
    width
  ),
  repo_missing: (model, width) => renderMessageLines(
    model,
    'No thought repo found for this mind',
    width
  ),
  migration_required: (model, width) => renderMessageLines(
    model,
    'History migration required before Browse can open',
    width
  ),
});

export function renderBrowsePaneSurface(model, width = model.columns, height = model.rows) {
  return stringToSurface(
    renderBrowsePaneText({ ...model, columns: width, rows: height }),
    width,
    height
  );
}

export function renderBrowsePaneText(model) {
  const width = Math.max(24, model.columns || 80);
  const rows = Math.max(1, model.rows || 24);
  const renderStatus = BROWSE_STATUS_RENDERERS[model.status] ?? renderErrorLines;
  const lines = [
    fitLine(`Mind: ${model.mindName || 'default'}`, width),
    '',
    ...renderStatus(model, width),
  ];

  return lines
    .slice(0, rows)
    .map((line) => fitLine(line, width))
    .join('\n');
}

function renderMessageLines(model, fallback, width) {
  return wrapText(model.view?.message ?? fallback, width);
}

function renderErrorLines(model, width) {
  return wrapText(model.errorMessage ?? model.view?.message ?? 'Browse could not open', width);
}

function renderLoadingLines(model, width) {
  return [
    fitLine(`${loadingFrame(model.loadingStep)} Opening mind`, width),
    ...wrapText('Waiting on history read', width),
  ];
}

function loadingFrame(step) {
  return BROWSE_LOADING_FRAMES[(Number(step) || 0) % BROWSE_LOADING_FRAMES.length];
}

function renderReadyLines(view, width) {
  const current = view?.current;
  if (!current) {
    return wrapText('No raw captures available to browse', width);
  }

  const lines = [
    fitLine(formatEntryMeta(current), width),
    '',
    ...wrapText(current.text, width),
  ];

  if (view.newer || view.older) {
    lines.push('');
  }
  if (view.newer) {
    lines.push(...wrapText(`Newer: ${view.newer.text}`, width));
  }
  if (view.older) {
    lines.push(...wrapText(`Older: ${view.older.text}`, width));
  }

  return lines;
}

function formatEntryMeta(entry) {
  const parts = [];
  if (entry.createdAt) {
    parts.push(entry.createdAt);
  }
  if (entry.id) {
    parts.push(shortEntryId(entry.id));
  }

  return parts.join(' | ') || 'Raw capture';
}

function shortEntryId(entryId) {
  const match = /^entry:([^\s]+-[^-]+)-/.exec(entryId);
  if (match) {
    return `entry:${match[1]}`;
  }

  return entryId.length > 24 ? `${entryId.slice(0, 24)}...` : entryId;
}

function wrapText(text, width) {
  const words = String(text ?? '').split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return [''];
  }

  const lines = [];
  let line = '';
  for (const word of words) {
    if (!line) {
      line = word;
    } else if (`${line} ${word}`.length <= width) {
      line = `${line} ${word}`;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) {
    lines.push(line);
  }

  return lines.flatMap((wrappedLine) => hardWrapLine(wrappedLine, width));
}

function hardWrapLine(line, width) {
  if (line.length <= width) {
    return [line];
  }

  const chunks = [];
  for (let index = 0; index < line.length; index += width) {
    chunks.push(line.slice(index, index + width));
  }
  return chunks;
}

function fitLine(line, width) {
  const text = String(line ?? '');
  return text.length <= width ? text : text.slice(0, width);
}
