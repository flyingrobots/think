import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import test from 'node:test';

import {
  runThink,
  createThinkContext,
} from '../fixtures/think.js';

import {
  makePromptMetric,
  seedPromptMetricsFile,
} from '../fixtures/prompt-metrics.js';

import {
  assertContains,
  assertFailure,
  assertSuccess,
  parseJsonLines,
} from '../support/assertions.js';

test('think --prompt-metrics prints factual prompt telemetry totals and medians', async () => {
  const context = await createThinkContext();
  const metricsFile = seedPromptMetricsFile(context, [
    makePromptMetric({
      sessionId: 'session-1',
      ts: '2026-03-29T10:00:00.000Z',
      triggerToVisibleMs: 100,
      typingDurationMs: 800,
      submitToHideMs: 60,
      submitToLocalCaptureMs: 140,
      dismissalOutcome: 'submitted',
      trigger: 'hotkey',
    }),
    makePromptMetric({
      sessionId: 'session-2',
      ts: '2026-03-29T11:00:00.000Z',
      triggerToVisibleMs: 120,
      typingDurationMs: 1000,
      submitToHideMs: 80,
      submitToLocalCaptureMs: 160,
      dismissalOutcome: 'submitted',
      trigger: 'menu',
    }),
    makePromptMetric({
      sessionId: 'session-3',
      ts: '2026-03-29T12:00:00.000Z',
      dismissalOutcome: 'abandoned_empty',
      captureOutcome: null,
      startedTyping: false,
      editCount: 0,
      typingDurationMs: null,
      submitToHideMs: null,
      submitToLocalCaptureMs: null,
      trigger: 'hotkey',
      triggerToVisibleMs: 140,
      backupState: null,
    }),
    makePromptMetric({
      sessionId: 'session-4',
      ts: '2026-03-29T13:00:00.000Z',
      dismissalOutcome: 'abandoned_started',
      captureOutcome: null,
      startedTyping: true,
      editCount: 2,
      typingDurationMs: 400,
      submitToHideMs: null,
      submitToLocalCaptureMs: null,
      trigger: 'hotkey',
      triggerToVisibleMs: 160,
      backupState: null,
    }),
  ]);

  const result = runThink(context, ['--prompt-metrics'], {
    THINK_PROMPT_METRICS_FILE: metricsFile,
  });

  assertSuccess(result, 'Expected --prompt-metrics to succeed.');
  assertContains(result, 'Prompt metrics', 'Expected prompt metrics mode to identify itself explicitly.');
  assertContains(result, 'Sessions: 4', 'Expected prompt metrics to report total sessions.');
  assertContains(result, 'Submitted: 2', 'Expected prompt metrics to report submitted sessions.');
  assertContains(result, 'Abandoned empty: 1', 'Expected prompt metrics to report abandoned-empty sessions.');
  assertContains(result, 'Abandoned started: 1', 'Expected prompt metrics to report abandoned-started sessions.');
  assertContains(result, 'Hotkey: 3', 'Expected prompt metrics to report hotkey-triggered sessions.');
  assertContains(result, 'Menu: 1', 'Expected prompt metrics to report menu-triggered sessions.');
  assertContains(result, 'Trigger to visible (median): 130 ms', 'Expected prompt metrics to report trigger-to-visible median.');
  assertContains(result, 'Typing duration (median): 800 ms', 'Expected prompt metrics to report typing-duration median.');
  assertContains(result, 'Submit to hide (median): 70 ms', 'Expected prompt metrics to report submit-to-hide median.');
  assertContains(result, 'Submit to local save (median): 150 ms', 'Expected prompt metrics to report submit-to-local-save median.');
});

test('think --prompt-metrics does not bootstrap local state before the first capture', async () => {
  const context = await createThinkContext();

  const result = runThink(context, ['--prompt-metrics']);

  assertSuccess(result, 'Expected --prompt-metrics to succeed before any telemetry exists.');
  assertContains(result, 'No prompt metrics recorded.', 'Expected empty prompt metrics to stay honest and calm.');
  if (existsSync(context.localRepoDir)) {
    throw new Error(`Expected --prompt-metrics to remain read-only, but repo was created at ${context.localRepoDir}.`);
  }
});

test('think --prompt-metrics supports --since filtering over prompt sessions', async () => {
  const context = await createThinkContext();
  const now = new Date('2026-03-29T14:00:00Z').getTime();
  const metricsFile = seedPromptMetricsFile(context, [
    makePromptMetric({
      sessionId: 'old-session',
      ts: '2026-03-29T11:00:00.000Z',
      dismissalOutcome: 'submitted',
    }),
    makePromptMetric({
      sessionId: 'recent-session',
      ts: '2026-03-29T13:30:00.000Z',
      dismissalOutcome: 'abandoned_started',
      captureOutcome: null,
      submitToHideMs: null,
      submitToLocalCaptureMs: null,
    }),
  ]);

  const result = runThink(context, ['--prompt-metrics', '--since=1h'], {
    THINK_PROMPT_METRICS_FILE: metricsFile,
    THINK_TEST_NOW: String(now),
  });

  assertSuccess(result, 'Expected --prompt-metrics --since to succeed.');
  assertContains(result, 'Sessions: 1', 'Expected --since to filter out older prompt sessions.');
  assertContains(result, 'Abandoned started: 1', 'Expected filtered prompt metrics to preserve factual dismissal counts.');
});

test('think --prompt-metrics supports --bucket=day', async () => {
  const context = await createThinkContext();
  const metricsFile = seedPromptMetricsFile(context, [
    makePromptMetric({
      sessionId: 'd1a',
      ts: '2026-03-28T12:00:00.000Z',
      dismissalOutcome: 'submitted',
    }),
    makePromptMetric({
      sessionId: 'd1b',
      ts: '2026-03-28T12:05:00.000Z',
      dismissalOutcome: 'abandoned_empty',
      captureOutcome: null,
      startedTyping: false,
      editCount: 0,
      typingDurationMs: null,
      submitToHideMs: null,
      submitToLocalCaptureMs: null,
      backupState: null,
    }),
    makePromptMetric({
      sessionId: 'd2a',
      ts: '2026-03-29T12:00:00.000Z',
      dismissalOutcome: 'submitted',
    }),
  ]);

  const result = runThink(context, ['--prompt-metrics', '--bucket=day'], {
    THINK_PROMPT_METRICS_FILE: metricsFile,
  });

  assertSuccess(result, 'Expected --prompt-metrics --bucket=day to succeed.');
  assertContains(result, '2026-03-29: sessions 1, submitted 1, abandoned 0', 'Expected day bucket for the newer prompt telemetry day.');
  assertContains(result, '2026-03-28: sessions 2, submitted 1, abandoned 1', 'Expected day bucket for the older prompt telemetry day.');
});

test('think --json --prompt-metrics emits explicit summary, timing, and bucket rows', async () => {
  const context = await createThinkContext();
  const metricsFile = seedPromptMetricsFile(context, [
    makePromptMetric({
      sessionId: 'd1a',
      ts: '2026-03-28T12:00:00.000Z',
      dismissalOutcome: 'submitted',
      triggerToVisibleMs: 100,
      typingDurationMs: 700,
      submitToHideMs: 60,
      submitToLocalCaptureMs: 130,
    }),
    makePromptMetric({
      sessionId: 'd2a',
      ts: '2026-03-29T12:00:00.000Z',
      dismissalOutcome: 'abandoned_started',
      captureOutcome: null,
      triggerToVisibleMs: 140,
      typingDurationMs: 500,
      submitToHideMs: null,
      submitToLocalCaptureMs: null,
      trigger: 'menu',
      backupState: null,
    }),
  ]);

  const result = runThink(context, ['--json', '--prompt-metrics', '--bucket=day'], {
    THINK_PROMPT_METRICS_FILE: metricsFile,
  });

  assertSuccess(result, 'Expected --json --prompt-metrics to succeed.');
  assert.equal((result.stderr || '').trim(), '', 'Expected successful JSON prompt metrics output to keep stderr quiet.');

  const events = parseJsonLines(
    result.stdout,
    'Expected JSON prompt metrics output to emit valid JSONL.'
  );

  assert.deepEqual(
    events.map((event) => event.event),
    [
      'cli.start',
      'prompt_metrics.start',
      'prompt_metrics.done',
      'prompt_metrics.summary',
      'prompt_metrics.timing',
      'prompt_metrics.timing',
      'prompt_metrics.timing',
      'prompt_metrics.timing',
      'prompt_metrics.bucket',
      'prompt_metrics.bucket',
      'cli.success',
    ],
    'Expected JSON prompt metrics to emit explicit summary, timing, and bucket rows.'
  );

  const summary = events.find((event) => event.event === 'prompt_metrics.summary');
  assert.ok(summary, 'Expected JSON prompt metrics to emit a summary row.');
  assert.equal(summary.sessions, 2, 'Expected prompt metrics summary to report total sessions.');
  assert.equal(summary.submitted, 1, 'Expected prompt metrics summary to report submitted sessions.');
  assert.equal(summary.abandonedStarted, 1, 'Expected prompt metrics summary to report abandoned-started sessions.');

  const timing = events.filter((event) => event.event === 'prompt_metrics.timing');
  assert.ok(timing.some((event) => event.metric === 'trigger_to_visible_ms'), 'Expected timing rows to include trigger-to-visible.');
  assert.ok(timing.some((event) => event.metric === 'typing_duration_ms'), 'Expected timing rows to include typing duration.');

  const buckets = events.filter((event) => event.event === 'prompt_metrics.bucket');
  assert.equal(buckets.length, 2, 'Expected JSON prompt metrics to emit one row per day bucket.');
});

test('think --prompt-metrics rejects an unexpected thought argument', async () => {
  const context = await createThinkContext();

  const result = runThink(context, ['--prompt-metrics', 'this should not be treated as a thought']);

  assertFailure(result, 'Expected --prompt-metrics with a thought argument to fail rather than silently discard it.');
  assertContains(result, '--prompt-metrics does not take a thought', 'Expected a clear validation error for mixed prompt-metrics and capture input.');
});

test('think --prompt-metrics rejects invalid filter values', async () => {
  const context = await createThinkContext();

  const invalidSince = runThink(context, ['--prompt-metrics', '--since=7days']);
  assertFailure(invalidSince, 'Expected invalid prompt-metrics --since to fail.');
  assertContains(invalidSince, 'Invalid --since value', 'Expected invalid prompt-metrics --since to fail clearly.');

  const invalidBucket = runThink(context, ['--prompt-metrics', '--bucket=month']);
  assertFailure(invalidBucket, 'Expected invalid prompt-metrics --bucket to fail.');
  assertContains(invalidBucket, 'Invalid --bucket value', 'Expected invalid prompt-metrics --bucket to fail clearly.');
});
