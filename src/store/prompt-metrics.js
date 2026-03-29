import { readFile } from 'node:fs/promises';

export async function readPromptMetricsRecords(filePath) {
  try {
    const contents = await readFile(filePath, 'utf8');
    return String(contents)
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

export function summarizePromptMetrics(records) {
  return records.reduce((summary, record) => {
    summary.sessions += 1;

    if (record.dismissalOutcome === 'submitted') {
      summary.submitted += 1;
    } else if (record.dismissalOutcome === 'abandoned_empty') {
      summary.abandonedEmpty += 1;
    } else if (record.dismissalOutcome === 'abandoned_started') {
      summary.abandonedStarted += 1;
    }

    if (record.trigger === 'hotkey') {
      summary.hotkey += 1;
    } else if (record.trigger === 'menu') {
      summary.menu += 1;
    }

    return summary;
  }, {
    sessions: 0,
    submitted: 0,
    abandonedEmpty: 0,
    abandonedStarted: 0,
    hotkey: 0,
    menu: 0,
  });
}

export function summarizePromptMetricTimings(records) {
  const metrics = [
    ['trigger_to_visible_ms', 'triggerToVisibleMs'],
    ['typing_duration_ms', 'typingDurationMs'],
    ['submit_to_hide_ms', 'submitToHideMs'],
    ['submit_to_local_capture_ms', 'submitToLocalCaptureMs'],
  ];

  return metrics.map(([metric, field]) => {
    const samples = records
      .map((record) => record[field])
      .filter((value) => Number.isFinite(value))
      .sort((left, right) => left - right);

    return {
      metric,
      sampleCount: samples.length,
      medianMs: samples.length > 0 ? median(samples) : null,
      meanMs: samples.length > 0 ? mean(samples) : null,
      minMs: samples.length > 0 ? samples[0] : null,
      maxMs: samples.length > 0 ? samples[samples.length - 1] : null,
    };
  });
}

export function summarizePromptMetricBuckets(records, bucket, formatBucketKey) {
  const buckets = {};

  for (const record of records) {
    const ts = new Date(record.ts);
    if (Number.isNaN(ts.getTime())) {
      continue;
    }

    const key = formatBucketKey(ts, bucket);
    if (!buckets[key]) {
      buckets[key] = {
        key,
        sessions: 0,
        submitted: 0,
        abandonedEmpty: 0,
        abandonedStarted: 0,
      };
    }

    buckets[key].sessions += 1;
    if (record.dismissalOutcome === 'submitted') {
      buckets[key].submitted += 1;
    } else if (record.dismissalOutcome === 'abandoned_empty') {
      buckets[key].abandonedEmpty += 1;
    } else if (record.dismissalOutcome === 'abandoned_started') {
      buckets[key].abandonedStarted += 1;
    }
  }

  return Object.values(buckets).sort((left, right) => right.key.localeCompare(left.key));
}

function median(values) {
  if (values.length === 0) {
    return null;
  }

  const middle = Math.floor(values.length / 2);
  if (values.length % 2 === 1) {
    return values[middle];
  }

  return Math.round((values[middle - 1] + values[middle]) / 2);
}

function mean(values) {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
