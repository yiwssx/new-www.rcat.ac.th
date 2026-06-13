import { createPublicContentDetailSnapshot, createPublicContentListSnapshot } from "../adapters/publicContentAdapter";
import { getPublishedContentRowBySlug, listPublishedContentRows } from "../db/contentRepository";
import type { Env } from "../env";
import { json, jsonError } from "../responses";

const CONTENT_LIST_RESOURCE = "content-list";
const CONTENT_DETAIL_RESOURCE = "content-detail";
const PHASE = "M17-B";

export async function publicContentList(env: Env) {
  if (!env.DB) {
    return jsonError("database binding is not configured", 503, {
      resource: CONTENT_LIST_RESOURCE,
      phase: PHASE
    });
  }

  try {
    const rows = await listPublishedContentRows(env);
    return json(createPublicContentListSnapshot(rows));
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
