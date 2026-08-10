import type { SearchItem } from './schema';

export interface RankedSearchItem {
  item: SearchItem;
  score: number;
}

const KIND_WEIGHT: Record<SearchItem['kind'], number> = {
  query: -8,
  mutation: -7,
  subscription: -6,
  type: -4,
  field: 0,
  enum: 2,
  argument: 3,
};

/**
 * A schema-specific fuzzy finder. It avoids building a second, memory-heavy
 * token index and stays responsive on graphs with hundreds of thousands of
 * definitions. Lower scores are better.
 */
export function fuzzySearch(items: SearchItem[], rawQuery: string, limit = 24): SearchItem[] {
  const query = normalize(rawQuery);
  if (query.length < 2) return [];

  const ranked: RankedSearchItem[] = [];
  let cutoff = Number.POSITIVE_INFINITY;

  for (const item of items) {
    const titleScore = scoreCandidate(query, item.title);
    const contextScore = item.context ? scoreCandidate(query, item.context) + 8 : Number.POSITIVE_INFINITY;
    const keywordScore = item.keywords.includes(query) ? 25 : Number.POSITIVE_INFINITY;
    const score = Math.min(titleScore, contextScore, keywordScore) + KIND_WEIGHT[item.kind];

    if (!Number.isFinite(score) || score > cutoff) continue;
    ranked.push({ item, score });

    // Periodically prune so broad searches never accumulate a huge result set.
    if (ranked.length >= limit * 8) {
      ranked.sort(compareRanked);
      ranked.length = limit * 2;
      cutoff = ranked[ranked.length - 1]?.score ?? Number.POSITIVE_INFINITY;
    }
  }

  return ranked.sort(compareRanked).slice(0, limit).map((entry) => entry.item);
}

function scoreCandidate(query: string, candidate: string): number {
  if (candidate.length === query.length && startsWithIgnoreCase(candidate, query)) return 0;
  if (startsWithIgnoreCase(candidate, query)) return 4 + (candidate.length - query.length) * 0.03;

  const substringIndex = indexOfIgnoreCase(candidate, query);
  if (substringIndex >= 0) return 12 + substringIndex * 0.4 + (candidate.length - query.length) * 0.02;

  // Ordered subsequence matching handles missing characters and common typos
  // such as "usrprfle" → "userProfile" without an O(n*m) edit-distance table.
  let queryIndex = 0;
  let previousMatch = -1;
  let gapPenalty = 0;
  let boundaryBonus = 0;

  for (let candidateIndex = 0; candidateIndex < candidate.length && queryIndex < query.length; candidateIndex++) {
    if (toLowerAscii(candidate.charCodeAt(candidateIndex)) !== query.charCodeAt(queryIndex)) continue;
    if (previousMatch >= 0) gapPenalty += candidateIndex - previousMatch - 1;
    if (candidateIndex === 0 || '.-_ '.includes(candidate[candidateIndex - 1])) boundaryBonus += 2;
    previousMatch = candidateIndex;
    queryIndex++;
  }

  if (queryIndex !== query.length) return Number.POSITIVE_INFINITY;
  return 34 + gapPenalty * 1.7 + Math.max(0, candidate.length - query.length) * 0.08 - boundaryBonus;
}

function startsWithIgnoreCase(candidate: string, query: string) {
  if (query.length > candidate.length) return false;
  for (let index = 0; index < query.length; index++) {
    if (toLowerAscii(candidate.charCodeAt(index)) !== query.charCodeAt(index)) return false;
  }
  return true;
}

function indexOfIgnoreCase(candidate: string, query: string) {
  const lastStart = candidate.length - query.length;
  for (let start = 0; start <= lastStart; start++) {
    let queryIndex = 0;
    while (
      queryIndex < query.length &&
      toLowerAscii(candidate.charCodeAt(start + queryIndex)) === query.charCodeAt(queryIndex)
    ) {
      queryIndex++;
    }
    if (queryIndex === query.length) return start;
  }
  return -1;
}

function toLowerAscii(code: number) {
  return code >= 65 && code <= 90 ? code + 32 : code;
}

function compareRanked(left: RankedSearchItem, right: RankedSearchItem) {
  return left.score - right.score || left.item.title.length - right.item.title.length || left.item.title.localeCompare(right.item.title);
}

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}
