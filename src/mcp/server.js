import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import * as z from 'zod/v4';

import pkg from '../../package.json' with { type: 'json' };
import { toToolResult } from './result.js';
import {
  browseThought,
  captureThought,
  getPromptMetricsForMcp,
  getThoughtStats,
  inspectThought,
  listRecentThoughts,
  migrateThoughtGraph,
  rememberThoughtsForMcp,
} from './service.js';

const recentEntrySchema = z.object({
  createdAt: z.string(),
  entryId: z.string(),
  sessionId: z.string().nullable(),
  sortKey: z.string(),
  text: z.string(),
});

const browseEntrySchema = z.object({
  createdAt: z.string(),
  entryId: z.string(),
  sessionId: z.string().nullable(),
  sortKey: z.string(),
  text: z.string(),
});

const bucketSchema = z.object({
  count: z.number().int().nonnegative(),
  key: z.string(),
});

const promptMetricTimingSchema = z.object({
  maxMs: z.number().nullable(),
  meanMs: z.number().nullable(),
  medianMs: z.number().nullable(),
  metric: z.string(),
  minMs: z.number().nullable(),
  sampleCount: z.number().int().nonnegative(),
});

const promptMetricBucketSchema = z.object({
  abandonedEmpty: z.number().int().nonnegative(),
  abandonedStarted: z.number().int().nonnegative(),
  key: z.string(),
  sessions: z.number().int().nonnegative(),
  submitted: z.number().int().nonnegative(),
});

const promptMetricSummarySchema = z.object({
  abandonedEmpty: z.number().int().nonnegative(),
  abandonedStarted: z.number().int().nonnegative(),
  hotkey: z.number().int().nonnegative(),
  menu: z.number().int().nonnegative(),
  sessions: z.number().int().nonnegative(),
  submitted: z.number().int().nonnegative(),
});

export function createThinkMcpServer() {
  const server = new McpServer({
    name: 'think',
    version: pkg.version,
  });

  server.registerTool('capture', {
    description: 'Capture a raw thought into Think using the normal local-first capture core.',
    inputSchema: {
      ingress: z.enum(['url', 'shortcut', 'selected_text', 'share']).optional().describe('Optional additive provenance describing the ingress surface.'),
      sourceApp: z.string().optional().describe('Optional additive provenance naming the source application.'),
      sourceURL: z.string().url().optional().describe('Optional additive provenance naming the source URL when the sender provides one explicitly.'),
      text: z.string().describe('The raw thought text to capture exactly as written.'),
    },
    outputSchema: {
      backupStatus: z.enum(['backed_up', 'pending', 'skipped']),
      entryId: z.string(),
      migration: z.any().nullable(),
      repoBootstrapped: z.boolean(),
      status: z.literal('saved_locally'),
      warnings: z.array(z.string()),
    },
  }, async ({ ingress, sourceApp, sourceURL, text }) => toToolResult(await captureThought(text, {
    provenance: { ingress, sourceApp, sourceURL },
  })));

  server.registerTool('recent', {
    description: 'List recent raw captures from Think.',
    inputSchema: {
      count: z.number().int().positive().max(100).optional().describe('Optional maximum number of entries to return.'),
      query: z.string().optional().describe('Optional case-insensitive text filter.'),
    },
    outputSchema: {
      entries: z.array(recentEntrySchema),
      repoPresent: z.boolean(),
    },
  }, async ({ count, query }) => toToolResult(await listRecentThoughts({
    count: count ?? null,
    query: query ?? null,
  })));

  server.registerTool('remember', {
    description: 'Recall relevant thoughts by current project context or by an explicit query.',
    inputSchema: {
      brief: z.boolean().optional().describe('Whether to return triage-friendly one-line matches.'),
      limit: z.number().int().positive().max(50).optional().describe('Optional maximum number of matches to return.'),
      query: z.string().optional().describe('Optional explicit recall query. When omitted, uses ambient project context.'),
    },
    outputSchema: {
      matches: z.array(z.any()),
      repoPresent: z.boolean(),
      scope: z.any(),
    },
  }, async ({ brief, limit, query }) => toToolResult(await rememberThoughtsForMcp({
    brief: brief ?? false,
    limit: limit ?? null,
    query: query ?? null,
  })));

  server.registerTool('browse', {
    description: 'Return a browse window for one thought, including chronology and session neighbors. If entryId is omitted, starts from the latest capture.',
    inputSchema: {
      entryId: z.string().optional().describe('Optional capture entry id. When omitted, uses the latest capture.'),
    },
    outputSchema: {
      current: browseEntrySchema,
      newer: browseEntrySchema.nullable(),
      older: browseEntrySchema.nullable(),
      sessionContext: z.any().nullable(),
      sessionEntries: z.array(browseEntrySchema),
      sessionSteps: z.array(z.object({
        createdAt: z.string(),
        direction: z.enum(['next', 'previous']),
        entryId: z.string(),
        sessionId: z.string().nullable(),
        sessionPosition: z.number().int().positive().nullable(),
        sortKey: z.string(),
        text: z.string(),
      })),
    },
  }, async ({ entryId }) => toToolResult(await browseThought({
    entryId: entryId ?? null,
  })));

  server.registerTool('inspect', {
    description: 'Inspect one raw capture, including canonical thought identity and derived receipts.',
    inputSchema: {
      entryId: z.string().describe('The raw capture entry id to inspect.'),
    },
    outputSchema: {
      entry: z.any(),
    },
  }, async ({ entryId }) => toToolResult(await inspectThought(entryId)));

  server.registerTool('stats', {
    description: 'Summarize total thought counts with optional time filters and bucketing.',
    inputSchema: {
      bucket: z.enum(['day', 'hour', 'week']).optional(),
      from: z.string().optional().describe('Optional ISO timestamp or date lower bound.'),
      since: z.string().optional().describe('Optional relative window like 24h, 7d, or 2w.'),
      to: z.string().optional().describe('Optional ISO timestamp or date upper bound.'),
    },
    outputSchema: {
      buckets: z.array(bucketSchema).nullable(),
      repoPresent: z.boolean(),
      total: z.number().int().nonnegative(),
    },
  }, async ({ bucket, from, since, to }) => toToolResult(await getThoughtStats({
    bucket: bucket ?? null,
    from: from ?? null,
    since: since ?? null,
    to: to ?? null,
  })));

  server.registerTool('prompt_metrics', {
    description: 'Read prompt UX telemetry counts and timing summaries.',
    inputSchema: {
      bucket: z.enum(['day', 'hour', 'week']).optional(),
      from: z.string().optional().describe('Optional ISO timestamp or date lower bound.'),
      since: z.string().optional().describe('Optional relative window like 24h, 7d, or 2w.'),
      to: z.string().optional().describe('Optional ISO timestamp or date upper bound.'),
    },
    outputSchema: {
      buckets: z.array(promptMetricBucketSchema).nullable(),
      summary: promptMetricSummarySchema,
      timings: z.array(promptMetricTimingSchema),
    },
  }, async ({ bucket, from, since, to }) => toToolResult(await getPromptMetricsForMcp({
    bucket: bucket ?? null,
    from: from ?? null,
    since: since ?? null,
    to: to ?? null,
  })));

  server.registerTool('migrate_graph', {
    description: 'Upgrade the local Think graph model in place.',
    outputSchema: {
      changed: z.boolean(),
      edgesAdded: z.number().int().nonnegative(),
      edgesRemoved: z.number().int().nonnegative(),
      graphModelVersion: z.number().int().positive(),
      metadataUpdated: z.boolean(),
    },
  }, async () => toToolResult(await migrateThoughtGraph()));

  return server;
}

export async function serveStdio() {
  const server = createThinkMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
