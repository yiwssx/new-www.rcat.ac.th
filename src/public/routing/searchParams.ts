export interface PublicPaginatedSearch extends Record<string, unknown> {
  page?: number;
}

export interface PublicFilteredPaginatedSearch extends PublicPaginatedSearch {
  tag?: string;
  category?: string;
}

export interface PublicAnnouncementsSearch extends Record<string, unknown> {
  announcementsPage?: number;
  pagesPage?: number;
  tag?: string;
  category?: string;
}

export interface PublicSearchRouteSearch extends PublicPaginatedSearch {
  q?: string;
}

function normalizeOptionalText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function normalizePublicPageSearchValue(value: unknown) {
  const page = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;

  if (!Number.isInteger(page) || page <= 1) {
    return undefined;
  }

  return page;
}

function setOptionalSearchValue(search: Record<string, unknown>, key: string, value: unknown) {
  if (value === undefined) {
    delete search[key];
    return;
  }

  search[key] = value;
}

export function validatePublicPaginatedSearch(search: Record<string, unknown>): PublicPaginatedSearch {
  const normalized: PublicPaginatedSearch = { ...search };
  setOptionalSearchValue(normalized, "page", normalizePublicPageSearchValue(search.page));
  return normalized;
}

export function validatePublicFilteredPaginatedSearch(
  search: Record<string, unknown>
): PublicFilteredPaginatedSearch {
  const normalized: PublicFilteredPaginatedSearch = validatePublicPaginatedSearch(search);
  setOptionalSearchValue(normalized, "tag", normalizeOptionalText(search.tag));
  setOptionalSearchValue(normalized, "category", normalizeOptionalText(search.category));
  return normalized;
}

export function validatePublicAnnouncementsSearch(search: Record<string, unknown>): PublicAnnouncementsSearch {
  const normalized: PublicAnnouncementsSearch = { ...search };
  setOptionalSearchValue(normalized, "announcementsPage", normalizePublicPageSearchValue(search.announcementsPage));
  setOptionalSearchValue(normalized, "pagesPage", normalizePublicPageSearchValue(search.pagesPage));
  setOptionalSearchValue(normalized, "tag", normalizeOptionalText(search.tag));
  setOptionalSearchValue(normalized, "category", normalizeOptionalText(search.category));
  return normalized;
}

export function validatePublicSearchRouteSearch(search: Record<string, unknown>): PublicSearchRouteSearch {
  const normalized: PublicSearchRouteSearch = validatePublicPaginatedSearch(search);
  setOptionalSearchValue(normalized, "q", normalizeOptionalText(search.q));
  return normalized;
}
