import { STOPWORDS } from './stopwords.js';

const MIN_TOKEN_LENGTH = 3;

/**
 * Extract topic keywords from thought text.
 * Pure function — no graph, no LLM.
 *
 * Algorithm (v1: simple keyword extraction):
 * 1. Lowercase the text
 * 2. Split on whitespace and punctuation (preserving hyphens within words)
 * 3. Remove stopwords
 * 4. Remove tokens < 3 characters
 * 5. Deduplicate
 * 6. Return in order of first appearance
 */
export function extractTopics(text) {
  if (!text || typeof text !== 'string' || text.trim() === '') {
    return [];
  }

  const lower = text.toLowerCase();

  // Split on whitespace and punctuation, but preserve hyphens within words
  const tokens = lower
    .split(/[\s,.:;!?()[\]{}"'`]+/)
    .map((token) => token.replace(/^-+|-+$/g, ''))
    .filter(Boolean);

  const seen = new Set();
  const result = [];

  for (const token of tokens) {
    if (token.length < MIN_TOKEN_LENGTH) {
      continue;
    }
    if (STOPWORDS.has(token)) {
      continue;
    }
    if (seen.has(token)) {
      continue;
    }
    seen.add(token);
    result.push(token);
  }

  return result;
}
