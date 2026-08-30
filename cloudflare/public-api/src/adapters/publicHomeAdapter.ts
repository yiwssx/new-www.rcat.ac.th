import { mapContentCardRowToPublicContentCard } from "./publicContentAdapter";
import { mapDocumentRowToPublicDocumentItem } from "./publicDocumentsAdapter";
import { filterPublicMedia } from "./publicMetadataAdapter";
import type { PublicContentCardContract } from "../contracts/publicContent";
import type { PublicHomeSnapshotContract } from "../contracts/publicHome";
import type { PublicMetadataContract } from "../contracts/publicMetadata";
import type { PublicVisitorStatsSnapshotContract } from "../contracts/publicVisitorStats";
import type { PublicContentSummaryReadRow } from "../db/contentRepository";
import type { DocumentRow } from "../db/schema";

const HOME_ACHIEVEMENT_LIMIT = 6;
const ACHIEVEMENT_PATTERN = /achievement|award|รางวัล|ผลงาน|ความสำเร็จ|ความภาคภูมิใจ|ชนะเลิศ|รองชนะเลิศ|เหรียญ/i;
const EXTERNAL_SERVICE_MEDIA_ICON_PREFIX = "media:";

function compareContentPublishAtDesc(left: PublicContentCardContract, right: PublicContentCardContract) {
  const leftTime = Date.parse(left.publishAt);
  const rightTime = Date.parse(right.publishAt);

  if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) {
    return rightTime - leftTime;
  }

  return String(right.publishAt || "").localeCompare(String(left.publishAt || "")) || right.id.localeCompare(left.id);
}

function isAchievementItem(item: PublicContentCardContract) {
  return ACHIEVEMENT_PATTERN.test([item.title, item.summary, item.category, ...item.tags].join(" "));
}

function getExternalServiceIconMediaId(iconKey: unknown) {
  const normalized = String(iconKey || "").trim();
  return normalized.startsWith(EXTERNAL_SERVICE_MEDIA_ICON_PREFIX)
    ? normalized.slice(EXTERNAL_SERVICE_MEDIA_ICON_PREFIX.length).trim()
    : "";
}

export function createPublicHomeSnapshot(
  input: {
    content: PublicContentSummaryReadRow[];
    featuredDocuments: DocumentRow[];
    metadata: PublicMetadataContract;
    visitorStats: PublicVisitorStatsSnapshotContract;
  },
  generatedAt = new Date()
): PublicHomeSnapshotContract {
  const content = input.content.map(mapContentCardRowToPublicContentCard);
  const latestNews = content.filter((item) => item.type === "news" || item.type === "blog").slice(0, 6);
  const latestAnnouncements = content.filter((item) => item.type === "announcement").slice(0, 8);
  const programs = content.filter((item) => item.type === "program").slice(0, 8);
  const achievementItems = content
    .filter(isAchievementItem)
    .sort(compareContentPublishAtDesc)
    .slice(0, HOME_ACHIEVEMENT_LIMIT);
  const publicDocuments = input.featuredDocuments.map(mapDocumentRowToPublicDocumentItem);
  const homeContent = [...latestNews, ...latestAnnouncements, ...programs, ...achievementItems];
  const homeMediaReferences = [
    ...homeContent,
    ...input.metadata.events.map((event) => ({
      mediaIds: event.mediaIds ?? []
    })),
    ...input.metadata.externalServices.map((service) => {
      const iconMediaId = getExternalServiceIconMediaId(service.iconKey);
      return { mediaIds: iconMediaId ? [iconMediaId] : [] };
    })
  ];

  return {
    carouselSlides: input.metadata.carouselSlides,
    externalServices: input.metadata.externalServices,
    visitorStats: input.visitorStats,
    latestNews,
    latestAnnouncements,
    procurementItems: latestAnnouncements.filter((item) =>
      /procurement|tor|จัดซื้อ|จัดจ้าง|ประกวดราคา/i.test(
        [item.title, item.summary, item.category, ...item.tags].join(" ")
      )
    ),
    jobOpportunityItems: latestAnnouncements.filter((item) =>
      /job|career|recruit|สมัครงาน|รับสมัคร|งาน/i.test(
        [item.title, item.summary, item.category, ...item.tags].join(" ")
      )
    ),
    achievementItems,
    programItems: programs,
    documentItems: publicDocuments,
    eventItems: input.metadata.events,
    media: filterPublicMedia(input.metadata.media, homeMediaReferences),
    generatedAt: generatedAt.toISOString()
  };
}
