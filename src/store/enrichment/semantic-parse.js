/**
 * Classify a thought by structural type using pattern matching.
 * Returns multiple classifications when multiple patterns match.
 * No LLM — deterministic pattern-based.
 */

const PATTERNS = [
  {
    type: 'question',
    patterns: [
      /\?/,
      /^(how|what|why|when|where|who|can|should|could|would|is there|do we)\b/i,
    ],
  },
  {
    type: 'decision',
    patterns: [
      /\b(i decided|we decided|decision:|going with|chose to|picking)\b/i,
    ],
  },
  {
    type: 'observation',
    patterns: [
      /\b(i noticed|i observed|it seems|turns out|interesting that|realized)\b/i,
    ],
  },
  {
    type: 'action_item',
    patterns: [
      /\b(need to|todo|must\b|should do|action:|next step|follow up)\b/i,
    ],
  },
  {
    type: 'idea',
    patterns: [
      /\b(what if|idea:|concept:|maybe we could|imagine|proposal)\b/i,
    ],
  },
  {
    type: 'reference',
    patterns: [
      /https?:\/\//,
      /\b(see:|ref:|link:|source:)\b/i,
    ],
  },
];

export function classifyThought(text) {
  if (!text || typeof text !== 'string' || text.trim() === '') {
    return Object.freeze({ classifications: ['unclassified'], markers: [] });
  }

  const classifications = [];
  const markers = [];

  for (const { type, patterns } of PATTERNS) {
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        if (!classifications.includes(type)) {
          classifications.push(type);
        }
        markers.push(`${type}:${match[0]}`);
        break;
      }
    }
  }

  if (classifications.length === 0) {
    return Object.freeze({ classifications: ['unclassified'], markers: [] });
  }

  return Object.freeze({
    classifications: Object.freeze(classifications),
    markers: Object.freeze(markers),
  });
}
