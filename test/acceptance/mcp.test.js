import assert from 'node:assert/strict';
import test from 'node:test';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

import { createThinkContext, runThink } from '../fixtures/think.js';
import { makePromptMetric, seedPromptMetricsFile } from '../fixtures/prompt-metrics.js';
import { baseEnv, repoRoot } from '../fixtures/runtime.js';

const mcpEntrypoint = './bin/think-mcp.js';

test('think MCP server lists the core Think tools', async () => {
  const context = await createThinkContext();

  await withThinkMcpClient(context, async ({ client }) => {
    const tools = await client.listTools();
    assert.deepEqual(
      tools.tools.map((tool) => tool.name),
      [
        'capture',
        'recent',
        'remember',
        'browse',
        'inspect',
        'stats',
        'prompt_metrics',
        'migrate_graph',
      ],
      'Expected the Think MCP server to expose the core capture and read tools.'
    );
  });
});

test('think MCP capture, recent, browse, and inspect route through the existing Think runtime', async () => {
  const context = await createThinkContext();

  await withThinkMcpClient(context, async ({ client }) => {
    const capture = await callTool(client, 'capture', {
      text: 'MCP capture should feel like the same capture core, not a second product.',
    });

    assert.equal(capture.status, 'saved_locally', 'Expected MCP capture to report the normal saved-locally status.');
    assert.equal(capture.backupStatus, 'skipped', 'Expected MCP capture to preserve the normal no-upstream backup behavior.');
    assert.equal(capture.warnings.length, 0, 'Expected MCP capture not to emit post-save warnings on a healthy repo.');

    const recent = await callTool(client, 'recent', {});
    assert.equal(recent.repoPresent, true, 'Expected recent to see the repo bootstrapped by MCP capture.');
    assert.equal(recent.entries.length, 1, 'Expected one recent entry after the first MCP capture.');
    assert.equal(
      recent.entries[0].text,
      'MCP capture should feel like the same capture core, not a second product.',
      'Expected recent to surface the exact MCP-captured text.'
    );

    const browse = await callTool(client, 'browse', {});
    assert.equal(
      browse.current.text,
      'MCP capture should feel like the same capture core, not a second product.',
      'Expected browse without an entry id to start from the latest capture.'
    );
    assert.equal(browse.older, null, 'Expected no older neighbor after one capture.');

    const inspect = await callTool(client, 'inspect', {
      entryId: capture.entryId,
    });
    assert.equal(inspect.entry.entryId, capture.entryId, 'Expected inspect to return the captured entry id.');
    assert.equal(
      inspect.entry.text,
      'MCP capture should feel like the same capture core, not a second product.',
      'Expected inspect to preserve the exact raw capture text.'
    );
  });
});

test('think MCP capture preserves additive provenance separately from the raw text', async () => {
  const context = await createThinkContext();

  await withThinkMcpClient(context, async ({ client }) => {
    const capture = await callTool(client, 'capture', {
      text: 'selected text should stay exact while provenance remains additive',
      ingress: 'selected_text',
      sourceApp: 'Safari',
      sourceURL: 'https://example.com/article',
    });

    const inspect = await callTool(client, 'inspect', {
      entryId: capture.entryId,
    });

    assert.equal(
      inspect.entry.text,
      'selected text should stay exact while provenance remains additive',
      'Expected inspect to preserve the exact raw capture text.'
    );
    assert.deepEqual(
      inspect.entry.captureProvenance,
      {
        ingress: 'selected_text',
        sourceApp: 'Safari',
        sourceURL: 'https://example.com/article',
      },
      'Expected inspect to expose additive capture provenance separately from the raw text.'
    );
  });
});

test('think MCP capture trims additive provenance strings before persistence', async () => {
  const context = await createThinkContext();

  await withThinkMcpClient(context, async ({ client }) => {
    const capture = await callTool(client, 'capture', {
      text: 'selected text',
      ingress: 'selected_text',
      sourceApp: '  Safari  ',
      sourceURL: 'https://example.com/article',
    });

    const inspect = await callTool(client, 'inspect', {
      entryId: capture.entryId,
    });

    assert.deepEqual(
      inspect.entry.captureProvenance,
      {
        ingress: 'selected_text',
        sourceApp: 'Safari',
        sourceURL: 'https://example.com/article',
      },
      'Expected additive provenance strings to be normalized before persistence.'
    );
  });
});

test('think MCP remember, stats, and prompt_metrics expose structured read results', async () => {
  const context = await createThinkContext();
  const metricsFile = seedPromptMetricsFile(context, [
    makePromptMetric({
      sessionId: 'prompt-session-1',
      ts: '2026-03-29T10:00:00.000Z',
      triggerToVisibleMs: 110,
      typingDurationMs: 900,
      submitToHideMs: 70,
      submitToLocalCaptureMs: 150,
      dismissalOutcome: 'submitted',
      trigger: 'hotkey',
    }),
    makePromptMetric({
      sessionId: 'prompt-session-2',
      ts: '2026-03-29T11:00:00.000Z',
      dismissalOutcome: 'abandoned_started',
      captureOutcome: null,
      triggerToVisibleMs: 150,
      typingDurationMs: 400,
      submitToHideMs: null,
      submitToLocalCaptureMs: null,
      trigger: 'menu',
      backupState: null,
    }),
  ]);

  runThink(context, ['project notes about warp performance and browse startup']);
  runThink(context, ['remembering warp checkpoints makes browse startup fast']);

  await withThinkMcpClient(
    context,
    async ({ client }) => {
      const remember = await callTool(client, 'remember', {
        brief: true,
        limit: 1,
        query: 'warp',
      });

      assert.equal(remember.repoPresent, true, 'Expected remember to read from the local Think repo.');
      assert.equal(remember.matches.length, 1, 'Expected remember --limit semantics to carry into MCP.');
      assert.match(
        remember.matches[0].reasonText,
        /matched query/,
        'Expected remember to preserve explicit recall receipts.'
      );

      const stats = await callTool(client, 'stats', {});
      assert.equal(stats.repoPresent, true, 'Expected stats to report the repo as present.');
      assert.equal(stats.total, 2, 'Expected stats to count the seeded captures.');

      const promptMetrics = await callTool(client, 'prompt_metrics', {
        bucket: 'day',
      });
      assert.equal(promptMetrics.summary.sessions, 2, 'Expected prompt_metrics to report total sessions.');
      assert.equal(promptMetrics.timings.length, 4, 'Expected prompt_metrics to expose the known timing rows.');
      assert.equal(promptMetrics.buckets.length, 1, 'Expected bucketed prompt metrics to return one day bucket.');
    },
    {
      THINK_PROMPT_METRICS_FILE: metricsFile,
    }
  );
});

async function withThinkMcpClient(context, run, extraEnv = {}) {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [mcpEntrypoint],
    cwd: repoRoot,
    env: {
      ...process.env,
      ...baseEnv,
      ...extraEnv,
      HOME: context.homeDir,
      THINK_UPSTREAM_URL: context.upstreamUrl,
    },
    stderr: 'pipe',
  });
  const stderrChunks = [];
  transport.stderr?.on('data', (chunk) => {
    stderrChunks.push(String(chunk));
  });

  const client = new Client({
    name: 'think-mcp-test-client',
    version: '1.0.0',
  });

  await client.connect(transport);

  try {
    await run({
      client,
      stderr: stderrChunks,
    });
  } finally {
    await transport.close();
  }
}

async function callTool(client, name, args) {
  const result = await client.callTool({
    name,
    arguments: args,
  });

  assert.notEqual(result.isError, true, `Expected MCP tool ${name} to succeed.`);
  assert.ok(result.structuredContent, `Expected MCP tool ${name} to return structured content.`);
  return result.structuredContent;
}
