import { createBijou, table, inspector, box, sparkline, stripAnsi } from '@flyingrobots/bijou';
import { nodeRuntime, nodeIO, chalkStyle } from '@flyingrobots/bijou-node';

let _mcpCtx = null;

function mcpCtx() {
  if (!_mcpCtx) {
    _mcpCtx = createBijou({
      runtime: nodeRuntime(),
      io: nodeIO(),
      style: chalkStyle(),
    });
  }
  return _mcpCtx;
}

function renderPlain(bijouFn) {
  const raw = bijouFn(mcpCtx());
  return stripAnsi(raw);
}

export function formatRecentEntries(entries) {
  if (entries.length === 0) {
    return 'No recent thoughts.';
  }

  return renderPlain((ctx) => table({
    columns: [
      { header: 'When', width: 20 },
      { header: 'Thought' },
    ],
    rows: entries.map((e) => [
      formatTimestamp(e.createdAt),
      truncate(e.text, 50),
    ]),
    ctx,
  }));
}

export function formatBrowseWindow(browseResult) {
  const { current } = browseResult;
  if (!current) {
    return 'No thought to display.';
  }

  const lines = [
    renderPlain((ctx) => box(`${current.text}`, {
      title: 'Current Thought',
      width: 76,
      ctx,
    })),
    '',
    `Entry ID: ${current.entryId}`,
    `When: ${formatTimestamp(current.createdAt)}`,
    `Session: ${current.sessionId ?? 'pending'}`,
  ];

  if (browseResult.newer) {
    lines.push('', `Newer: ${truncate(browseResult.newer.text, 60)}`);
  }
  if (browseResult.older) {
    lines.push(`Older: ${truncate(browseResult.older.text, 60)}`);
  }

  if (browseResult.sessionEntries.length > 0) {
    lines.push('', `Session entries: ${browseResult.sessionEntries.length}`);
  }

  return lines.join('\n');
}

export function formatInspectEntry(inspectResult) {
  const { entry } = inspectResult;
  if (!entry) {
    return 'Entry not found.';
  }

  const sections = [];

  if (entry.derivedReceipts && entry.derivedReceipts.length > 0) {
    sections.push({
      title: 'Reflect Receipts',
      content: entry.derivedReceipts.map((r) =>
        `${r.entryId} (${r.promptType}, ${r.relation})`
      ).join('\n'),
    });
  }

  return renderPlain((ctx) => inspector({
    title: 'Thought Inspection',
    currentValue: entry.thoughtId,
    currentValueLabel: 'Thought ID',
    supportingText: [
      `Entry ID: ${entry.entryId}`,
      `Kind: ${entry.kind}`,
      `Sort Key: ${entry.sortKey}`,
    ].join('\n'),
    supportingTextLabel: 'Metadata',
    sections,
    chrome: 'boxed',
    width: 76,
    ctx,
  }));
}

export function formatStats(statsResult) {
  const lines = [`Total thoughts: ${statsResult.total}`];

  if (statsResult.buckets && statsResult.buckets.length > 0) {
    lines.push('');
    lines.push(renderPlain((ctx) => table({
      columns: [
        { header: 'Period', width: 24 },
        { header: 'Count', width: 8 },
      ],
      rows: statsResult.buckets.map((b) => [b.key, String(b.count)]),
      ctx,
    })));

    const values = statsResult.buckets.map((b) => b.count).reverse();
    lines.push('');
    lines.push(`Capture frequency: ${sparkline(values)}`);
  }

  return lines.join('\n');
}

export function buildStatsSparkline(buckets) {
  if (!buckets || buckets.length === 0) {
    return null;
  }
  return sparkline(buckets.map((b) => b.count).reverse());
}

export function formatPromptMetrics(metricsResult) {
  const { summary, timings } = metricsResult;

  const lines = [
    `Sessions: ${summary.sessions} (submitted: ${summary.submitted}, abandoned: ${summary.abandonedStarted + summary.abandonedEmpty})`,
    `Triggers: hotkey ${summary.hotkey}, menu ${summary.menu}`,
  ];

  if (timings.length > 0) {
    lines.push('');
    lines.push(renderPlain((ctx) => table({
      columns: [
        { header: 'Metric', width: 24 },
        { header: 'Median', width: 10 },
        { header: 'Mean', width: 10 },
        { header: 'Min', width: 10 },
        { header: 'Max', width: 10 },
        { header: 'N', width: 6 },
      ],
      rows: timings.map((t) => [
        t.metric,
        t.medianMs === null ? '—' : `${t.medianMs}ms`,
        t.meanMs === null ? '—' : `${Math.round(t.meanMs)}ms`,
        t.minMs === null ? '—' : `${t.minMs}ms`,
        t.maxMs === null ? '—' : `${t.maxMs}ms`,
        String(t.sampleCount),
      ]),
      ctx,
    })));
  }

  return lines.join('\n');
}

function formatTimestamp(createdAt) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(createdAt));
  } catch {
    return String(createdAt);
  }
}

function truncate(text, maxLen) {
  const normalized = String(text).replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLen) {
    return normalized;
  }
  return `${normalized.slice(0, maxLen - 1)}…`;
}
