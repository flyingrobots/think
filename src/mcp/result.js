import { stringifyJson } from '../json.js';

/**
 * Base class for all MCP tool outcomes.
 * Adheres to Infrastructure Doctrine P3.
 */
export class McpOutcome {
  /**
   * @param {Object} structuredContent
   * @param {string|null} richText
   */
  constructor(structuredContent, richText = null) {
    this.structuredContent = structuredContent;
    this.richText = richText;
    Object.freeze(this);
  }

  /**
   * Format the outcome for the Model Context Protocol.
   */
  toToolResult() {
    const content = [];

    if (this.richText) {
      content.push({ type: 'text', text: this.richText });
    }

    content.push({ type: 'text', text: stringifyJson(this.structuredContent) });

    return Object.freeze({
      content: Object.freeze(content),
      structuredContent: this.structuredContent,
    });
  }
}

export class CaptureOutcome extends McpOutcome {
  constructor(data) {
    const richText = `Thought captured: ${data.entryId}`;
    super(data, richText);
  }
}

export class BrowseOutcome extends McpOutcome {}

export class RecentThoughtsOutcome extends McpOutcome {
  constructor(data) {
    const richText = `Showing ${data.entries.length} recent thoughts (Total: ${data.total}).`;
    super(data, richText);
  }
}

export class RememberOutcome extends McpOutcome {
  constructor(data) {
    const richText = `Found ${data.matches.length} matching thoughts for query: "${data.scope.query || 'ambient context'}".`;
    super(data, richText);
  }
}

export class StatsOutcome extends McpOutcome {}

export class PromptMetricsOutcome extends McpOutcome {
  constructor(data) {
    const richText = `Read prompt UX telemetry for ${data.summary.sessions} sessions.`;
    super(data, richText);
  }
}

export class HealthOutcome extends McpOutcome {
  constructor(data) {
    const status = data.ok ? 'Healthy' : 'Issues found';
    super(data, `Think Health: ${status}`);
  }
}

export class MigrationOutcome extends McpOutcome {
  constructor(data) {
    const richText = `Graph migrated to version ${data.graphModelVersion}. Edges added: ${data.edgesAdded}.`;
    super(data, richText);
  }
}

/**
 * Legacy wrapper for plain object results.
 * @deprecated Use specialized Outcome classes instead.
 */
export function toToolResult(structuredContent, richText = null) {
  return new McpOutcome(structuredContent, richText).toToolResult();
}
