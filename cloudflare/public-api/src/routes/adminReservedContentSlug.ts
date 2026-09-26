import { authenticateAdminRequest } from "../auth/adminAccess";
import { requireAdminCapability, type AdminCapability } from "../auth/adminCapabilities";
import { requireD1Database } from "../db/documentsRepository";
import type { Env } from "../env";
import { isReservedPublicContentSlug } from "../publicRoutePolicy";
import { jsonError } from "../responses";

const ADMIN_CONTENT_PREFIX = "/api/admin/content";

type JsonRecord = Record<string, unknown>;

interface ReservedSlugCandidate {
  slug: string;
  capability: AdminCapability;
}

function noStore(response: Response) {
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function decodeSegment(value: string | undefined) {
  try {
    return decodeURIComponent(value || "");
  } catch {
    return "";
  }
}

async function readBody(request: Request) {
  return request
    .clone()
    .json()
    .then((value) => (isRecord(value) ? value : null))
    .catch(() => null);
}

async function readCurrentSlug(env: Env, contentId: string) {
  const row = await requireD1Database(env)
    .prepare("SELECT slug FROM contents WHERE id = ? LIMIT 1")
    .bind(contentId)
    .first<{ slug: string }>();
  return String(row?.slug || "").trim();
}

async function readRevisionSlug(env: Env, contentId: string, revision: number) {
  const row = await requireD1Database(env)
    .prepare("SELECT snapshot_json FROM content_revisions WHERE content_id = ? AND revision = ? LIMIT 1")
    .bind(contentId, revision)
    .first<{ snapshot_json: string }>();

  if (!row?.snapshot_json) return "";
  try {
    const snapshot: unknown = JSON.parse(row.snapshot_json);
    return isRecord(snapshot) && typeof snapshot.slug === "string" ? snapshot.slug.trim() : "";
  } catch {
    return "";
  }
}

async function readDeletedOriginalSlug(env: Env, contentId: string) {
  const row = await requireD1Database(env)
    .prepare(
      `SELECT snapshot_json
       FROM content_revisions
       WHERE content_id = ? AND reason = 'delete'
       ORDER BY revision DESC, created_at DESC
       LIMIT 1`
    )
    .bind(contentId)
    .first<{ snapshot_json: string }>();

  if (!row?.snapshot_json) return "";
  try {
    const snapshot: unknown = JSON.parse(row.snapshot_json);
    return isRecord(snapshot) && typeof snapshot.slug === "string" ? snapshot.slug.trim() : "";
  } catch {
    return "";
  }
}

async function resolveCandidate(request: Request, env: Env): Promise<ReservedSlugCandidate | null> {
  const { pathname } = new URL(request.url);
  if (!pathname.startsWith(ADMIN_CONTENT_PREFIX)) return null;

  const segments = pathname.slice("/api/admin/".length).split("/");
  if (segments[0] !== "content") return null;

  if (segments.length === 1 && request.method === "POST") {
    const body = await readBody(request);
    const slug = typeof body?.slug === "string" ? body.slug.trim() : "";
    return slug ? { slug, capability: "content.create" } : null;
  }

  const contentId = decodeSegment(segments[1]);
  if (!contentId) return null;

  if (segments.length === 2 && request.method === "PATCH") {
    const body = await readBody(request);
    if (!body || !Object.prototype.hasOwnProperty.call(body, "slug")) return null;
    const slug = typeof body.slug === "string" ? body.slug.trim() : "";
    return slug ? { slug, capability: "content.update" } : null;
  }

  if (segments.length === 3 && request.method === "POST" && segments[2] === "restore") {
    return { slug: await readDeletedOriginalSlug(env, contentId), capability: "content.update" };
  }

  if (segments.length === 3 && request.method === "POST" && segments[2] === "publish") {
    return { slug: await readCurrentSlug(env, contentId), capability: "content.publish" };
  }

  if (segments.length === 3 && request.method === "PUT" && segments[2] === "workflow") {
    const body = await readBody(request);
    if (body?.status !== "review") return null;
    return { slug: await readCurrentSlug(env, contentId), capability: "content.update" };
  }

  if (segments.length === 5 && request.method === "POST" && segments[2] === "revisions" && segments[4] === "restore") {
    const revision = Number(segments[3]);
    if (!Number.isSafeInteger(revision) || revision < 0) return null;
    return { slug: await readRevisionSlug(env, contentId, revision), capability: "content.update" };
  }

  return null;
}

export async function enforceReservedContentSlug(request: Request, env: Env): Promise<Response | null> {
  if (!env.DB) return null;

  const candidate = await resolveCandidate(request, env);
  if (!candidate?.slug || !isReservedPublicContentSlug(candidate.slug)) return null;

  const auth = await authenticateAdminRequest(request, env, { touchSession: false });
  if (auth.response || !auth.identity) {
    return noStore(auth.response ?? jsonError("admin authentication failed", 403));
  }

  const denied = requireAdminCapability(auth.identity, candidate.capability, { resource: "content" });
  if (denied) return noStore(denied);

  return noStore(
    jsonError("content slug conflicts with a reserved public route", 409, {
      resource: "content",
      field: "slug",
      slug: candidate.slug,
      diagnostic: "reserved-public-route-slug"
    })
  );
}
