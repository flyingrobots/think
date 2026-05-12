import { readFile } from 'node:fs/promises';

import { parseJson } from '../json.js';

export async function readPromptMetricsRecords(filePath, { reader = null } = {}) {
  try {
    const read = reader ?? ((p) => readFile(p, 'utf8'));
    const contents = await read(filePath);
    return String(contents)
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        try {
          return normalizeMetricRecord(parseJson(line));
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

function normalizeMetricRecord(raw) {
  if (!raw || typeof raw !== 'object' || !raw.sessionId) {
    return null;
  }

  return Object.freeze({
    sessionId: String(raw.sessionId),
    ts: raw.ts ?? null,
    dismissalOutcome: raw.dismissalOutcome ?? null,
    trigger: raw.trigger ?? null,
    triggerToVisibleMs: typeof raw.triggerToVisibleMs === 'number' ? raw.triggerToVisibleMs : null,
    typingDurationMs: typeof raw.typingDurationMs === 'number' ? raw.typingDurationMs : null,
    submitToHideMs: typeof raw.submitToHideMs === 'number' ? raw.submitToHideMs : null,
    submitToLocalCaptureMs: typeof raw.submitToLocalCaptureMs === 'number' ? raw.submitToLocalCaptureMs : null,
    captureOutcome: raw.captureOutcome ?? null,
    backupState: raw.backupState ?? null,
  });
}

export function summarizePromptMetrics(records) {
  const summary = records.reduce((acc, record) => {
    acc.sessions += 1;

    if (record.dismissalOutcome === 'submitted') {
      acc.submitted += 1;
    } else if (record.dismissalOutcome === 'abandoned_empty') {
      acc.abandonedEmpty += 1;
    } else if (record.dismissalOutcome === 'abandoned_started') {
      acc.abandonedStarted += 1;
    }

    if (record.trigger === 'hotkey') {
      acc.hotkey += 1;
    } else if (record.trigger === 'menu') {
      acc.menu += 1;
    }

    return acc;
  }, {
    sessions: 0,
    submitted: 0,
    abandonedEmpty: 0,
    abandonedStarted: 0,
    hotkey: 0,
    menu: 0,
  });

  return Object.freeze(summary);
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

    return Object.freeze({
      metric,
      sampleCount: samples.length,
      medianMs: samples.length > 0 ? median(samples) : null,
      meanMs: samples.length > 0 ? mean(samples) : null,
      minMs: samples.length > 0 ? samples[0] : null,
      maxMs: samples.length > 0 ? samples[samples.length - 1] : null,
    });
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

  return Object.values(buckets)
    .map((b) => Object.freeze(b))
    .sort((left, right) => right.key.localeCompare(left.key));
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
