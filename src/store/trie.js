/**
 * A lightweight in-memory Trie for fast prefix matching of keywords.
 * This is used to provide instant search-as-you-type in the TUI
 * without bloating the permanent Git/WARP graph with fragment nodes.
 */
export class KeywordTrie {
  constructor() {
    this.root = { children: {}, keyword: null };
  }

  /**
   * Insert a keyword from the graph into the in-memory Trie.
   */
  insert(keyword) {
    let current = this.root;
    for (const char of keyword.toLowerCase()) {
      if (!current.children[char]) {
        current.children[char] = { children: {}, keyword: null };
      }
      current = current.children[char];
    }
    current.keyword = keyword;
  }

  /**
   * Find all keywords that match the given prefix.
   */
  search(prefix) {
    let current = this.root;
    for (const char of prefix.toLowerCase()) {
      if (!current.children[char]) {
        return [];
      }
      current = current.children[char];
    }

    const results = [];
    this._collect(current, results);
    return results;
  }

  /**
   * Recursive helper to collect all keywords under a given node.
   */
  _collect(node, results) {
    if (node.keyword) {
      results.push(node.keyword);
    }
    for (const char of Object.keys(node.children)) {
      this._collect(node.children[char], results);
    }
  }

  /**
   * Find all keywords within a certain edit distance of the query.
   */
  searchFuzzy(query, maxDistance = 2) {
    const results = [];
    const lowerQuery = query.toLowerCase();

    // Small optimization: collect all keywords and filter by distance.
    // For a more advanced approach, we'd use a recursive search on the trie branches.
    const allKeywords = [];
    this._collect(this.root, allKeywords);

    for (const keyword of allKeywords) {
      const distance = levenshteinDistance(lowerQuery, keyword.toLowerCase());
      if (distance <= maxDistance) {
        results.push({ keyword, distance });
      }
    }

    return results.sort((a, b) => a.distance - b.distance);
  }
}

/**
 * Calculate the Levenshtein distance between two strings.
 * Used for fuzzy matching and ranking.
 */
export function levenshteinDistance(s1, s2) {
  const m = s1.length;
  const n = s2.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) { dp[i][0] = i; }
  for (let j = 0; j <= n; j++) { dp[0][j] = j; }

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1, // deletion
        dp[i][j - 1] + 1, // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return dp[m][n];
}
