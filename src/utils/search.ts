import { ContentItem } from "../types";

interface ScoredSearchResult {
  item: ContentItem;
  score: number;
}

export function normalizeSearchTerms(query: string) {
  return query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean);
}

function getSearchHaystack(item: ContentItem) {
  return [item.title, item.summary, item.category, ...(item.tags ?? []), item.type, item.owner, item.body]
    .join(" ")
    .toLowerCase();
}

function getSearchScore(item: ContentItem, query: string, terms: string[]) {
  const title = item.title.toLowerCase();
  const summary = item.summary.toLowerCase();
  const categoryAndTags = [item.category, ...(item.tags ?? [])].join(" ").toLowerCase();
  const normalizedQuery = query.trim().toLowerCase();

  return terms.reduce((score, term) => {
    let nextScore = score;

    if (normalizedQuery && title.includes(normalizedQuery)) {
      nextScore += 5;
    }

    if (title.includes(term)) {
      nextScore += 3;
    }

    if (summary.includes(term)) {
      nextScore += 2;
    }

    if (categoryAndTags.includes(term)) {
      nextScore += 1;
    }

    return nextScore;
  }, 0);
}

export function searchPublishedContent(items: ContentItem[], query: string) {
  const terms = normalizeSearchTerms(query);

  if (!terms.length) {
    return [];
  }

  return items
    .filter((item) => item.status === "published")
    .map((item): ScoredSearchResult | null => {
      const haystack = getSearchHaystack(item);

      if (!terms.every((term) => haystack.includes(term))) {
        return null;
      }

      return {
        item,
        score: getSearchScore(item, query, terms)
      };
    })
    .filter((result): result is ScoredSearchResult => Boolean(result))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return new Date(right.item.publishAt).getTime() - new Date(left.item.publishAt).getTime();
    })
    .map((result) => result.item);
}
