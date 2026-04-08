import { stringifyJson } from '../json.js';

export function toToolResult(structuredContent, richText = null) {
  const content = [];

  if (richText) {
    content.push({ type: 'text', text: richText });
  }

  content.push({ type: 'text', text: stringifyJson(structuredContent) });

  return {
    content,
    structuredContent,
  };
}
