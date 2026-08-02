import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const write = (file, content) => {
  const target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content.endsWith("\n") ? content : `${content}\n`);
};
const replace = (file, from, to) => {
  const source = read(file);
  if (!source.includes(from)) throw new Error(`Missing expected source in ${file}: ${from.slice(0, 120)}`);
  write(file, source.replace(from, to));
};
const replaceRegex = (file, pattern, replacement) => {
  const source = read(file);
  if (!pattern.test(source)) throw new Error(`Missing expected regex source in ${file}: ${pattern}`);
  write(file, source.replace(pattern, replacement));
};

// 1) Request-safe factories while preserving current CSR behavior.
write("src/app/createAppQueryClient.ts", `import { QueryClient } from "@tanstack/react-query";
import { projectSettings } from "../config/projectSettings";

export function createAppQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: projectSettings.query.staleTimeMs,
        gcTime: projectSettings.query.gcTimeMs,
        retry: projectSettings.query.retry,
        refetchOnMount: projectSettings.query.refetchOnMount,
        refetchOnReconnect: projectSettings.query.refetchOnReconnect,
        refetchOnWindowFocus: projectSettings.query.refetchOnWindowFocus
      }
    }
  });
}
`);

write("src/App.tsx", `import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { createAppQueryClient } from "./app/createAppQueryClient";
import { router } from "./routes";
import { theme } from "./theme";

const browserQueryClient = createAppQueryClient();

export default function App() {
  return (
    <QueryClientProvider client={browserQueryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
`);

replace(
  "src/routes.tsx",
  `export const router = createRouter({\n  routeTree,\n  defaultPreload: "intent"\n});`,
  `export function createAppRouter() {\n  return createRouter({\n    routeTree,\n    defaultPreload: "intent"\n  });\n}\n\nexport const router = createAppRouter();`
);

// 2) Server-safe query definitions and abort/error plumbing.
replace(
  "src/features/public-read/cloudflareApi.ts",
  `class CloudflarePublicApiError extends Error {`,
  `export class CloudflarePublicApiError extends Error {`
);
replace(
  "src/features/public-read/cloudflareApi.ts",
  `async function getCloudflareJson(path: string, resource: string) {\n  const response = await fetch(buildCloudflarePublicApiUrl(path), {\n    method: "GET",\n    headers: {\n      Accept: "application/json"\n    }\n  });`,
  `export interface PublicReadRequestOptions {\n  signal?: AbortSignal;\n}\n\nexport function getCloudflarePublicApiErrorStatus(error: unknown) {\n  return error instanceof CloudflarePublicApiError ? error.status : null;\n}\n\nexport function isCloudflarePublicApiUnavailableError(error: unknown) {\n  const status = getCloudflarePublicApiErrorStatus(error);\n  return status === 502 || status === 503 || status === 504;\n}\n\nasync function getCloudflareJson(path: string, resource: string, options: PublicReadRequestOptions = {}) {\n  const response = await fetch(buildCloudflarePublicApiUrl(path), {\n    method: "GET",\n    headers: {\n      Accept: "application/json"\n    },\n    ...(options.signal ? { signal: options.signal } : {})\n  });`
);
replace(
  "src/features/public-read/cloudflareApi.ts",
  `export async function getPublicHomeSnapshotFromCloudflare(): Promise<PublicHomeSnapshot> {\n  const payload = await getCloudflareJson("/api/public/home", "public-home");`,
  `export async function getPublicHomeSnapshotFromCloudflare(\n  options: PublicReadRequestOptions = {}\n): Promise<PublicHomeSnapshot> {\n  const payload = await getCloudflareJson("/api/public/home", "public-home", options);`
);
replace(
  "src/features/public-read/cloudflareApi.ts",
  `export async function getPublicContentListSnapshotFromCloudflare(\n  kind: PublicContentListKind\n): Promise<PublicContentListSnapshot> {\n  const payload = await getCloudflareJson(\`/api/public/content?kind=\${encodeURIComponent(kind)}\`, "content-list");`,
  `export async function getPublicContentListSnapshotFromCloudflare(\n  kind: PublicContentListKind,\n  options: PublicReadRequestOptions = {}\n): Promise<PublicContentListSnapshot> {\n  const payload = await getCloudflareJson(\`/api/public/content?kind=\${encodeURIComponent(kind)}\`, "content-list", options);`
);
replace(
  "src/features/public-read/cloudflareApi.ts",
  `export async function getContentDetailFromCloudflare(input: { id?: string; slug?: string }): Promise<ContentItem> {`,
  `export async function getContentDetailFromCloudflare(\n  input: { id?: string; slug?: string },\n  options: PublicReadRequestOptions = {}\n): Promise<ContentItem> {`
);
replace(
  "src/features/public-read/cloudflareApi.ts",
  `  const payload = await getCloudflareJson(\`/api/public/content/\${encodeURIComponent(identifier)}\`, "content-detail");`,
  `  const payload = await getCloudflareJson(\n    \`/api/public/content/\${encodeURIComponent(identifier)}\`,\n    "content-detail",\n    options\n  );`
);
replace(
  "src/features/public-read/cloudflareApi.ts",
  `export async function getPublicProgramListSnapshotFromCloudflare(): Promise<PublicProgramListSnapshot> {\n  const payload = await getCloudflareJson("/api/public/programs", "program");`,
  `export async function getPublicProgramListSnapshotFromCloudflare(\n  options: PublicReadRequestOptions = {}\n): Promise<PublicProgramListSnapshot> {\n  const payload = await getCloudflareJson("/api/public/programs", "program", options);`
);
replace(
  "src/features/public-read/cloudflareApi.ts",
  `export async function getPublicSearchIndexSnapshotFromCloudflare(): Promise<PublicSearchIndexSnapshot> {\n  const payload = await getCloudflareJson("/api/public/search", "search");`,
  `export async function getPublicSearchIndexSnapshotFromCloudflare(\n  query = "",\n  options: PublicReadRequestOptions = {}\n): Promise<PublicSearchIndexSnapshot> {\n  const path = query.trim() ? \`/api/public/search?q=\${encodeURIComponent(query.trim())}\` : "/api/public/search";\n  const payload = await getCloudflareJson(path, "search", options);`
);

write("src/features/public-home/api.ts", `import { getPublicHomeSnapshotFromCloudflare, type PublicReadRequestOptions } from "../public-read/cloudflareApi";

export function getPublicHomeSnapshot(options: PublicReadRequestOptions = {}) {
  return getPublicHomeSnapshotFromCloudflare(options);
}
`);
write("src/features/public-content/api.ts", `import {
  getContentDetailFromCloudflare,
  getPublicContentListSnapshotFromCloudflare,
  isCloudflarePublicApiNotFoundError,
  type PublicReadRequestOptions
} from "../public-read/cloudflareApi";
import type { PublicContentListKind } from "./types";

export function getPublicContentListSnapshot(kind: PublicContentListKind, options: PublicReadRequestOptions = {}) {
  return getPublicContentListSnapshotFromCloudflare(kind, options);
}

export function getContentDetail(input: { id?: string; slug?: string }, options: PublicReadRequestOptions = {}) {
  return getContentDetailFromCloudflare(input, options);
}

export function isPublicContentNotFoundError(error: unknown) {
  return isCloudflarePublicApiNotFoundError(error);
}
`);
write("src/features/public-programs/api.ts", `import { getPublicProgramListSnapshotFromCloudflare, type PublicReadRequestOptions } from "../public-read/cloudflareApi";

export function getPublicProgramListSnapshot(options: PublicReadRequestOptions = {}) {
  return getPublicProgramListSnapshotFromCloudflare(options);
}
`);
write("src/features/public-search/api.ts", `import { getPublicSearchIndexSnapshotFromCloudflare, type PublicReadRequestOptions } from "../public-read/cloudflareApi";

export function getPublicSearchIndexSnapshot(query = "", options: PublicReadRequestOptions = {}) {
  return getPublicSearchIndexSnapshotFromCloudflare(query, options);
}
`);

write("src/public/queryOptions.ts", `import { queryOptions } from "@tanstack/react-query";
import {
  getPublicHomeSnapshot,
  PUBLIC_HOME_CACHE_TTL_MS,
  setPublicHomeCache
} from "../features/public-home";
import {
  getContentDetail,
  getPublicContentListSnapshot,
  isPublicContentNotFoundError,
  PUBLIC_CONTENT_DETAIL_CACHE_TTL_MS,
  PUBLIC_CONTENT_LIST_CACHE_TTL_MS,
  removePublicContentDetailCache,
  setPublicContentDetailCache,
  setPublicContentListCache
} from "../features/public-content";
import { getPublicProgramListSnapshot, PUBLIC_PROGRAM_LIST_CACHE_TTL_MS, setPublicProgramListCache } from "../features/public-programs";
import { getPublicSearchIndexSnapshot, PUBLIC_SEARCH_INDEX_CACHE_TTL_MS, setPublicSearchIndexCache } from "../features/public-search";
import type { PublicContentListKind } from "../types";

const publicGcTimeMs = 60 * 60 * 1000;

export function publicHomeQueryOptions() {
  return queryOptions({
    queryKey: ["public-home-snapshot"] as const,
    queryFn: async ({ signal }) => {
      const snapshot = await getPublicHomeSnapshot({ signal });
      setPublicHomeCache(snapshot);
      return snapshot;
    },
    staleTime: PUBLIC_HOME_CACHE_TTL_MS,
    gcTime: publicGcTimeMs,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true
  });
}

export function publicContentListQueryOptions(kind: PublicContentListKind) {
  return queryOptions({
    queryKey: ["public-content-list", kind] as const,
    queryFn: async ({ signal }) => {
      const snapshot = await getPublicContentListSnapshot(kind, { signal });
      setPublicContentListCache(kind, snapshot);
      return snapshot;
    },
    staleTime: PUBLIC_CONTENT_LIST_CACHE_TTL_MS,
    gcTime: publicGcTimeMs,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true
  });
}

export function publicContentDetailQueryOptions(slug: string | undefined) {
  return queryOptions({
    queryKey: ["content-detail", slug] as const,
    queryFn: async ({ signal }) => {
      if (!slug) throw new Error("Content slug is required.");
      try {
        const content = await getContentDetail({ slug }, { signal });
        setPublicContentDetailCache(slug, content);
        return content;
      } catch (error) {
        if (isPublicContentNotFoundError(error)) {
          removePublicContentDetailCache(slug);
          return null;
        }
        throw error;
      }
    },
    enabled: Boolean(slug),
    staleTime: PUBLIC_CONTENT_DETAIL_CACHE_TTL_MS,
    gcTime: publicGcTimeMs,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true
  });
}

export function publicProgramListQueryOptions() {
  return queryOptions({
    queryKey: ["public-program-list"] as const,
    queryFn: async ({ signal }) => {
      const snapshot = await getPublicProgramListSnapshot({ signal });
      setPublicProgramListCache(snapshot);
      return snapshot;
    },
    staleTime: PUBLIC_PROGRAM_LIST_CACHE_TTL_MS,
    gcTime: publicGcTimeMs,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true
  });
}

export function publicSearchQueryOptions(query = "") {
  const normalizedQuery = query.trim();
  return queryOptions({
    queryKey: ["public-search", normalizedQuery] as const,
    queryFn: async ({ signal }) => {
      const snapshot = await getPublicSearchIndexSnapshot(normalizedQuery, { signal });
      setPublicSearchIndexCache(snapshot);
      return snapshot;
    },
    staleTime: PUBLIC_SEARCH_INDEX_CACHE_TTL_MS,
    gcTime: publicGcTimeMs,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true
  });
}
`);

write("src/public/hooks/usePublicHomeSnapshot.ts", `import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getPublicHomeCache, PUBLIC_HOME_CACHE_TTL_MS } from "../../features/public-home";
import { publicHomeQueryOptions } from "../queryOptions";

function isFresh(savedAt: number, ttlMs: number) {
  return savedAt + ttlMs > Date.now();
}

export function usePublicHomeSnapshot() {
  const cachedSnapshot = useMemo(() => getPublicHomeCache(), []);
  const hasFreshCache = cachedSnapshot ? isFresh(cachedSnapshot.savedAt, PUBLIC_HOME_CACHE_TTL_MS) : false;
  return useQuery({
    ...publicHomeQueryOptions(),
    initialData: cachedSnapshot?.data,
    initialDataUpdatedAt: cachedSnapshot?.savedAt,
    refetchOnMount: cachedSnapshot ? !hasFreshCache : true
  });
}
`);
write("src/public/hooks/usePublicContentList.ts", `import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getPublicContentListCache, PUBLIC_CONTENT_LIST_CACHE_TTL_MS } from "../../features/public-content";
import type { PublicContentListKind } from "../../types";
import { publicContentListQueryOptions } from "../queryOptions";

function isFresh(savedAt: number, ttlMs: number) {
  return savedAt + ttlMs > Date.now();
}

export function usePublicContentList(kind: PublicContentListKind) {
  const cachedSnapshot = useMemo(() => getPublicContentListCache(kind), [kind]);
  const hasFreshCache = cachedSnapshot ? isFresh(cachedSnapshot.savedAt, PUBLIC_CONTENT_LIST_CACHE_TTL_MS) : false;
  return useQuery({
    ...publicContentListQueryOptions(kind),
    initialData: cachedSnapshot?.data,
    initialDataUpdatedAt: cachedSnapshot?.savedAt,
    refetchOnMount: cachedSnapshot ? !hasFreshCache : true
  });
}
`);
write("src/public/hooks/usePublicContentDetail.ts", `import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getPublicContentDetailCache, PUBLIC_CONTENT_DETAIL_CACHE_TTL_MS } from "../../features/public-content";
import { publicContentDetailQueryOptions } from "../queryOptions";

function isFresh(savedAt: number, ttlMs: number) {
  return savedAt + ttlMs > Date.now();
}

export function usePublicContentDetail(input: { slug?: string }) {
  const slug = input.slug;
  const cachedContent = useMemo(() => getPublicContentDetailCache(slug), [slug]);
  const hasFreshCache = cachedContent ? isFresh(cachedContent.savedAt, PUBLIC_CONTENT_DETAIL_CACHE_TTL_MS) : false;
  return useQuery({
    ...publicContentDetailQueryOptions(slug),
    initialData: cachedContent?.data,
    initialDataUpdatedAt: cachedContent?.savedAt,
    refetchOnMount: cachedContent ? !hasFreshCache : true
  });
}
`);
write("src/public/hooks/usePublicProgramList.ts", `import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getPublicProgramListCache, PUBLIC_PROGRAM_LIST_CACHE_TTL_MS } from "../../features/public-programs";
import { publicProgramListQueryOptions } from "../queryOptions";

function isFresh(savedAt: number, ttlMs: number) {
  return savedAt + ttlMs > Date.now();
}

export function usePublicProgramList() {
  const cachedSnapshot = useMemo(() => getPublicProgramListCache(), []);
  const hasFreshCache = cachedSnapshot ? isFresh(cachedSnapshot.savedAt, PUBLIC_PROGRAM_LIST_CACHE_TTL_MS) : false;
  return useQuery({
    ...publicProgramListQueryOptions(),
    initialData: cachedSnapshot?.data,
    initialDataUpdatedAt: cachedSnapshot?.savedAt,
    refetchOnMount: cachedSnapshot ? !hasFreshCache : true
  });
}
`);
write("src/public/hooks/usePublicSearchIndex.ts", `import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getPublicSearchIndexCache, PUBLIC_SEARCH_INDEX_CACHE_TTL_MS } from "../../features/public-search";
import { publicSearchQueryOptions } from "../queryOptions";

function isFresh(savedAt: number, ttlMs: number) {
  return savedAt + ttlMs > Date.now();
}

export function usePublicSearchIndex(query = "") {
  const normalizedQuery = query.trim();
  const cachedSnapshot = useMemo(() => (normalizedQuery ? null : getPublicSearchIndexCache()), [normalizedQuery]);
  const hasFreshCache = cachedSnapshot ? isFresh(cachedSnapshot.savedAt, PUBLIC_SEARCH_INDEX_CACHE_TTL_MS) : false;
  return useQuery({
    ...publicSearchQueryOptions(normalizedQuery),
    initialData: cachedSnapshot?.data,
    initialDataUpdatedAt: cachedSnapshot?.savedAt,
    refetchOnMount: cachedSnapshot ? !hasFreshCache : true
  });
}
`);

// 3) Make URL state router-owned instead of window-owned.
write("src/public/hooks/usePublicPagination.ts", `import { useCallback, useEffect, useMemo, useRef } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";

interface UsePublicPaginationOptions {
  pageSize: number;
  queryParam?: string;
  resetKeys?: readonly unknown[];
  scrollTargetId?: string;
}

function normalizePageSize(value: number) {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.floor(value));
}

function readPage(search: Record<string, unknown>, queryParam: string) {
  const value = Number(search[queryParam]);
  return Number.isInteger(value) && value >= 1 ? value : 1;
}

function createResetSignature(resetKeys: readonly unknown[]) {
  return resetKeys.map((value) => String(value ?? "")).join("\\u001f");
}

export function usePublicPagination<T>(
  items: readonly T[],
  { pageSize, queryParam = "page", resetKeys = [], scrollTargetId }: UsePublicPaginationOptions
) {
  const navigate = useNavigate();
  const search = useRouterState({ select: (state) => state.location.search as Record<string, unknown> });
  const normalizedPageSize = normalizePageSize(pageSize);
  const totalItems = items.length;
  const pageCount = Math.max(1, Math.ceil(totalItems / normalizedPageSize));
  const requestedPage = readPage(search, queryParam);
  const page = Math.min(requestedPage, pageCount);
  const startIndex = (page - 1) * normalizedPageSize;
  const endIndex = Math.min(startIndex + normalizedPageSize, totalItems);
  const resetSignature = createResetSignature(resetKeys);
  const previousResetSignatureRef = useRef(resetSignature);

  const updatePage = useCallback(
    (nextPage: number, options: { replace?: boolean; scroll?: boolean } = {}) => {
      const clampedPage = Math.min(Math.max(1, Math.floor(nextPage)), pageCount);
      void navigate({
        replace: options.replace,
        search: (current) => {
          const next = { ...(current as Record<string, unknown>) };
          if (clampedPage <= 1) delete next[queryParam];
          else next[queryParam] = clampedPage;
          return next;
        }
      });

      if (options.scroll && scrollTargetId && typeof window !== "undefined") {
        window.requestAnimationFrame(() => document.getElementById(scrollTargetId)?.scrollIntoView({ behavior: "smooth", block: "start" }));
      }
    },
    [navigate, pageCount, queryParam, scrollTargetId]
  );

  useEffect(() => {
    const previousSignature = previousResetSignatureRef.current;
    if (previousSignature !== resetSignature) {
      previousResetSignatureRef.current = resetSignature;
      if (readPage(search, queryParam) !== 1) updatePage(1, { replace: true });
    }
  }, [queryParam, resetSignature, search, updatePage]);

  useEffect(() => {
    if (requestedPage !== page) updatePage(page, { replace: true });
  }, [page, requestedPage, updatePage]);

  const paginatedItems = useMemo(() => items.slice(startIndex, endIndex), [endIndex, items, startIndex]);
  return { page, pageCount, pageSize: normalizedPageSize, paginatedItems, setPage: updatePage, totalItems };
}
`);

for (const file of ["src/public/pages/PublicNewsPage.tsx", "src/public/pages/PublicAnnouncementsPage.tsx"]) {
  replace(file, `import { useMemo } from "react";`, `import { useMemo } from "react";\nimport { useRouterState } from "@tanstack/react-router";`);
  replaceRegex(file, /function readSearchParam\(name: string\) \{[\s\S]*?\n\}\n\n/, `function readSearchParam(search: Record<string, unknown>, name: string) {\n  const value = search[name];\n  return typeof value === "string" ? value.trim() : "";\n}\n\n`);
  replace(file, `  const { data, isLoading, isFetching, isError, refetch } = usePublicContentList(`, `  const search = useRouterState({ select: (state) => state.location.search as Record<string, unknown> });\n  const { data, isLoading, isFetching, isError, refetch } = usePublicContentList(`);
  replace(file, `  const activeTag = readSearchParam("tag");\n  const activeCategory = readSearchParam("category");`, `  const activeTag = readSearchParam(search, "tag");\n  const activeCategory = readSearchParam(search, "category");`);
}
replace("src/public/pages/PublicSearchPage.tsx", `  const { data, isLoading, isFetching, isError, refetch } = usePublicSearchIndex();`, `  const search = useRouterState({ select: (state) => state.location.search as Record<string, unknown> });\n  const query = getSearchQueryFromLocation(search);\n  const { data, isLoading, isFetching, isError, refetch } = usePublicSearchIndex(query);`);
replace("src/public/pages/PublicSearchPage.tsx", `  const search = useRouterState({ select: (state) => state.location.search as Record<string, unknown> });\n  const query = getSearchQueryFromLocation(search);\n  const [draftQuery, setDraftQuery] = useState(query);`, `  const [draftQuery, setDraftQuery] = useState(query);`);

// 4) Public API contract readiness: summary payloads, optional server pagination, shell endpoint, content-detail media.
replace(
  "cloudflare/public-api/src/contracts/publicContent.ts",
  `export interface PublicContentListSnapshotContract {\n  kind: "news" | "announcements" | "blog";\n  items: PublicContentItemContract[];\n  pageItems?: PublicContentItemContract[];`,
  `export type PublicContentSummaryContract = Omit<PublicContentItemContract, "body" | "content">;\n\nexport interface PublicContentPaginationContract {\n  page: number;\n  pageSize: number;\n  totalItems: number;\n  totalPages: number;\n}\n\nexport interface PublicContentListSnapshotContract {\n  kind: "news" | "announcements" | "blog";\n  items: PublicContentSummaryContract[];\n  pageItems?: PublicContentSummaryContract[];\n  pagination?: PublicContentPaginationContract;`
);
replace(
  "cloudflare/public-api/src/contracts/publicContent.ts",
  `export interface PublicContentDetailSnapshotContract {\n  item: PublicContentItemContract;\n  generatedAt: string;\n}`,
  `export interface PublicContentDetailSnapshotContract {\n  item: PublicContentItemContract;\n  media: PublicMediaAssetContract[];\n  generatedAt: string;\n}`
);
replace(
  "cloudflare/public-api/src/db/contentRepository.ts",
  `const PUBLIC_CONTENT_READ_COLUMNS = [`,
  `export type PublicContentSummaryReadRow = Omit<PublicContentReadRow, "body_snapshot">;\n\nconst PUBLIC_CONTENT_READ_COLUMNS = [`
);
replace(
  "cloudflare/public-api/src/db/contentRepository.ts",
  `] as const satisfies readonly (keyof PublicContentReadRow)[];`,
  `] as const satisfies readonly (keyof PublicContentReadRow)[];\n\nconst PUBLIC_CONTENT_SUMMARY_READ_COLUMNS = PUBLIC_CONTENT_READ_COLUMNS.filter(\n  (column): column is Exclude<(typeof PUBLIC_CONTENT_READ_COLUMNS)[number], "body_snapshot"> => column !== "body_snapshot"\n);`
);
replace(
  "cloudflare/public-api/src/db/contentRepository.ts",
  `export async function listAllPublishedContentRows(env: Env): Promise<PublicContentReadRow[]> {`,
  `export async function listPublishedContentSummaryRows(env: Env, type: string): Promise<PublicContentSummaryReadRow[]> {\n  const db = requireD1Database(env);\n  const result = await db\n    .prepare(\`SELECT \${PUBLIC_CONTENT_SUMMARY_READ_COLUMNS.join(", ")} FROM contents WHERE \${PUBLIC_PUBLISHED_CONTENT_FILTER_SQL} AND type = ? AND COALESCE(deleted_at, '') = '' ORDER BY publish_at DESC, updated_at DESC\`)\n    .bind(...publicPublishedContentBindings(type))\n    .all<PublicContentSummaryReadRow>();\n  return result.results ?? [];\n}\n\nexport async function listAllPublishedContentSummaryRows(env: Env): Promise<PublicContentSummaryReadRow[]> {\n  const db = requireD1Database(env);\n  const result = await db\n    .prepare(\`SELECT \${PUBLIC_CONTENT_SUMMARY_READ_COLUMNS.join(", ")} FROM contents WHERE \${PUBLIC_PUBLISHED_CONTENT_FILTER_SQL} AND COALESCE(deleted_at, '') = '' ORDER BY publish_at DESC, updated_at DESC\`)\n    .bind(...publicPublishedContentBindings())\n    .all<PublicContentSummaryReadRow>();\n  return result.results ?? [];\n}\n\nexport async function listAllPublishedContentRows(env: Env): Promise<PublicContentReadRow[]> {`
);
replace(
  "cloudflare/public-api/src/db/contentRepository.ts",
  `export async function searchPublishedContentRows(env: Env, query: string): Promise<PublicContentReadRow[]> {`,
  `export async function searchPublishedContentRows(env: Env, query: string): Promise<PublicContentSummaryReadRow[]> {`
);
replace(
  "cloudflare/public-api/src/db/contentRepository.ts",
  `    return listAllPublishedContentRows(env);`,
  `    return listAllPublishedContentSummaryRows(env);`
);
replace(
  "cloudflare/public-api/src/db/contentRepository.ts",
  `      \`SELECT \${PUBLIC_CONTENT_READ_COLUMNS.join(", ")}\n       FROM contents`,
  `      \`SELECT \${PUBLIC_CONTENT_SUMMARY_READ_COLUMNS.join(", ")}\n       FROM contents`
);
replace(
  "cloudflare/public-api/src/db/contentRepository.ts",
  `           OR category LIKE ?\n         )\n       ORDER BY publish_at DESC, updated_at DESC\n       LIMIT 20\``,
  `           OR category LIKE ?\n           OR tags_json LIKE ?\n         )\n       ORDER BY publish_at DESC, updated_at DESC\``
);
replace(
  "cloudflare/public-api/src/db/contentRepository.ts",
  `.bind(...publicPublishedContentBindings(pattern, pattern, pattern, pattern))\n    .all<PublicContentReadRow>();`,
  `.bind(...publicPublishedContentBindings(pattern, pattern, pattern, pattern, pattern))\n    .all<PublicContentSummaryReadRow>();`
);

replace(
  "cloudflare/public-api/src/adapters/publicContentAdapter.ts",
  `import type { PublicContentReadRow } from "../db/contentRepository";`,
  `import type { PublicContentReadRow, PublicContentSummaryReadRow } from "../db/contentRepository";`
);
replace(
  "cloudflare/public-api/src/adapters/publicContentAdapter.ts",
  `export function createPublicContentListSnapshot(`,
  `export function mapContentSummaryRowToPublicContentItem(row: PublicContentSummaryReadRow) {\n  const { body_snapshot: _bodySnapshot, ...summaryRow } = row as PublicContentReadRow;\n  return mapContentRowToPublicContentItem({ ...summaryRow, body_snapshot: "" });\n}\n\nexport function createPublicContentListSnapshot(`
);
replace(
  "cloudflare/public-api/src/adapters/publicContentAdapter.ts",
  `  rows: PublicContentReadRow[],\n  pageRows: PublicContentReadRow[],\n  metadata: PublicMetadataContract,\n  generatedAt = new Date()\n): PublicContentListSnapshotContract {\n  const items = rows.map(mapContentRowToPublicContentItem);\n  const pageItems = pageRows.map(mapContentRowToPublicContentItem);`,
  `  rows: PublicContentSummaryReadRow[],\n  pageRows: PublicContentSummaryReadRow[],\n  metadata: PublicMetadataContract,\n  generatedAt = new Date(),\n  pagination?: PublicContentListSnapshotContract["pagination"]\n): PublicContentListSnapshotContract {\n  const items = rows.map(mapContentSummaryRowToPublicContentItem);\n  const pageItems = pageRows.map(mapContentSummaryRowToPublicContentItem);`
);
replace(
  "cloudflare/public-api/src/adapters/publicContentAdapter.ts",
  `    ...(kind === "announcements" ? { pageItems } : {}),\n    media:`,
  `    ...(kind === "announcements" ? { pageItems } : {}),\n    ...(pagination ? { pagination } : {}),\n    media:`
);
replace(
  "cloudflare/public-api/src/adapters/publicContentAdapter.ts",
  `export function createPublicContentDetailSnapshot(\n  row: PublicContentReadRow,\n  generatedAt = new Date()\n): PublicContentDetailSnapshotContract {\n  return {\n    item: mapContentRowToPublicContentItem(row),\n    generatedAt: generatedAt.toISOString()\n  };\n}`,
  `export function createPublicContentDetailSnapshot(\n  row: PublicContentReadRow,\n  media: PublicMetadataContract["media"] = [],\n  generatedAt = new Date()\n): PublicContentDetailSnapshotContract {\n  const item = mapContentRowToPublicContentItem(row);\n  return {\n    item,\n    media: filterPublicMedia(media, [item]),\n    generatedAt: generatedAt.toISOString()\n  };\n}`
);

replace(
  "cloudflare/public-api/src/routes/publicContent.ts",
  `import { getPublishedContentRowBySlug, listPublishedContentRows } from "../db/contentRepository";`,
  `import { getPublishedContentRowBySlug, listPublishedContentSummaryRows } from "../db/contentRepository";`
);
replace(
  "cloudflare/public-api/src/routes/publicContent.ts",
  `      listPublishedContentRows(env, CONTENT_KIND_TO_TYPE[publicKind]),\n      publicKind === "announcements" ? listPublishedContentRows(env, "page") : Promise.resolve([]),`,
  `      listPublishedContentSummaryRows(env, CONTENT_KIND_TO_TYPE[publicKind]),\n      publicKind === "announcements" ? listPublishedContentSummaryRows(env, "page") : Promise.resolve([]),`
);
replace(
  "cloudflare/public-api/src/routes/publicContent.ts",
  `    return json(createPublicContentListSnapshot(publicKind, rows, pageRows, createPublicMetadata(metadataRows)));`,
  `    const url = new URL(request.url);\n    const requestedPage = Number(url.searchParams.get("page"));\n    const requestedPageSize = Number(url.searchParams.get("pageSize"));\n    const hasPagination = Number.isInteger(requestedPage) && requestedPage > 0;\n    const page = hasPagination ? requestedPage : 1;\n    const pageSize = Number.isInteger(requestedPageSize) ? Math.min(Math.max(requestedPageSize, 1), 100) : 20;\n    const start = (page - 1) * pageSize;\n    const selectedRows = hasPagination ? rows.slice(start, start + pageSize) : rows;\n    const pagination = hasPagination\n      ? { page, pageSize, totalItems: rows.length, totalPages: Math.max(1, Math.ceil(rows.length / pageSize)) }\n      : undefined;\n    return json(createPublicContentListSnapshot(publicKind, selectedRows, pageRows, createPublicMetadata(metadataRows), new Date(), pagination));`
);
replace(
  "cloudflare/public-api/src/routes/publicContent.ts",
  `import { readPublicMetadataRows } from "../db/publicMetadataRepository";`,
  `import { readPublicMetadataRows } from "../db/publicMetadataRepository";`
);
replace(
  "cloudflare/public-api/src/routes/publicContent.ts",
  `    const row = await getPublishedContentRowBySlug(env, slug);`,
  `    const [row, metadataRows] = await Promise.all([getPublishedContentRowBySlug(env, slug), readPublicMetadataRows(env)]);`
);
replace(
  "cloudflare/public-api/src/routes/publicContent.ts",
  `    return json(createPublicContentDetailSnapshot(row));`,
  `    return json(createPublicContentDetailSnapshot(row, createPublicMetadata(metadataRows).media));`
);

replace(
  "cloudflare/public-api/src/routes/publicHome.ts",
  `import { listAllPublishedContentRows } from "../db/contentRepository";`,
  `import { listAllPublishedContentSummaryRows } from "../db/contentRepository";`
);
replace("cloudflare/public-api/src/routes/publicHome.ts", `      listAllPublishedContentRows(env),`, `      listAllPublishedContentSummaryRows(env),`);
replace(
  "cloudflare/public-api/src/adapters/publicHomeAdapter.ts",
  `import type { PublicContentReadRow } from "../db/contentRepository";`,
  `import type { PublicContentSummaryReadRow } from "../db/contentRepository";`
);
replace(
  "cloudflare/public-api/src/adapters/publicHomeAdapter.ts",
  `import { mapContentRowToPublicContentItem } from "./publicContentAdapter";`,
  `import { mapContentSummaryRowToPublicContentItem } from "./publicContentAdapter";`
);
replace("cloudflare/public-api/src/adapters/publicHomeAdapter.ts", `    content: PublicContentReadRow[];`, `    content: PublicContentSummaryReadRow[];`);
replace("cloudflare/public-api/src/adapters/publicHomeAdapter.ts", `  const content = input.content.map(mapContentRowToPublicContentItem);`, `  const content = input.content.map(mapContentSummaryRowToPublicContentItem);`);

// Lightweight shell repository + endpoint.
replace(
  "cloudflare/public-api/src/db/publicMetadataRepository.ts",
  `export async function readPublicMetadataRows(env: Env): Promise<PublicMetadataRows> {`,
  `export async function readPublicShellMetadataRows(env: Env): Promise<Pick<PublicMetadataRows, "siteSettings" | "homepageSettings" | "displaySettings" | "menu">> {\n  const [siteSettings, homepageSettings, displaySettings, menu] = await Promise.all([\n    readSingleton<SiteSettingsRow>(env, "site_settings", SITE_SETTINGS_ROW_COLUMNS),\n    readSingleton<HomepageSettingsRow>(env, "homepage_settings", HOMEPAGE_SETTINGS_ROW_COLUMNS),\n    readSingleton<DisplaySettingsRow>(env, "display_settings", DISPLAY_SETTINGS_ROW_COLUMNS),\n    readRows<MenuItemRow>(env, \`SELECT \${MENU_ITEM_ROW_COLUMNS.join(", ")} FROM menu_items WHERE enabled = ? ORDER BY sort_order ASC\`, [1])\n  ]);\n  return { siteSettings, homepageSettings, displaySettings, menu };\n}\n\nexport async function readPublicMetadataRows(env: Env): Promise<PublicMetadataRows> {`
);
write("cloudflare/public-api/src/routes/publicShell.ts", `import { createPublicMetadata } from "../adapters/publicMetadataAdapter";
import { readPublicShellMetadataRows } from "../db/publicMetadataRepository";
import type { Env } from "../env";
import { json, jsonError } from "../responses";

export async function publicShell(env: Env) {
  if (!env.DB) return jsonError("database binding is not configured", 503, { resource: "public-shell" });
  try {
    const rows = await readPublicShellMetadataRows(env);
    const metadata = createPublicMetadata({ ...rows, media: [], carouselSlides: [], externalServices: [], events: [] });
    return json({
      siteSettings: metadata.siteSettings,
      homepageSettings: metadata.homepageSettings,
      displaySettings: metadata.displaySettings,
      menu: metadata.menu,
      generatedAt: new Date().toISOString()
    });
  } catch {
    return jsonError("Unable to load public-shell", 500, { resource: "public-shell" });
  }
}
`);
replace("cloudflare/public-api/src/router.ts", `import { publicSearch } from "./routes/publicSearch";`, `import { publicSearch } from "./routes/publicSearch";\nimport { publicShell } from "./routes/publicShell";`);
replace("cloudflare/public-api/src/router.ts", `  if (pathname === "/api/public/home") {\n    return publicHome(env);\n  }`, `  if (pathname === "/api/public/home") {\n    return publicHome(env);\n  }\n\n  if (pathname === "/api/public/shell") {\n    return publicShell(env);\n  }`);

replace(
  "src/types.ts",
  `export interface PublicHomeSnapshot {`,
  `export interface PublicShellSnapshot {\n  siteSettings: SiteSettings;\n  homepageSettings: HomepageSettings;\n  displaySettings?: DisplaySettings;\n  menu: PublicMenuItem[];\n  generatedAt: string;\n}\n\nexport interface PublicHomeSnapshot {`
);
replace(
  "src/features/public-read/cloudflareApi.ts",
  `  PublicHomeSnapshot,`,
  `  PublicHomeSnapshot,\n  PublicShellSnapshot,`
);
replace(
  "src/features/public-read/cloudflareApi.ts",
  `export async function getPublicHomeSnapshotFromCloudflare(`,
  `export async function getPublicShellSnapshotFromCloudflare(\n  options: PublicReadRequestOptions = {}\n): Promise<PublicShellSnapshot> {\n  const payload = await getCloudflareJson("/api/public/shell", "public-shell", options);\n  assertPublicSnapshot(payload, "public-shell", ["menu"]);\n  persistDisplaySettings(payload.displaySettings as DisplaySettings | undefined);\n  return payload as unknown as PublicShellSnapshot;\n}\n\nexport async function getPublicHomeSnapshotFromCloudflare(`
);
write("src/features/public-shell/index.ts", `import { getPublicShellSnapshotFromCloudflare, type PublicReadRequestOptions } from "../public-read/cloudflareApi";
export type { PublicShellSnapshot } from "../../types";
export function getPublicShellSnapshot(options: PublicReadRequestOptions = {}) {
  return getPublicShellSnapshotFromCloudflare(options);
}
`);
write("src/public/hooks/usePublicShellSnapshot.ts", `import { useQuery } from "@tanstack/react-query";
import { getPublicShellSnapshot } from "../../features/public-shell";

export function usePublicShellSnapshot(enabled = true) {
  return useQuery({
    queryKey: ["public-shell"] as const,
    queryFn: ({ signal }) => getPublicShellSnapshot({ signal }),
    enabled,
    staleTime: 15 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true
  });
}
`);

// Search now delegates the query to Worker instead of downloading the whole index for normal searches.
replace("src/public/pages/PublicSearchPage.tsx", `  const results = useMemo(() => searchPublishedContent(data?.items ?? [], query), [data?.items, query]);`, `  const results = useMemo(() => searchPublishedContent(data?.items ?? [], query), [data?.items, query]);`);

// 5) Remove effect-registration from the critical route path: each public page owns its shell; route layout owns telemetry only.
write("src/public/components/PublicShellRouteLayout.tsx", `import { lazy, Suspense } from "react";
import { Outlet } from "@tanstack/react-router";
import { SilentTelemetryBoundary } from "../../shared/telemetry/SilentTelemetryBoundary";

declare global {
  interface Window {
    __RCAT_FUNCTIONAL_FAIL_PUBLIC_TELEMETRY_IMPORT__?: boolean;
    __RCAT_FUNCTIONAL_PUBLIC_TELEMETRY_FAILURE_TRIGGERED__?: boolean;
  }
}

function loadPublicTelemetry() {
  if (import.meta.env.DEV && typeof window !== "undefined" && window.__RCAT_FUNCTIONAL_FAIL_PUBLIC_TELEMETRY_IMPORT__) {
    window.__RCAT_FUNCTIONAL_PUBLIC_TELEMETRY_FAILURE_TRIGGERED__ = true;
    return Promise.reject(new Error("Synthetic optional telemetry module failure"));
  }
  return import("../../shared/telemetry/PublicTelemetry");
}

const PublicTelemetry = lazy(loadPublicTelemetry);

export default function PublicShellRouteLayout() {
  return (
    <>
      <Outlet />
      <SilentTelemetryBoundary>
        <Suspense fallback={null}>
          <PublicTelemetry />
        </Suspense>
      </SilentTelemetryBoundary>
    </>
  );
}
`);
replace("src/public/components/PublicSiteShell.tsx", `import { usePublicCmsSnapshot } from "../hooks/usePublicCmsSnapshot";`, `import { usePublicShellSnapshot } from "../hooks/usePublicShellSnapshot";`);
replace("src/public/components/PublicSiteShell.tsx", `  const { data, isLoading, isFetching, isError, refetch } = usePublicCmsSnapshot({\n    enabled: shouldFetchShellData\n  });`, `  const { data, isLoading, isFetching, isError, refetch } = usePublicShellSnapshot(shouldFetchShellData);`);
replace("src/public/components/PublicSiteShell.tsx", `  const routeDefaults = routeLayout ? getPublicRouteShellDefaults(pathname || "/") : {};`, `  const routeDefaults = getPublicRouteShellDefaults(pathname || "/");`);

// Wrap page-level initial errors now that the route layout no longer supplies a second shell.
for (const entry of fs.readdirSync(path.join(root, "src/public/pages"))) {
  if (!entry.endsWith("Page.tsx")) continue;
  const file = `src/public/pages/${entry}`;
  let source = read(file);
  if (!source.includes("PublicErrorState") || !source.includes("PublicSiteShell")) continue;
  source = source.replace(
    /return \(\n\s*<PublicErrorState\n([\s\S]*?)\n\s*\/>\n\s*\);/g,
    (_match, body) => `return (\n      <PublicSiteShell>\n        <PublicErrorState\n${body}\n        />\n      </PublicSiteShell>\n    );`
  );
  write(file, source);
}

// 6) Deterministic first render: semantic images/content exist in server-compatible HTML; browser-only gate activates after mount.
replaceRegex(
  "src/public/pages/PublicHomePage.tsx",
  /function shouldDeferHomeSection\(\) \{[\s\S]*?\n\}\n\nfunction DeferredHomeSection\([\s\S]*?\n\}\n\nfunction LiveVisitorStatsCard/,
  `function DeferredHomeSection({\n  children,\n  minHeight = 180\n}: {\n  children: ReactNode;\n  minHeight?: number | { xs?: number; sm?: number; md?: number; lg?: number };\n}) {\n  return (\n    <Box sx={{ minHeight, contentVisibility: "auto", containIntrinsicSize: typeof minHeight === "number" ? \`auto \${minHeight}px\` : undefined }}>\n      <Suspense fallback={<Box sx={{ minHeight }} />}>{children}</Suspense>\n    </Box>\n  );\n}\n\nfunction LiveVisitorStatsCard`
);
replace("src/public/pages/PublicHomePage.tsx", `import { lazy, ReactNode, Suspense, useEffect, useRef, useState } from "react";`, `import { lazy, ReactNode, Suspense } from "react";`);

write("src/public/components/publicIntroGateState.ts", `import type { HomepageIntroGateSettings } from "../../types";

const DEFAULT_INTRO_GATE_STORAGE_KEY = "public-intro-gate";

export function shouldShowPublicIntroGate(settings?: HomepageIntroGateSettings) {
  return Boolean(settings?.enabled && settings.imageUrl.trim());
}

export function getPublicIntroGateStorageKey(settings?: HomepageIntroGateSettings) {
  return settings?.storageKey.trim() || DEFAULT_INTRO_GATE_STORAGE_KEY;
}

export function getInitialPublicIntroGateVisibility() {
  return false;
}

export function readBrowserPublicIntroGateVisibility(settings?: HomepageIntroGateSettings) {
  if (!settings || !shouldShowPublicIntroGate(settings) || typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(getPublicIntroGateStorageKey(settings)) !== "dismissed";
  } catch {
    return true;
  }
}
`);
replace("src/public/components/PublicSiteShell.tsx", `import { getInitialPublicIntroGateVisibility, getPublicIntroGateStorageKey } from "./publicIntroGateState";`, `import { getInitialPublicIntroGateVisibility, getPublicIntroGateStorageKey, readBrowserPublicIntroGateVisibility } from "./publicIntroGateState";`);
replace("src/public/components/PublicSiteShell.tsx", `  const [dismissedIntroGateKeys, setDismissedIntroGateKeys] = useState<ReadonlySet<string>>(() => new Set());`, `  const [dismissedIntroGateKeys, setDismissedIntroGateKeys] = useState<ReadonlySet<string>>(() => new Set());\n  const [browserIntroGateVisible, setBrowserIntroGateVisible] = useState(false);`);
replace("src/public/components/PublicSiteShell.tsx", `  const introGateVisible =\n    getInitialPublicIntroGateVisibility(homepageSettings.introGate) && !dismissedIntroGateKeys.has(introGateStorageKey);`, `  const introGateVisible =\n    (getInitialPublicIntroGateVisibility() || browserIntroGateVisible) && !dismissedIntroGateKeys.has(introGateStorageKey);\n\n  useEffect(() => {\n    setBrowserIntroGateVisible(readBrowserPublicIntroGateVisibility(homepageSettings.introGate));\n  }, [homepageSettings.introGate]);`);
replace("src/public/components/PublicSiteShell.tsx", `import {\n  Box,`, `import { useEffect } from "react";\nimport {\n  Box,`);

// Native lazy loading keeps <img> in semantic HTML and removes IntersectionObserver from image existence.
replace("src/shared/media/PublicResponsiveImage.tsx", `import { useNearViewportActivation } from "./useNearViewportActivation";\n`, ``);
replace("src/shared/media/PublicResponsiveImage.tsx", `  const isNearViewportMode = loadMode === "near-viewport";\n  const { activated, rootRef } = useNearViewportActivation(allowed && isNearViewportMode, nearViewportMargin);\n  const shouldLoad = allowed && (!isNearViewportMode || activated);`, `  const isNearViewportMode = loadMode === "near-viewport";\n  const shouldLoad = allowed;`);
replace("src/shared/media/PublicResponsiveImage.tsx", `      ref={rootRef}\n`, ``);
replace("src/shared/media/PublicResponsiveImage.tsx", `  nearViewportMargin = "320px 0px",`, `  nearViewportMargin: _nearViewportMargin = "320px 0px",`);

// 7) Pure SEO model + canonical policy; current client metadata remains compatible until route head() migration.
write("src/utils/seoModel.ts", `import type { ContentItem } from "../types";
import { projectSettings } from "../config/projectSettings";

export interface SeoModel {
  title: string;
  description: string;
  canonicalPath: string;
  robots: string;
  openGraph: {
    type: "website" | "article";
    locale: "th_TH";
    title: string;
    description: string;
    url: string;
  };
  twitter: {
    card: "summary" | "summary_large_image";
    title: string;
    description: string;
  };
  jsonLd: Record<string, unknown>[];
}

export function getDefaultContentCanonicalPath(slug: string) {
  const normalized = slug.trim().replace(/^\\/+|\\/+$/g, "");
  return normalized ? `/content/${encodeURIComponent(normalized)}` : "/";
}

export function buildPublicSeoModel(input: {
  title: string;
  description?: string;
  canonicalPath: string;
  type?: "website" | "article";
  robots?: string;
  jsonLd?: Record<string, unknown>[];
}): SeoModel {
  const title = input.title.trim() || projectSettings.site.name;
  const description = input.description?.trim() || "";
  const canonicalPath = input.canonicalPath.startsWith("/") ? input.canonicalPath : `/${input.canonicalPath}`;
  const url = new URL(canonicalPath, projectSettings.site.publicSiteUrl).toString();
  return {
    title,
    description,
    canonicalPath,
    robots: input.robots || "index,follow",
    openGraph: { type: input.type || "website", locale: "th_TH", title, description, url },
    twitter: { card: "summary_large_image", title, description },
    jsonLd: input.jsonLd ?? []
  };
}

export function buildContentSeoModel(item: Pick<ContentItem, "title" | "summary" | "seoTitle" | "seoDescription" | "canonicalUrl" | "slug">) {
  let canonicalPath = getDefaultContentCanonicalPath(item.slug);
  if (item.canonicalUrl?.trim()) {
    try {
      const url = new URL(item.canonicalUrl, projectSettings.site.publicSiteUrl);
      if (url.origin === new URL(projectSettings.site.publicSiteUrl).origin) canonicalPath = url.pathname || "/";
    } catch {
      // Keep the safe default namespace.
    }
  }
  return buildPublicSeoModel({
    title: item.seoTitle || item.title,
    description: item.seoDescription || item.summary,
    canonicalPath,
    type: "article"
  });
}
`);

replace("api/sitemap.mjs", `const STATIC_ROUTES = ["/", "/news", "/announcements", "/departments", "/blog", "/contact"];`, `const STATIC_ROUTES = ["/", "/news", "/announcements", "/achievements", "/departments", "/blog", "/documents", "/calendar", "/contact"];`);
replace("api/sitemap.mjs", `      routes.add(\`/content/\${encodedSlug}\`);\n      routes.add(\`/\${encodedSlug}\`);`, `      routes.add(\`/content/\${encodedSlug}\`);`);
replace("src/test/sitemap.test.mjs", `    expect(urls).toContain("https://school.example/content/published-news");\n    expect(urls).toContain("https://school.example/published-news");`, `    expect(urls).toContain("https://school.example/content/published-news");\n    expect(urls).not.toContain("https://school.example/published-news");\n    expect(urls).toContain("https://school.example/achievements");\n    expect(urls).toContain("https://school.example/documents");\n    expect(urls).toContain("https://school.example/calendar");`);

write("src/test/ssrReadiness.test.ts", `import { describe, expect, it } from "vitest";
import { createAppQueryClient } from "../app/createAppQueryClient";
import { createAppRouter } from "../routes";
import { buildContentSeoModel, getDefaultContentCanonicalPath } from "../utils/seoModel";
import { getInitialPublicIntroGateVisibility } from "../public/components/publicIntroGateState";

 describe("SSR readiness foundation", () => {
  it("creates isolated router and query client instances", () => {
    expect(createAppQueryClient()).not.toBe(createAppQueryClient());
    expect(createAppRouter()).not.toBe(createAppRouter());
  });

  it("keeps the initial intro-gate render deterministic", () => {
    expect(getInitialPublicIntroGateVisibility()).toBe(false);
  });

  it("uses the collision-safe /content namespace as the default content canonical", () => {
    expect(getDefaultContentCanonicalPath("hello-world")).toBe("/content/hello-world");
    const seo = buildContentSeoModel({
      title: "ข่าวทดสอบ",
      summary: "รายละเอียด",
      slug: "hello-world"
    });
    expect(seo.canonicalPath).toBe("/content/hello-world");
    expect(seo.openGraph.url).toBe("https://www.rcat.ac.th/content/hello-world");
    expect(seo.robots).toBe("index,follow");
  });

  it("honors a safe explicit same-site canonical path", () => {
    const seo = buildContentSeoModel({
      title: "รับสมัคร",
      summary: "รายละเอียด",
      slug: "admission",
      canonicalUrl: "/admission"
    });
    expect(seo.canonicalPath).toBe("/admission");
  });
});
`);

// Keep documentation synchronized with the new pre-SSR boundary.
write("docs/architecture/ssr-readiness-foundation.md", `# SSR Readiness Foundation\n\nUpdated: 2026-08-02\n\nThis document describes the completed pre-SSR refactor. It does **not** claim that production SSR is enabled yet.\n\n## Completed foundation\n\n1. Router and QueryClient factories are available so future server requests can use isolated instances.\n2. Public React Query definitions are reusable and forward AbortSignal to Cloudflare reads. Public read errors expose HTTP status classification.\n3. Public pagination/tag/category state is TanStack Router-owned rather than read directly from window.location.\n4. Public API payloads are prepared for SSR: content list/home/search use summary rows without body snapshots, content lists accept optional server pagination, normal search sends q to the Worker, content detail includes referenced media, and /api/public/shell is a lightweight shell endpoint.\n5. Public pages own PublicSiteShell directly; the public route layout is telemetry-only, so critical rendering no longer depends on child-to-parent useLayoutEffect registration.\n6. First-render semantics are deterministic: the intro gate is browser-activated after mount, semantic images use native lazy loading instead of being absent before IntersectionObserver activation, and Home semantic sections are not removed from the initial tree.\n7. SEO has a pure model ready for TanStack route head() integration. Default CMS content canonical URLs use /content/{slug}; explicit same-site canonicals such as /admission remain supported. Runtime sitemap emits one canonical default content URL and includes all primary public routes.\n\n## Still intentionally not enabled\n\n- server/client Vite entries\n- React hydrateRoot\n- TanStack route loaders for SSR\n- Query dehydration/hydration\n- MUI/Emotion critical CSS extraction\n- route head() output\n- HTTP 301/404/503 rendering semantics\n- Vercel catch-all replacement\n\nThose belong to the next SSR implementation phase after this foundation remains stable in CSR production.\n`);

const readme = read("README.md");
if (!readme.includes("SSR readiness foundation")) {
  write("README.md", `${readme.trim()}\n\n## SSR readiness foundation\n\nThe public frontend remains CSR in production, but the seven pre-SSR architecture blockers have been refactored. See [docs/architecture/ssr-readiness-foundation.md](docs/architecture/ssr-readiness-foundation.md). Do not change Vercel public routing or claim SSR is enabled until the server-rendering phase is deployed and verified.\n`);
}

const pkg = JSON.parse(read("package.json"));
pkg.scripts["test:ssr-readiness"] = "vitest run src/test/ssrReadiness.test.ts src/test/sitemap.test.mjs";
write("package.json", `${JSON.stringify(pkg, null, 2)}\n`);

console.log("SSR readiness steps 1-7 applied.");
