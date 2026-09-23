import { requireD1Database } from "./db/documentsRepository";
import type { Env } from "./env";

const PUBLIC_CONTENT_KINDS = {
  news: "news",
  blog: "blog",
  announcement: "announcements"
} as const;

type PublicContentType = keyof typeof PUBLIC_CONTENT_KINDS | "page" | "program" | string;

interface ContentCacheIdentity {
  id: string;
  slug: string;
  type: PublicContentType;
}

function getDefaultCache() {
  return typeof caches === "undefined" ? null : caches.default;
}

function cacheKey(origin: string, path: string) {
  return new Request(new URL(path, origin).toString(), {
    method: "GET",
    headers: { Accept: "application/json" }
  });
}

async function deleteCachePaths(origin: string, paths: Iterable<string>) {
  const cache = getDefaultCache();
  if (!cache) return;
  const unique = [...new Set(paths)];
  await Promise.all(
    unique.map((path) =>
      cache.delete(cacheKey(origin, path)).catch((error) => {
        console.warn("public read cache invalidation failed", { path, errorName: error instanceof Error ? error.name : "Error" });
        return false;
      })
    )
  );
}

function parseJsonRecord(value: string | undefined) {
  try {
    const parsed: unknown = JSON.parse(value || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

async function readResponseContentId(response: Response) {
  try {
    const payload = (await response.clone().json()) as Record<string, unknown>;
    if (payload.item && typeof payload.item === "object" && "id" in payload.item) {
      return String((payload.item as Record<string, unknown>).id || "");
    }
    return typeof payload.id === "string" ? payload.id : "";
  } catch {
    return "";
  }
}

async function readCurrentContentIdentity(env: Env, contentId: string): Promise<ContentCacheIdentity | null> {
  if (!env.DB || !contentId) return null;
  return requireD1Database(env)
    .prepare("SELECT id, slug, type FROM contents WHERE id = ? LIMIT 1")
    .bind(contentId)
    .first<ContentCacheIdentity>();
}

async function readPreviousContentIdentity(env: Env, contentId: string): Promise<ContentCacheIdentity | null> {
  if (!env.DB || !contentId) return null;
  const row = await requireD1Database(env)
    .prepare(
      `SELECT snapshot_json FROM content_revisions
       WHERE content_id = ? ORDER BY revision DESC, created_at DESC LIMIT 1`
    )
    .bind(contentId)
    .first<{ snapshot_json: string }>();
  const snapshot = parseJsonRecord(row?.snapshot_json);
  if (!snapshot) return null;
  const id = String(snapshot.id || contentId);
  const slug = String(snapshot.slug || "");
  const type = String(snapshot.type || "");
  return id && slug ? { id, slug, type } : null;
}

function addContentListPaths(paths: Set<string>, type: PublicContentType) {
  if (type === "page") {
    paths.add("/api/public/content?kind=announcements");
    paths.add("/api/public/content?kind=announcements&pagesPage=1&pagesPageSize=12");
    return;
  }

  const kind = PUBLIC_CONTENT_KINDS[type as keyof typeof PUBLIC_CONTENT_KINDS];
  if (!kind) return;
  paths.add(`/api/public/content?kind=${kind}`);
  paths.add(`/api/public/content?kind=${kind}&page=1&pageSize=12`);
  if (kind === "announcements") {
    paths.add("/api/public/content?kind=announcements&pagesPage=1&pagesPageSize=12");
  }
}

async function invalidateContentMutation(request: Request, env: Env, response: Response) {
  const url = new URL(request.url);
  const segments = url.pathname.slice("/api/admin/".length).split("/");
  const pathId = segments[0] === "content" && segments[1] ? decodeURIComponent(segments[1]) : "";
  const contentId = pathId || (await readResponseContentId(response));
  const [current, previous] = await Promise.all([
    readCurrentContentIdentity(env, contentId),
    readPreviousContentIdentity(env, contentId)
  ]);
  const paths = new Set<string>(["/api/public/home", "/api/public/search", "/api/public/content"]);

  for (const identity of [current, previous]) {
    if (!identity) continue;
    if (identity.slug && !identity.slug.startsWith("__deleted__:")) {
      paths.add(`/api/public/content/${encodeURIComponent(identity.slug)}`);
    }
    addContentListPaths(paths, identity.type);
    if (identity.type === "program") paths.add("/api/public/programs");
  }

  await deleteCachePaths(url.origin, paths);
}

export async function invalidatePublicReadCacheAfterAdminMutation(
  request: Request,
  env: Env,
  response: Response
) {
  if (!response.ok || request.method === "GET" || request.method === "OPTIONS") return;
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/admin/")) return;

  if (url.pathname === "/api/admin/content" || url.pathname.startsWith("/api/admin/content/")) {
    await invalidateContentMutation(request, env, response);
    return;
  }

  const paths = new Set<string>();
  if (url.pathname.startsWith("/api/admin/documents")) {
    paths.add("/api/public/documents");
    paths.add("/api/public/home");
  }
  if (url.pathname.startsWith("/api/admin/events")) {
    paths.add("/api/public/events");
    paths.add("/api/public/home");
  }
  if (
    url.pathname.startsWith("/api/admin/settings/") ||
    url.pathname.startsWith("/api/admin/menu") ||
    url.pathname.startsWith("/api/admin/carousel") ||
    url.pathname.startsWith("/api/admin/external-services")
  ) {
    paths.add("/api/public/home");
    paths.add("/api/public/shell");
  }

  if (paths.size) await deleteCachePaths(url.origin, paths);
}
