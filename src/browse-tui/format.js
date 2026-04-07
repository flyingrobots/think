export function formatWhen(createdAt) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(createdAt));
  } catch {
    return String(createdAt);
  }
}

export function formatCompactWhen(createdAt) {
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

export function formatRelativeTime(createdAt) {
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

export function formatVisibleEntryId(entryId) {
  const value = String(entryId ?? '').trim();
  if (!value) {
    return 'pending';
  }
  return value.slice(0, 12);
}

export function formatSessionEntryLabel(sessionEntry, currentEntryId, index, currentIndex) {
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

export function formatSessionPosition(sessionTraversal) {
  if (!sessionTraversal.position || !sessionTraversal.count) {
    return 'pending';
  }

  return `${sessionTraversal.position} of ${sessionTraversal.count}`;
}

export function normalizeWhitespace(text) {
  return String(text).replace(/\s+/g, ' ').trim();
}

export function truncatePlain(text, width) {
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

export function wrapParagraphs(text, width) {
  return String(text)
    .split(/\n+/)
    .map((paragraph) => wrapLine(paragraph, width))
    .join('\n');
}

export function wrapLine(text, width) {
  const safeWidth = Math.max(8, width);
  const words = normalizeWhitespace(text).split(' ');
  const lines = [];
  let current = '';

  for (const word of words) {
    if (current.length === 0) {
      current = word;
      continue;
    }

    if ((`${current} ${word}`).length <= safeWidth) {
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

export function capitalize(text) {
  return String(text).charAt(0).toUpperCase() + String(text).slice(1);
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function compareEntriesOldestFirst(left, right) {
  if (left.sortKey === right.sortKey) {
    return left.id.localeCompare(right.id);
  }

  return left.sortKey.localeCompare(right.sortKey);
}
