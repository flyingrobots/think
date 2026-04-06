import { stringifyJson } from '../json.js';

export function toToolResult(structuredContent) {
  return {
    content: [
      {
        type: 'text',
        text: stringifyJson(structuredContent),
      },
    ],
    structuredContent,
  };
}
