// Common English stopwords. Kept minimal — domain terms should survive.
export const STOPWORDS = Object.freeze(new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'if', 'in', 'on', 'at',
  'to', 'for', 'of', 'with', 'by', 'from', 'as', 'is', 'was',
  'are', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
  'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may',
  'might', 'shall', 'can', 'need', 'must', 'not', 'no', 'nor',
  'so', 'than', 'too', 'very', 'just', 'about', 'above', 'after',
  'again', 'all', 'also', 'am', 'any', 'because', 'before',
  'between', 'both', 'each', 'few', 'get', 'got', 'her', 'here',
  'him', 'his', 'how', 'into', 'its', 'let', 'like', 'made',
  'make', 'many', 'more', 'most', 'much', 'my', 'now', 'off',
  'only', 'other', 'our', 'out', 'own', 'over', 'same', 'she',
  'some', 'still', 'such', 'take', 'that', 'their', 'them',
  'then', 'there', 'these', 'they', 'this', 'those', 'through',
  'under', 'until', 'up', 'us', 'use', 'used', 'using', 'want',
  'way', 'we', 'well', 'what', 'when', 'where', 'which', 'while',
  'who', 'why', 'you', 'your',
]));
