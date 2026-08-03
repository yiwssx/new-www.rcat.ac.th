import { mapContentSummaryRowToPublicContentItem } from "./publicContentAdapter";
import { mapDocumentRowToPublicDocumentItem } from "./publicDocumentsAdapter";
import { filterPublicMedia } from "./publicMetadataAdapter";
import type { PublicContentSummaryContract } from "../contracts/publicContent";
import type { PublicHomeSectionContract, PublicHomeSnapshotContract } from "../contracts/publicHome";
import type { PublicMetadataContract } from "../contracts/publicMetadata";
import type { PublicVisitorStatsSnapshotContract } from "../contracts/publicVisitorStats";
import type { PublicContentSummaryReadRow } from "../db/contentRepository";
import type { DocumentRow, PublicHomeSectionRow } from "../db/schema";

const HOME_ACHIEVEMENT_LIMIT = 6;
const ACHIEVEMENT_PATTERN = /achievement|award|รางวัล|ผลงาน|ความสำเร็จ|ความภาคภูมิใจ|ชนะเลิศ|รองชนะเลิศ|เหรียญ/i;

function normalizePublicOrder(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.floor(value));
}

function compareContentPublishAtDesc(left: PublicContentSummaryContract, right: PublicContentSummaryContract) {
  const leftTime = Date.parse(left.publishAt);
  const rightTime = Date.parse(right.publishAt);

  if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) {
    return rightTime - leftTime;
  }

  return String(right.publishAt || "").localeCompare(String(left.publishAt || "")) || right.id.localeCompare(left.id);
}

function isAchievementItem(item: PublicContentSummaryContract) {
  return ACHIEVEMENT_PATTERN.test([item.title, item.summary, item.category, ...item.tags].join(" "));
}

export function mapHomeSectionRowToPublicHomeSection(row: PublicHomeSectionRow): PublicHomeSectionContract {
  return {
    id: row.id || "",
    key: row.section_key || "",
    title: row.title || "",
    summary: row.summary || "",
    href: row.href || "",
    order: normalizePublicOrder(row.sort_order),
    updatedAt: row.updated_at || ""
  };
}

export function createPublicHomeSnapshot(
  input: {
    sections: PublicHomeSectionRow[];
    content: PublicContentSummaryReadRow[];
    featuredDocuments: DocumentRow[];
    metadata: PublicMetadataContract;
    visitorStats: PublicVisitorStatsSnapshotContract;
  },
  generatedAt = new Date()
): PublicHomeSnapshotContract {
  const content = input.content.map(mapContentSummaryRowToPublicContentItem);
  const latestNews = content.filter((item) => item.type === "news" || item.type === "blog").slice(0, 6);
  const latestAnnouncements = content.filter((item) => item.type === "announcement").slice(0, 8);
  const programs = content.filter((item) => item.type === "program").slice(0, 8);
  const featuredContent = content.filter((item) => item.type !== "program" && item.featured).slice(0, 6);
  const achievementItems = content
    .filter(isAchievementItem)
    .sort(compareContentPublishAtDesc)
    .slice(0, HOME_ACHIEVEMENT_LIMIT);
  const publicDocuments = input.featuredDocuments.map(mapDocumentRowToPublicDocumentItem);
  const homeContent = [...latestNews, ...latestAnnouncements, ...programs, ...featuredContent];
  const homeMediaReferences = [
    ...homeContent,
    ...input.metadata.events.map((event) => ({
      mediaIds: event.mediaIds ?? []
    }))
  ];

  return {
    siteSettings: input.metadata.siteSettings,
    homepageSettings: input.metadata.homepageSettings,
    displaySettings: input.metadata.displaySettings,
    menu: input.metadata.menu,
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
    sections: input.sections.map(mapHomeSectionRowToPublicHomeSection),
    featuredContent,
    featuredDocuments: publicDocuments,
    programs,
    generatedAt: generatedAt.toISOString()
  };
}
