import { createPublicHomeSnapshot } from "../adapters/publicHomeAdapter";
import { createPublicMetadata } from "../adapters/publicMetadataAdapter";
import { createPublicVisitorStatsSnapshot } from "../adapters/publicVisitorStatsAdapter";
import { listAllPublishedContentSummaryRows } from "../db/contentRepository";
import { listPublishedDocumentRows } from "../db/documentsRepository";
import { listPublishedHomeSectionRows } from "../db/homeRepository";
import { readPublicMetadataRows } from "../db/publicMetadataRepository";
import { countOnlineVisitors, listVisitorDailyStatsRows } from "../db/visitorStatsRepository";
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
    const generatedAt = new Date();
    const [sections, content, featuredDocuments, metadataRows, visitorRows, onlineUsers] = await Promise.all([
      listPublishedHomeSectionRows(env),
      listAllPublishedContentSummaryRows(env),
      listPublishedDocumentRows(env),
      readPublicMetadataRows(env),
      listVisitorDailyStatsRows(env),
      countOnlineVisitors(env, generatedAt)
    ]);

    return json(
      createPublicHomeSnapshot(
        {
          sections,
          content,
          featuredDocuments,
          metadata: createPublicMetadata(metadataRows),
          visitorStats: createPublicVisitorStatsSnapshot(visitorRows, generatedAt, onlineUsers)
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
