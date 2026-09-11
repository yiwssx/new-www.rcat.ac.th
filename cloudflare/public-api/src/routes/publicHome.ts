import { createPublicHomeSnapshot } from "../adapters/publicHomeAdapter";
import { createPublicMetadata } from "../adapters/publicMetadataAdapter";
import { createPublicVisitorStatsSnapshotFromAggregate } from "../adapters/publicVisitorStatsAdapter";
import { listHomePublishedDocumentRows } from "../db/documentsRepository";
import { listHomePublishedContentSummaryRows } from "../db/homeContentRepository";
import { readPublicHomeCoreMetadataRows, readPublicMediaRowsByIds } from "../db/publicMetadataRepository";
import { countOnlineVisitors, readVisitorStatsAggregate } from "../db/visitorStatsRepository";
import type { Env } from "../env";
import { json, jsonError } from "../responses";

const RESOURCE = "public-home";
const PHASE = "M17-B";
const EXTERNAL_SERVICE_MEDIA_ICON_PREFIX = "media:";
const HOME_DOCUMENT_LIMIT = 3;

function collectHomeMediaIds(snapshot: ReturnType<typeof createPublicHomeSnapshot>) {
  const ids = new Set<string>();
  const addMediaReferences = (items: Array<{ featuredMediaId?: string; mediaIds?: string[] }>) => {
    items.forEach((item) => {
      if (item.featuredMediaId) {
        ids.add(item.featuredMediaId);
      }
      item.mediaIds?.forEach((id) => ids.add(id));
    });
  };

  addMediaReferences([
    ...snapshot.latestNews,
    ...snapshot.latestAnnouncements,
    ...snapshot.programItems,
    ...snapshot.achievementItems,
    ...snapshot.eventItems
  ]);

  snapshot.externalServices.forEach((service) => {
    const iconKey = String(service.iconKey || "").trim();
    if (iconKey.startsWith(EXTERNAL_SERVICE_MEDIA_ICON_PREFIX)) {
      const id = iconKey.slice(EXTERNAL_SERVICE_MEDIA_ICON_PREFIX.length).trim();
      if (id) {
        ids.add(id);
      }
    }
  });

  return [...ids];
}

export async function publicHome(env: Env) {
  if (!env.DB) {
    return jsonError("database binding is not configured", 503, {
      resource: RESOURCE,
      phase: PHASE
    });
  }

  try {
    const generatedAt = new Date();
    const [content, featuredDocuments, homeCoreRows, visitorAggregate, onlineUsers] = await Promise.all([
      listHomePublishedContentSummaryRows(env),
      listHomePublishedDocumentRows(env, HOME_DOCUMENT_LIMIT),
      readPublicHomeCoreMetadataRows(env),
      readVisitorStatsAggregate(env, generatedAt),
      countOnlineVisitors(env, generatedAt)
    ]);
    const visitorStats = createPublicVisitorStatsSnapshotFromAggregate(visitorAggregate, generatedAt, onlineUsers);
    const metadataRows = {
      siteSettings: null,
      homepageSettings: null,
      displaySettings: null,
      menu: [],
      media: [],
      ...homeCoreRows
    };
    const metadataWithoutMedia = createPublicMetadata(metadataRows);
    const provisionalSnapshot = createPublicHomeSnapshot(
      {
        content,
        featuredDocuments,
        metadata: metadataWithoutMedia,
        visitorStats
      },
      generatedAt
    );
    const media = await readPublicMediaRowsByIds(env, collectHomeMediaIds(provisionalSnapshot));
    const metadata = createPublicMetadata({ ...metadataRows, media });

    return json(
      createPublicHomeSnapshot(
        {
          content,
          featuredDocuments,
          metadata,
          visitorStats
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
