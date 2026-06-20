import { createPublicHomeSnapshot } from "../adapters/publicHomeAdapter";
import { createPublicMetadata } from "../adapters/publicMetadataAdapter";
import { createPublicVisitorStatsSnapshot } from "../adapters/publicVisitorStatsAdapter";
import { listAllPublishedContentRows } from "../db/contentRepository";
import { listPublishedDocumentRows } from "../db/documentsRepository";
import { listPublishedHomeSectionRows } from "../db/homeRepository";
import { readPublicMetadataRows } from "../db/publicMetadataRepository";
import { listVisitorDailyStatsRows } from "../db/visitorStatsRepository";
import type { Env } from "../env";
import { json, jsonError } from "../responses";

const RESOURCE = "public-home";
const PHASE = "M17-B";

export async function publicHome(env: Env) {
  if (!env.DB) {
    return jsonError("database binding is not configured", 503, {
      resource: RESOURCE,
      phase: PHASE
    });
  }

  try {
    const [sections, content, featuredDocuments, metadataRows, visitorRows] = await Promise.all([
      listPublishedHomeSectionRows(env),
      listAllPublishedContentRows(env),
      listPublishedDocumentRows(env),
      readPublicMetadataRows(env),
      listVisitorDailyStatsRows(env)
    ]);
    const generatedAt = new Date();

    return json(
      createPublicHomeSnapshot(
        {
          sections,
          content,
          featuredDocuments,
          metadata: createPublicMetadata(metadataRows),
          visitorStats: createPublicVisitorStatsSnapshot(visitorRows, generatedAt)
        },
        generatedAt
      )
    );
  } catch {
    return jsonError("Unable to load public-home", 500, {
      resource: RESOURCE,
      phase: PHASE
    });
  }
}
