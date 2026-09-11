import { createPublicSearchSnapshot } from "../adapters/publicSearchAdapter";
import { createPublicMetadata } from "../adapters/publicMetadataAdapter";
import {
  countSearchPublishedContentRows,
  searchPublishedContentPageRows,
  searchPublishedContentRows,
  type PublicContentSummaryReadRow
} from "../db/contentRepository";
import { readPublicShellMetadataRows } from "../db/publicMetadataRepository";
import type { Env } from "../env";
import {
  enforcePublicSearchRateLimit,
  PublicReadRateLimitExceeded,
  PublicReadRateLimitUnavailable
} from "../publicReadAbuseGuard";
import { json, jsonError } from "../responses";

const RESOURCE = "search";
const PHASE = "M17-B";
const MAX_SEARCH_QUERY_LENGTH = 160;

interface SearchPaginationInput {
  page: number;
  pageSize: number;
}

function getOptionalPaginationInput(url: URL): SearchPaginationInput | undefined {
  const pageValue = url.searchParams.get("page");

  if (pageValue === null) {
    return undefined;
  }

  const page = Number(pageValue);

  if (!Number.isInteger(page) || page <= 0) {
    return undefined;
  }

  const requestedPageSize = Number(url.searchParams.get("pageSize"));
  const pageSize = Number.isInteger(requestedPageSize) ? Math.min(Math.max(requestedPageSize, 1), 100) : 20;

  return { page, pageSize };
}

function createPagination(input: SearchPaginationInput, totalItems: number) {
  const totalPages = Math.max(1, Math.ceil(totalItems / input.pageSize));
  const page = Math.min(input.page, totalPages);

  return {
    page,
    pageSize: input.pageSize,
    totalItems,
    totalPages
  };
}

async function guardPublicSearch(request: Request, env: Env) {
  try {
    await enforcePublicSearchRateLimit(request, env);
    return null;
  } catch (error) {
    if (error instanceof PublicReadRateLimitExceeded) {
      return jsonError("public search rate limit exceeded", 429, {
        resource: RESOURCE,
        retryAfterSeconds: error.retryAfterSeconds
      });
    }

    if (error instanceof PublicReadRateLimitUnavailable) {
      return jsonError("public search rate limiter is unavailable", 503, {
        resource: RESOURCE,
        diagnostic: "public-search-rate-limiter-unavailable-v1"
      });
    }

    throw error;
  }
}

export async function publicSearch(request: Request, env: Env) {
  if (!env.DB) {
    return jsonError("database binding is not configured", 503, {
      resource: RESOURCE,
      phase: PHASE
    });
  }

  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";
  const paginationInput = getOptionalPaginationInput(url);

  if (query.length > MAX_SEARCH_QUERY_LENGTH) {
    return jsonError("search query is too long", 400, {
      resource: RESOURCE,
      maxLength: MAX_SEARCH_QUERY_LENGTH
    });
  }

  const rateLimited = await guardPublicSearch(request, env);
  if (rateLimited) {
    return rateLimited;
  }

  try {
    const shellMetadataPromise = readPublicShellMetadataRows(env);
    let rows: PublicContentSummaryReadRow[];
    let pagination: ReturnType<typeof createPagination> | undefined;

    if (paginationInput) {
      const totalItems = await countSearchPublishedContentRows(env, query);
      pagination = createPagination(paginationInput, totalItems);
      rows = await searchPublishedContentPageRows(env, query, {
        limit: pagination.pageSize,
        offset: (pagination.page - 1) * pagination.pageSize
      });
    } else {
      rows = await searchPublishedContentRows(env, query);
    }

    const shellMetadataRows = await shellMetadataPromise;
    const metadata = createPublicMetadata({
      ...shellMetadataRows,
      media: [],
      carouselSlides: [],
      externalServices: [],
      events: []
    });

    return json(createPublicSearchSnapshot(query, rows, metadata, new Date(), pagination));
  } catch {
    return jsonError("Unable to load search", 500, {
      resource: RESOURCE,
      phase: PHASE
    });
  }
}
