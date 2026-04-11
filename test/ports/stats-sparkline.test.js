import assert from 'node:assert/strict';
import test from 'node:test';

import { formatStats } from '../../src/mcp/format.js';

// ---------------------------------------------------------------------------
// Sparkline in MCP formatted stats output
// ---------------------------------------------------------------------------

test('formatStats includes a sparkline when buckets are present', () => {
  const result = formatStats({
    total: 10,
    buckets: [
      { key: '2026-04-11', count: 5 },
      { key: '2026-04-10', count: 3 },
      { key: '2026-04-09', count: 2 },
    ],
  });

  assert.match(
    result,
    /[▁▂▃▄▅▆▇█]{3}/,
    'Expected formatted stats to include a sparkline of bucket counts.'
  );
});

test('formatStats omits sparkline when no buckets are present', () => {
  const result = formatStats({ total: 5, buckets: null });

  assert.doesNotMatch(
    result,
    /[▁▂▃▄▅▆▇█]/,
    'Expected no sparkline characters when no buckets are requested.'
  );
});

test('formatStats handles a single bucket without crashing', () => {
  const result = formatStats({
    total: 3,
    buckets: [{ key: '2026-04-11', count: 3 }],
  });

  assert.match(
    result,
    /[▁▂▃▄▅▆▇█]/,
    'Expected a single-character sparkline for a single bucket.'
  );
});

test('formatStats handles empty bucket array without sparkline', () => {
  const result = formatStats({ total: 0, buckets: [] });

  assert.doesNotMatch(
    result,
    /[▁▂▃▄▅▆▇█]/,
    'Expected no sparkline when bucket array is empty.'
  );
});

test('formatStats sparkline is oldest-to-newest (left-to-right)', () => {
  const result = formatStats({
    total: 6,
    buckets: [
      { key: '2026-04-11', count: 1 },  // newest first (from getStats)
      { key: '2026-04-10', count: 5 },
      { key: '2026-04-09', count: 1 },
    ],
  });

  // Buckets arrive newest-first. Sparkline should reverse: [1, 5, 1]
  // which renders as low-high-low: ▁█▁
  assert.match(
    result,
    /▁█▁/,
    'Expected sparkline to render oldest-to-newest (left-to-right), reversing the bucket order.'
  );
});
