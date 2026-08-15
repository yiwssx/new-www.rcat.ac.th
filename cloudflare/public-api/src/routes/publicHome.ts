import { createPublicHomeSnapshot } from "../adapters/publicHomeAdapter";
import { createPublicMetadata } from "../adapters/publicMetadataAdapter";
import { createPublicVisitorStatsSnapshot } from "../adapters/publicVisitorStatsAdapter";
import { listAllPublishedContentCardRows } from "../db/contentRepository";
import { listPublishedDocumentRows } from "../db/documentsRepository";
import { readPublicHomeMetadataRows } from "../db/publicMetadataRepository";
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
    const [content, featuredDocuments, homeMetadataRows, visitorRows, onlineUsers] = await Promise.all([
      listAllPublishedContentCardRows(env),
      listPublishedDocumentRows(env),
      readPublicHomeMetadataRows(env),
      listVisitorDailyStatsRows(env),
      countOnlineVisitors(env, generatedAt)
    ]);
    const metadata = createPublicMetadata({
      siteSettings: null,
      homepageSettings: null,
      displaySettings: null,
      menu: [],
      ...homeMetadataRows
    });

    return json(
      createPublicHomeSnapshot(
        {
          content,
          featuredDocuments,
          metadata,
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
