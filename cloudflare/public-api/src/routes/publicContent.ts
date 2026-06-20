import { createPublicContentDetailSnapshot, createPublicContentListSnapshot } from "../adapters/publicContentAdapter";
import { createPublicMetadata } from "../adapters/publicMetadataAdapter";
import { getPublishedContentRowBySlug, listPublishedContentRows } from "../db/contentRepository";
import { readPublicMetadataRows } from "../db/publicMetadataRepository";
import type { Env } from "../env";
import { json, jsonError } from "../responses";

const CONTENT_LIST_RESOURCE = "content-list";
const CONTENT_DETAIL_RESOURCE = "content-detail";
const PHASE = "M17-B";

const CONTENT_KIND_TO_TYPE = {
  news: "news",
  announcements: "announcement",
  blog: "blog"
} as const;

export async function publicContentList(request: Request, env: Env) {
  if (!env.DB) {
    return jsonError("database binding is not configured", 503, {
      resource: CONTENT_LIST_RESOURCE,
      phase: PHASE
    });
  }

  const kind = new URL(request.url).searchParams.get("kind")?.trim().toLowerCase() || "news";

  if (!(kind in CONTENT_KIND_TO_TYPE)) {
    return jsonError("invalid public content list kind", 400, {
      resource: CONTENT_LIST_RESOURCE
    });
  }

  const publicKind = kind as keyof typeof CONTENT_KIND_TO_TYPE;

  try {
    const [rows, pageRows, metadataRows] = await Promise.all([
      listPublishedContentRows(env, CONTENT_KIND_TO_TYPE[publicKind]),
      publicKind === "announcements" ? listPublishedContentRows(env, "page") : Promise.resolve([]),
      readPublicMetadataRows(env)
    ]);
    return json(createPublicContentListSnapshot(publicKind, rows, pageRows, createPublicMetadata(metadataRows)));
  } catch {
    return jsonError("Unable to load content-list", 500, {
      resource: CONTENT_LIST_RESOURCE,
      phase: PHASE
    });
  }
}

export async function publicContentDetail(env: Env, slug: string) {
  if (!env.DB) {
    return jsonError("database binding is not configured", 503, {
      resource: CONTENT_DETAIL_RESOURCE,
      phase: PHASE
    });
  }

  try {
    const row = await getPublishedContentRowBySlug(env, slug);

    if (!row) {
      return jsonError("not found", 404, {
        resource: CONTENT_DETAIL_RESOURCE
      });
    }

    return json(createPublicContentDetailSnapshot(row));
  } catch {
    return jsonError("Unable to load content-detail", 500, {
      resource: CONTENT_DETAIL_RESOURCE,
      phase: PHASE
    });
  }
}
