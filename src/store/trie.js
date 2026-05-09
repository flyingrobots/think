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
}
