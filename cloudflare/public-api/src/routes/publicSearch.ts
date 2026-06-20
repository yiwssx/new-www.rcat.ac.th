import { createPublicSearchSnapshot } from "../adapters/publicSearchAdapter";
import { createPublicMetadata } from "../adapters/publicMetadataAdapter";
import { searchPublishedContentRows } from "../db/contentRepository";
import { readPublicMetadataRows } from "../db/publicMetadataRepository";
import type { Env } from "../env";
import { json, jsonError } from "../responses";

const RESOURCE = "search";
const PHASE = "M17-B";

export async function publicSearch(request: Request, env: Env) {
  if (!env.DB) {
    return jsonError("database binding is not configured", 503, {
      resource: RESOURCE,
      phase: PHASE
    });
  }

  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";

  try {
    const [rows, metadataRows] = await Promise.all([
      searchPublishedContentRows(env, query),
      readPublicMetadataRows(env)
    ]);
    return json(createPublicSearchSnapshot(query, rows, createPublicMetadata(metadataRows)));
  } catch {
    return jsonError("Unable to load search", 500, {
      resource: RESOURCE,
      phase: PHASE
    });
  }
}
