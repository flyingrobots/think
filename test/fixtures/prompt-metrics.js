import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export function seedPromptMetricsFile(context, records, { fileName = 'prompt-ux.jsonl' } = {}) {
  const metricsDir = path.join(context.thinkDir, 'metrics');
  const filePath = path.join(metricsDir, fileName);

  mkdirSync(metricsDir, { recursive: true });
  const payload = records.map((record) => JSON.stringify(record)).join('\n');
  writeFileSync(filePath, payload === '' ? '' : `${payload}\n`, 'utf8');

  return filePath;
}

export function makePromptMetric(overrides = {}) {
  return {
    ts: '2026-03-29T10:00:00.000Z',
    event: 'prompt.session',
    sessionId: 'session-1',
    trigger: 'hotkey',
    dismissalOutcome: 'submitted',
    captureOutcome: 'succeeded',
    startedTyping: true,
    editCount: 3,
    triggerToVisibleMs: 120,
    typingDurationMs: 900,
    submitToHideMs: 70,
    submitToLocalCaptureMs: 150,
    backupState: 'saved_locally',
    ...overrides,
  };
}
