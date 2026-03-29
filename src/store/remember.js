import { buildQueryTerms, getAmbientProjectContext } from '../project-context.js';
import { normalizeSeed } from './model.js';

export function buildAmbientRememberScope(cwd) {
  const context = getAmbientProjectContext(cwd);

  return {
    scopeKind: 'ambient_project',
    cwd: context.cwd,
    gitRoot: context.gitRoot,
    gitRemote: context.gitRemote,
    gitBranch: context.gitBranch,
    projectName: context.projectName,
    projectTokens: context.projectTokens,
  };
}

export function buildExplicitRememberScope(query) {
  return {
    scopeKind: 'query',
    queryText: String(query).trim(),
    queryTerms: buildQueryTerms(query),
  };
}

export function buildAmbientRememberMatch(entry, scope) {
  const matchKinds = [];
  let tier = 0;
  let score = 0;
  let reasonText = '';
  let hasProjectScopedAmbientMatch = false;

  if (scope.gitRemote && entry.ambientGitRemote === scope.gitRemote) {
    matchKinds.push('ambient_git_remote');
    tier = 3;
    score += 100;
    reasonText = 'matched current git remote';
    hasProjectScopedAmbientMatch = true;
  }

  if (scope.gitRoot && entry.ambientGitRoot === scope.gitRoot) {
    matchKinds.push('ambient_git_root');
    tier = Math.max(tier, 3);
    score += 80;
    if (!reasonText) {
      reasonText = 'matched current git root';
    }
    hasProjectScopedAmbientMatch = true;
  }

  if (scope.cwd && entry.ambientCwd === scope.cwd) {
    matchKinds.push('ambient_cwd');
    tier = Math.max(tier, 3);
    score += 60;
    if (!reasonText) {
      reasonText = 'matched current working directory';
    }
    hasProjectScopedAmbientMatch = true;
  }

  if (
    hasProjectScopedAmbientMatch
    && scope.gitBranch
    && entry.ambientGitBranch
    && entry.ambientGitBranch === scope.gitBranch
  ) {
    matchKinds.push('ambient_git_branch');
    tier = Math.max(tier, 3);
    score += 10;
    if (!reasonText) {
      reasonText = 'matched current git branch';
    }
  }

  const fallbackToken = findFirstMatchingTerm(entry.text, scope.projectTokens);
  if (fallbackToken) {
    matchKinds.push(tier > 0 ? 'project_tokens_text' : 'fallback_text');
    tier = Math.max(tier, tier > 0 ? 3 : 2);
    score += tier > 2 ? 15 : 30;
    if (!reasonText) {
      reasonText = `fallback textual match on project token "${fallbackToken}"`;
    }
  }

  if (tier === 0) {
    return null;
  }

  return {
    entryId: entry.id,
    text: entry.text,
    sortKey: entry.sortKey,
    createdAt: entry.createdAt,
    score,
    tier,
    matchKinds,
    reasonText,
  };
}

export function buildExplicitRememberMatch(entry, scope) {
  const normalizedText = normalizeSeed(entry.text);
  const normalizedQuery = normalizeSeed(scope.queryText);
  const matchedTerms = scope.queryTerms.filter((term) => normalizedText.includes(term));

  if (!normalizedText.includes(normalizedQuery) && matchedTerms.length === 0) {
    return null;
  }

  const matchKinds = normalizedText.includes(normalizedQuery)
    ? ['query_phrase']
    : ['query_terms'];
  const reasonText = normalizedText.includes(normalizedQuery)
    ? `matched query phrase "${scope.queryText}"`
    : `matched query terms "${matchedTerms.join('", "')}"`;

  return {
    entryId: entry.id,
    text: entry.text,
    sortKey: entry.sortKey,
    createdAt: entry.createdAt,
    score: matchedTerms.length || 1,
    tier: 1,
    matchKinds,
    reasonText,
  };
}

export function compareRememberMatches(left, right) {
  if (left.tier !== right.tier) {
    return right.tier - left.tier;
  }

  if (left.sortKey === right.sortKey) {
    return right.entryId.localeCompare(left.entryId);
  }

  return right.sortKey.localeCompare(left.sortKey);
}

export function finalizeRememberMatches(matches, { brief, limit }) {
  const bounded = Number.isInteger(limit) ? matches.slice(0, limit) : matches;
  if (!brief) {
    return bounded;
  }

  return bounded.map((match) => ({
    ...match,
    text: toRememberBriefText(match.text),
  }));
}

export function toRememberBriefText(text) {
  const [firstLine = ''] = String(text).split('\n');
  return firstLine.trim();
}

export function findFirstMatchingTerm(text, terms) {
  const normalized = normalizeSeed(text);
  return terms.find((term) => normalized.includes(term)) ?? null;
}

export function matchesRecentQuery(text, query) {
  return String(text).toLowerCase().includes(String(query).trim().toLowerCase());
}
