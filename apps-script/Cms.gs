function setupCmsBackend() {
  ensureDefaultScriptProperties();
  ensureAuthTokenSecret();

  const spreadsheetId = getSetting(SETTING_KEYS.spreadsheetId);
  const spreadsheetName =
    getSetting(SETTING_KEYS.spreadsheetName) || DEFAULT_SCRIPT_PROPERTIES[SETTING_KEYS.spreadsheetName];
  const spreadsheet = spreadsheetId ? SpreadsheetApp.openById(spreadsheetId) : SpreadsheetApp.create(spreadsheetName);

  setSetting(SETTING_KEYS.spreadsheetId, spreadsheet.getId());

  ensureSheet(spreadsheet, SHEETS.content, CONTENT_HEADERS);
  ensureSheet(spreadsheet, SHEETS.carousel, CAROUSEL_HEADERS);
  ensureSheet(spreadsheet, SHEETS.externalServices, EXTERNAL_SERVICE_HEADERS);
  ensureSheet(spreadsheet, SHEETS.media, MEDIA_HEADERS);
  ensureSheet(spreadsheet, SHEETS.events, EVENT_HEADERS);
  ensureSheet(spreadsheet, SHEETS.menu, MENU_HEADERS);
  ensureSheet(spreadsheet, SHEETS.users, USER_HEADERS);
  ensureSheet(spreadsheet, SHEETS.visitorStats, VISITOR_STATS_HEADERS);
  const folders = ensureFolders();
  ensureSettingsSheet(spreadsheet);
  ensureDefaultUsersSheet(spreadsheet);

  return {
    spreadsheetId: spreadsheet.getId(),
    spreadsheetUrl: spreadsheet.getUrl(),
    driveFolderId: folders.driveFolderId,
    docsFolderId: folders.docsFolderId
  };
}

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const ALLOWED_CONTENT_TYPES = ["page", "news", "program", "announcement", "blog"];
const ALLOWED_CONTENT_STATUSES = ["draft", "review", "scheduled", "published"];
const ALLOWED_EXTERNAL_SERVICE_TONES = [
  "student",
  "homeroom",
  "management",
  "learning",
  "calendar",
  "check",
  "admission",
  "career",
  "general"
];
const ALLOWED_EXTERNAL_SERVICE_ICON_KEYS = [
  "apps",
  "calendar",
  "check",
  "groups",
  "handshake",
  "registration",
  "book",
  "school",
  "link"
];

const ALLOWED_EXACT_UPLOAD_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.oasis.opendocument.spreadsheet",
  "text/csv",
  "application/csv"
];

const ALLOWED_PUBLIC_MEDIA_EMBED_HOSTS = [
  "drive.google.com",
  "docs.google.com",
  "youtube.com",
  "www.youtube.com",
  "youtu.be"
];

const PUBLIC_HOME_LATEST_NEWS_LIMIT = 4;
const PUBLIC_HOME_ANNOUNCEMENTS_LIMIT = 5;
const PUBLIC_HOME_PROCUREMENT_LIMIT = 4;
const PUBLIC_HOME_JOB_LIMIT = 4;
const PUBLIC_HOME_ACHIEVEMENT_LIMIT = 4;
const PUBLIC_HOME_PROGRAM_LIMIT = 6;
const PUBLIC_HOME_DOCUMENT_LIMIT = 6;
const PUBLIC_HOME_EVENT_LIMIT = 4;

const PUBLIC_HOME_DOCUMENT_KEYWORDS = ["เอกสาร", "document", "ita", "แผนงาน", "ประกันคุณภาพ"];
const PUBLIC_HOME_PROCUREMENT_KEYWORDS = ["procurement", "จัดซื้อ", "จัดจ้าง", "จัดซื้อจัดจ้าง", "ประกวดราคา", "tor"];
const PUBLIC_HOME_JOB_KEYWORDS = [
  "job",
  "jobs",
  "recruitment",
  "สมัครงาน",
  "หางาน",
  "ตำแหน่งงาน",
  "ฝึกงาน",
  "แนะแนวอาชีพ"
];
const PUBLIC_HOME_ACHIEVEMENT_KEYWORDS = [
  "ความสำเร็จ",
  "ผลงาน",
  "รางวัล",
  "เกียรติยศ",
  "ความภาคภูมิใจ",
  "นักเรียนดีเด่น",
  "ครูดีเด่น",
  "บุคลากรดีเด่น",
  "นวัตกรรม",
  "ทวิภาคี",
  "achievement",
  "award",
  "honor",
  "highlight",
  "success",
  "innovation"
];
const PUBLIC_HOME_ACHIEVEMENT_CONTENT_TYPES = ["news", "announcement", "blog", "page"];

function getSnapshot(options) {
  const config = options || {};
  const includeUnpublished = Boolean(config.includeUnpublished);
  const spreadsheet = getSpreadsheet();
  const content = readObjects(spreadsheet.getSheetByName(SHEETS.content), CONTENT_HEADERS).map(normalizeContentRecord);
  const media = readObjects(spreadsheet.getSheetByName(SHEETS.media), MEDIA_HEADERS);
  const events = readObjects(spreadsheet.getSheetByName(SHEETS.events), EVENT_HEADERS);
  const carouselSlides = getCarouselSlides({
    includeDisabled: includeUnpublished
  });
  const externalServices = getExternalServices({
    includeDisabled: includeUnpublished
  });
  const menu = getMenu();
  const visibleContent = includeUnpublished ? content : content.filter((item) => item.status === "published");
  const visibleEvents = includeUnpublished
    ? events
    : events.filter((event) => event.visibility !== "private" && event.status !== "cancelled");
  const visibleMedia = includeUnpublished
    ? media
    : filterMediaForPublicSnapshot(media, visibleContent).map(sanitizePublicMediaRecord);
  const responseContent = includeUnpublished
    ? visibleContent
    : visibleContent.map((item) => sanitizePublicContentListRecord(item));

  return {
    metrics: buildMetrics(visibleContent, visibleMedia),
    content: responseContent,
    media: visibleMedia,
    events: visibleEvents,
    menu,
    carouselSlides,
    externalServices,
    displaySettings: getDisplaySettings(),
    siteSettings: getSiteSettings(),
    homepageSettings: getHomepageSettings(),
    visitorStats: getVisitorStats()
  };
}

function getPublicHomeSnapshot() {
  const spreadsheet = getSpreadsheet();
  const content = readObjects(spreadsheet.getSheetByName(SHEETS.content), CONTENT_HEADERS).map(normalizeContentRecord);
  const media = readObjects(spreadsheet.getSheetByName(SHEETS.media), MEDIA_HEADERS);
  const events = readObjects(spreadsheet.getSheetByName(SHEETS.events), EVENT_HEADERS);
  const publicContent = sortContentByPublishDate(
    content.filter((item) => item.status === "published").map((item) => sanitizePublicContentListRecord(item))
  );
  const announcementContent = publicContent.filter((item) => item.type === "announcement");
  const latestNews = publicContent
    .filter((item) => item.type === "news" || item.type === "blog")
    .slice(0, PUBLIC_HOME_LATEST_NEWS_LIMIT);
  const latestAnnouncements = announcementContent.slice(0, PUBLIC_HOME_ANNOUNCEMENTS_LIMIT);
  const procurementItems = announcementContent
    .filter((item) => hasHomeContentSearchTerm(item, PUBLIC_HOME_PROCUREMENT_KEYWORDS))
    .slice(0, PUBLIC_HOME_PROCUREMENT_LIMIT);
  const jobOpportunityItems = announcementContent
    .filter((item) => hasHomeContentSearchTerm(item, PUBLIC_HOME_JOB_KEYWORDS))
    .slice(0, PUBLIC_HOME_JOB_LIMIT);
  const achievementItems = publicContent
    .filter(
      (item) =>
        PUBLIC_HOME_ACHIEVEMENT_CONTENT_TYPES.indexOf(item.type) !== -1 &&
        hasHomeContentSearchTerm(item, PUBLIC_HOME_ACHIEVEMENT_KEYWORDS)
    )
    .slice(0, PUBLIC_HOME_ACHIEVEMENT_LIMIT);
  const programItems = publicContent.filter((item) => item.type === "program").slice(0, PUBLIC_HOME_PROGRAM_LIMIT);
  const documentItems = publicContent
    .filter((item) => item.type === "page" && hasHomeContentKeyword(item, PUBLIC_HOME_DOCUMENT_KEYWORDS))
    .slice(0, PUBLIC_HOME_DOCUMENT_LIMIT);
  const eventItems = sortEventsByUpcomingDate(
    events.filter((event) => event.status === "confirmed" && (event.visibility || "public") === "public")
  )
    .slice(0, PUBLIC_HOME_EVENT_LIMIT)
    .map(sanitizePublicHomeEventRecord);
  const homeContent = collectPublicHomeContentItems([
    latestNews,
    latestAnnouncements,
    procurementItems,
    jobOpportunityItems,
    achievementItems,
    programItems,
    documentItems
  ]);
  const siteSettings = getSiteSettings();
  const carouselSlides = getCarouselSlides({
    includeDisabled: false
  });

  return {
    siteSettings,
    homepageSettings: getHomepageSettings(),
    displaySettings: getDisplaySettings(),
    menu: getMenu(),
    carouselSlides,
    externalServices: getExternalServices({
      includeDisabled: false
    }),
    visitorStats: getVisitorStats(),
    latestNews,
    latestAnnouncements,
    procurementItems,
    jobOpportunityItems,
    achievementItems,
    programItems,
    documentItems,
    eventItems,
    media: filterPublicHomeMedia(media, homeContent),
    generatedAt: new Date().toISOString()
  };
}

function getPublicContentListSnapshot(query) {
  const config = query || {};
  const kind = normalizePublicContentListKind(config.kind || config.type || "");
  const spreadsheet = getSpreadsheet();
  const content = readObjects(spreadsheet.getSheetByName(SHEETS.content), CONTENT_HEADERS).map(normalizeContentRecord);
  const media = readObjects(spreadsheet.getSheetByName(SHEETS.media), MEDIA_HEADERS);
  const publicContent = sortContentByPublishDate(
    content.filter((item) => item.status === "published").map((item) => sanitizePublicContentListRecord(item))
  );
  const items = publicContent.filter((item) => item.type === getPublicContentListType(kind));
  const pageItems = kind === "announcements" ? publicContent.filter((item) => item.type === "page") : [];
  const listContent = collectPublicHomeContentItems([items, pageItems]);
  const response = {
    kind,
    items,
    media: filterPublicContentListMedia(media, listContent),
    siteSettings: getSiteSettings(),
    homepageSettings: getHomepageSettings(),
    displaySettings: getDisplaySettings(),
    menu: getMenu(),
    generatedAt: new Date().toISOString()
  };

  if (kind === "announcements") {
    response.pageItems = pageItems;
  }

  return response;
}

function getPublicProgramListSnapshot() {
  const spreadsheet = getSpreadsheet();
  const content = readObjects(spreadsheet.getSheetByName(SHEETS.content), CONTENT_HEADERS).map(normalizeContentRecord);
  const media = readObjects(spreadsheet.getSheetByName(SHEETS.media), MEDIA_HEADERS);
  const items = sortContentByPublishDate(
    content
      .filter((item) => item.status === "published" && item.type === "program")
      .map((item) => sanitizePublicContentListRecord(item))
  );

  return {
    items,
    media: filterPublicHomeMedia(media, items),
    siteSettings: getSiteSettings(),
    homepageSettings: getHomepageSettings(),
    displaySettings: getDisplaySettings(),
    menu: getMenu(),
    generatedAt: new Date().toISOString()
  };
}

function getPublicSearchIndexSnapshot() {
  const spreadsheet = getSpreadsheet();
  const content = readObjects(spreadsheet.getSheetByName(SHEETS.content), CONTENT_HEADERS).map(normalizeContentRecord);
  const items = sortContentByPublishDate(
    content.filter((item) => item.status === "published").map((item) => sanitizePublicSearchIndexContentRecord(item))
  );

  return {
    items,
    siteSettings: getSiteSettings(),
    homepageSettings: getHomepageSettings(),
    displaySettings: getDisplaySettings(),
    menu: getMenu(),
    generatedAt: new Date().toISOString()
  };
}

function normalizePublicContentListKind(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  if (normalized === "news" || normalized === "announcements" || normalized === "blog") {
    return normalized;
  }

  throw createHttpError("Invalid public content list kind.", 400);
}

function getPublicContentListType(kind) {
  if (kind === "announcements") {
    return "announcement";
  }

  return kind;
}

function collectPublicHomeContentItems(groups) {
  const seen = {};
  const items = [];

  groups.forEach((group) => {
    group.forEach((item) => {
      if (!item.id || seen[item.id]) {
        return;
      }

      seen[item.id] = true;
      items.push(item);
    });
  });

  return items;
}

function sortContentByPublishDate(items) {
  return items.slice().sort((left, right) => getHomePublishDateValue(right) - getHomePublishDateValue(left));
}

function getHomePublishDateValue(item) {
  const value = Date.parse(item.publishAt || "");
  return Number.isFinite(value) ? value : 0;
}

function getHomeEventDateValue(event) {
  const value = Date.parse(event.date || "");
  return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
}

function sortEventsByUpcomingDate(events) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTime = today.getTime();

  return events.slice().sort((left, right) => {
    const leftDate = getHomeEventDateValue(left);
    const rightDate = getHomeEventDateValue(right);
    const leftUpcoming = leftDate >= todayTime;
    const rightUpcoming = rightDate >= todayTime;

    if (leftUpcoming !== rightUpcoming) {
      return leftUpcoming ? -1 : 1;
    }

    return leftUpcoming ? leftDate - rightDate : rightDate - leftDate;
  });
}

function hasHomeContentKeyword(item, keywords) {
  const haystack = [item.category]
    .concat(item.tags || [])
    .join(" ")
    .toLowerCase();

  return keywords.some((keyword) => haystack.indexOf(String(keyword).toLowerCase()) !== -1);
}

function hasHomeContentSearchTerm(item, terms) {
  const haystack = [item.title, item.summary, item.category]
    .concat(item.tags || [])
    .join(" ")
    .toLowerCase();

  return terms.some((term) => haystack.indexOf(String(term).toLowerCase()) !== -1);
}

function filterPublicHomeMedia(media, homeContent) {
  const allowedIds = {};

  homeContent.forEach((item) => {
    if (item.featuredMediaId) {
      allowedIds[item.featuredMediaId] = true;
    }

    normalizeMediaIds(item.mediaIds).forEach((id) => {
      allowedIds[id] = true;
    });
  });

  return media.filter((asset) => Boolean(allowedIds[asset.id])).map(sanitizePublicMediaRecord);
}

function filterPublicContentListMedia(media, contentItems) {
  return filterPublicHomeMedia(media, contentItems);
}

function sanitizePublicHomeEventRecord(event) {
  return {
    id: event.id || "",
    title: event.title || "",
    date: event.date || "",
    endDate: event.endDate || "",
    audience: event.audience || "",
    status: "confirmed",
    location: event.location || "",
    description: event.description || "",
    category: event.category || "",
    visibility: "public",
    updatedAt: event.updatedAt || ""
  };
}

function sanitizePublicSearchIndexContentRecord(item) {
  const sanitized = sanitizePublicContentRecord(item);

  return {
    id: sanitized.id || "",
    title: sanitized.title || "",
    slug: sanitized.slug || "",
    type: sanitized.type || "page",
    status: "published",
    owner: sanitized.owner || "",
    summary: sanitized.summary || "",
    category: sanitized.category || "",
    tags: sanitized.tags || [],
    seoTitle: sanitized.seoTitle || "",
    seoDescription: sanitized.seoDescription || "",
    featured: Boolean(sanitized.featured),
    readingMinutes: sanitized.readingMinutes || 0,
    updatedAt: sanitized.updatedAt || "",
    publishAt: sanitized.publishAt || ""
  };
}

function filterMediaForPublicSnapshot(media, content) {
  const allowedIds = {};

  content.forEach((item) => {
    if (item.featuredMediaId) {
      allowedIds[item.featuredMediaId] = true;
    }

    normalizeMediaIds(item.mediaIds).forEach((id) => {
      allowedIds[id] = true;
    });
  });

  return media.filter((asset) => Boolean(allowedIds[asset.id]));
}

function sanitizePublicMediaRecord(asset) {
  return {
    id: asset.id || "",
    name: asset.name || "",
    type: asset.type || "document",
    size: "",
    owner: "",
    driveUrl: normalizePublicMediaUrlOrEmpty(asset.driveUrl),
    previewUrl: normalizePublicMediaUrlOrEmpty(asset.previewUrl, ALLOWED_PUBLIC_MEDIA_EMBED_HOSTS),
    embedUrl: normalizePublicMediaUrlOrEmpty(asset.embedUrl, ALLOWED_PUBLIC_MEDIA_EMBED_HOSTS),
    updatedAt: ""
  };
}

function upsertContent(item) {
  validateRequired(item, ["title", "slug", "type", "status", "owner"]);

  const spreadsheet = getSpreadsheet();
  const sheet = spreadsheet.getSheetByName(SHEETS.content);
  const existingItem = item.id ? findRowById(sheet, CONTENT_HEADERS, item.id) : null;
  const contentId = item.id || `content-${Date.now()}`;
  const normalizedSlug = normalizeSlugValue(item.slug);
  const normalizedType = validateContentType(item.type);
  const normalizedStatus = validateContentStatus(item.status);

  if (!normalizedSlug) {
    throw createHttpError("Missing required field: slug", 400);
  }

  assertUniqueContentSlug(sheet, contentId, normalizedSlug);

  const normalizedBody = item.body || "";
  const normalizedTags = normalizeTags(item.tags);
  const normalizedCategory = normalizeCategoryValue(item.category);
  const readingMinutes = resolveReadingMinutes(item.readingMinutes, normalizedBody || item.summary || item.title);
  const documentRecord = upsertContentBodyDocument({
    id: contentId,
    title: item.title,
    body: normalizedBody,
    existingDocId: existingItem ? existingItem.bodyDocId : ""
  });
  const nextItem = {
    id: contentId,
    title: item.title,
    slug: normalizedSlug,
    type: normalizedType,
    status: normalizedStatus,
    owner: item.owner,
    summary: item.summary || "",
    category: normalizedCategory,
    tags: normalizedTags.join(","),
    seoTitle: item.seoTitle || "",
    seoDescription: item.seoDescription || "",
    canonicalUrl: normalizePublicMediaUrl(item.canonicalUrl || ""),
    featured: toSheetBoolean(item.featured),
    readingMinutes,
    template: item.template || "standard",
    body: "",
    bodyDocId: documentRecord.id,
    bodyDocUrl: documentRecord.url,
    featuredMediaId: item.featuredMediaId || "",
    mediaIds: normalizeMediaIds(item.mediaIds).join(","),
    updatedAt: new Date().toISOString(),
    publishAt: item.publishAt || new Date().toISOString(),
    viewCount: existingItem ? normalizeViewCount(existingItem.viewCount) : 0,
    lastViewedAt: existingItem ? existingItem.lastViewedAt || "" : ""
  };

  upsertRow(sheet, CONTENT_HEADERS, nextItem);
  invalidatePublicSnapshotCache();
  return normalizeContentRecord({
    ...nextItem,
    body: normalizedBody
  });
}

function deleteContent(id) {
  const spreadsheet = getSpreadsheet();
  const sheet = spreadsheet.getSheetByName(SHEETS.content);
  const item = findRowById(sheet, CONTENT_HEADERS, id);

  if (item && item.bodyDocId) {
    try {
      DriveApp.getFileById(item.bodyDocId).setTrashed(true);
    } catch (error) {
      console.warn(`Unable to trash Google Doc ${item.bodyDocId}: ${error.message || error}`);
    }
  }

  deleteRowById(SHEETS.content, CONTENT_HEADERS, id);
  invalidatePublicSnapshotCache();

  return {
    id,
    deleted: true
  };
}

function getCarouselSlides(options) {
  const config = options || {};
  const includeDisabled = Boolean(config.includeDisabled);
  const spreadsheet = getSpreadsheet();
  const sheet =
    spreadsheet.getSheetByName(SHEETS.carousel) || ensureSheet(spreadsheet, SHEETS.carousel, CAROUSEL_HEADERS);
  const now = new Date();

  return readObjects(sheet, CAROUSEL_HEADERS)
    .map(normalizeCarouselSlideRecord)
    .filter((slide) => includeDisabled || isCarouselSlideVisible(slide, now))
    .sort(compareCarouselSlides)
    .map((slide) => (includeDisabled ? slide : sanitizePublicCarouselSlideRecord(slide)));
}

function upsertCarouselSlide(input) {
  const spreadsheet = getSpreadsheet();
  const sheet =
    spreadsheet.getSheetByName(SHEETS.carousel) || ensureSheet(spreadsheet, SHEETS.carousel, CAROUSEL_HEADERS);
  const existingSlide = input && input.id ? findRowById(sheet, CAROUSEL_HEADERS, input.id) : null;
  const nextSlide = normalizeCarouselSlideRecord(input || {}, existingSlide || {}, {
    touch: true
  });

  upsertRow(sheet, CAROUSEL_HEADERS, {
    ...nextSlide,
    enabled: toSheetBoolean(nextSlide.enabled)
  });
  invalidatePublicSnapshotCache();
  return nextSlide;
}

function deleteCarouselSlide(id) {
  deleteRowById(SHEETS.carousel, CAROUSEL_HEADERS, id);
  invalidatePublicSnapshotCache();

  return {
    id,
    deleted: true
  };
}

function normalizeCarouselSlideRecord(row, fallback, options) {
  const source = row || {};
  const defaults = fallback || {};
  const config = options || {};
  const title = normalizeCarouselString(source.title, defaults.title || "");
  const order = Number(source.order !== undefined && source.order !== "" ? source.order : defaults.order);

  return {
    id: normalizeCarouselString(source.id, defaults.id || `carousel-${Date.now()}`),
    title,
    subtitle: normalizeCarouselString(source.subtitle, defaults.subtitle || ""),
    chip: normalizeCarouselString(source.chip, defaults.chip || "ประชาสัมพันธ์"),
    imageUrl: normalizeCarouselString(source.imageUrl, defaults.imageUrl || ""),
    imageAlt: normalizeCarouselString(source.imageAlt, defaults.imageAlt || title),
    buttonLabel: normalizeCarouselString(source.buttonLabel, defaults.buttonLabel || "อ่านต่อ"),
    href: normalizeCarouselString(source.href, defaults.href || "/"),
    enabled: normalizeSheetBoolean(
      source.enabled !== undefined && source.enabled !== "" ? source.enabled : defaults.enabled
    ),
    order: Number.isFinite(order) ? order : 0,
    startAt: normalizeCarouselString(source.startAt, defaults.startAt || ""),
    endAt: normalizeCarouselString(source.endAt, defaults.endAt || ""),
    updatedAt: config.touch
      ? new Date().toISOString()
      : normalizeCarouselString(source.updatedAt, defaults.updatedAt || new Date().toISOString())
  };
}

function sanitizePublicCarouselSlideRecord(slide) {
  return {
    id: slide.id || "",
    title: slide.title || "",
    subtitle: slide.subtitle || "",
    chip: slide.chip || "ประชาสัมพันธ์",
    imageUrl: slide.imageUrl || "",
    imageAlt: slide.imageAlt || slide.title || "",
    buttonLabel: slide.buttonLabel || "อ่านต่อ",
    href: slide.href || "/",
    enabled: slide.enabled === true,
    order: Number.isFinite(Number(slide.order)) ? Number(slide.order) : 0,
    startAt: slide.startAt || "",
    endAt: slide.endAt || "",
    updatedAt: slide.updatedAt || ""
  };
}

function isCarouselSlideVisible(slide, now) {
  if (!slide.enabled || !slide.imageUrl) {
    return false;
  }

  const currentTime = now instanceof Date ? now.getTime() : Date.now();
  const startTime = slide.startAt ? Date.parse(slide.startAt) : Number.NaN;
  const endTime = slide.endAt ? Date.parse(slide.endAt) : Number.NaN;

  if (Number.isFinite(startTime) && startTime > currentTime) {
    return false;
  }

  if (Number.isFinite(endTime) && endTime < currentTime) {
    return false;
  }

  return true;
}

function compareCarouselSlides(left, right) {
  const leftOrder = Number(left.order);
  const rightOrder = Number(right.order);
  const normalizedLeftOrder = Number.isFinite(leftOrder) ? leftOrder : 0;
  const normalizedRightOrder = Number.isFinite(rightOrder) ? rightOrder : 0;

  if (normalizedLeftOrder !== normalizedRightOrder) {
    return normalizedLeftOrder - normalizedRightOrder;
  }

  const leftUpdatedAt = Date.parse(left.updatedAt || "");
  const rightUpdatedAt = Date.parse(right.updatedAt || "");
  const normalizedLeftUpdatedAt = Number.isFinite(leftUpdatedAt) ? leftUpdatedAt : 0;
  const normalizedRightUpdatedAt = Number.isFinite(rightUpdatedAt) ? rightUpdatedAt : 0;

  return normalizedRightUpdatedAt - normalizedLeftUpdatedAt;
}

function normalizeCarouselString(value, fallback) {
  return typeof value === "string" ? value.trim() : fallback;
}

function getExternalServices(options) {
  const config = options || {};
  const includeDisabled = Boolean(config.includeDisabled);
  const spreadsheet = getSpreadsheet();
  const sheet =
    spreadsheet.getSheetByName(SHEETS.externalServices) ||
    ensureSheet(spreadsheet, SHEETS.externalServices, EXTERNAL_SERVICE_HEADERS);

  return readObjects(sheet, EXTERNAL_SERVICE_HEADERS)
    .map(normalizeExternalServiceRecord)
    .filter((service) => includeDisabled || isExternalServiceVisible(service))
    .sort(compareExternalServices)
    .map((service) => (includeDisabled ? service : sanitizePublicExternalServiceRecord(service)));
}

function upsertExternalService(input) {
  const spreadsheet = getSpreadsheet();
  const sheet =
    spreadsheet.getSheetByName(SHEETS.externalServices) ||
    ensureSheet(spreadsheet, SHEETS.externalServices, EXTERNAL_SERVICE_HEADERS);
  const existingService = input && input.id ? findRowById(sheet, EXTERNAL_SERVICE_HEADERS, input.id) : null;
  const nextService = normalizeExternalServiceRecord(input || {}, existingService || {}, {
    touch: true
  });

  upsertRow(sheet, EXTERNAL_SERVICE_HEADERS, {
    ...nextService,
    enabled: toSheetBoolean(nextService.enabled)
  });
  invalidatePublicSnapshotCache();
  return nextService;
}

function deleteExternalService(id) {
  deleteRowById(SHEETS.externalServices, EXTERNAL_SERVICE_HEADERS, id);
  invalidatePublicSnapshotCache();

  return {
    id,
    deleted: true
  };
}

function normalizeExternalServiceRecord(row, fallback, options) {
  const source = row || {};
  const defaults = fallback || {};
  const config = options || {};
  const order = Number(source.order !== undefined && source.order !== "" ? source.order : defaults.order);

  return {
    id: normalizeExternalServiceString(source.id, defaults.id || `external-service-${Date.now()}`),
    title: normalizeExternalServiceString(source.title, defaults.title || ""),
    description: normalizeExternalServiceString(source.description, defaults.description || ""),
    href: normalizeExternalServiceString(source.href, defaults.href || ""),
    tone: normalizeExternalServiceTone(source.tone, defaults.tone || "general"),
    iconKey: normalizeExternalServiceIconKey(source.iconKey, defaults.iconKey || "link"),
    enabled: normalizeSheetBoolean(
      source.enabled !== undefined && source.enabled !== "" ? source.enabled : defaults.enabled
    ),
    order: Number.isFinite(order) ? order : 0,
    updatedAt: config.touch
      ? new Date().toISOString()
      : normalizeExternalServiceString(source.updatedAt, defaults.updatedAt || new Date().toISOString())
  };
}

function sanitizePublicExternalServiceRecord(service) {
  return {
    id: service.id || "",
    title: service.title || "",
    description: service.description || "",
    href: service.href || "",
    tone: normalizeExternalServiceTone(service.tone, "general"),
    iconKey: normalizeExternalServiceIconKey(service.iconKey, "link"),
    enabled: service.enabled === true,
    order: Number.isFinite(Number(service.order)) ? Number(service.order) : 0,
    updatedAt: service.updatedAt || ""
  };
}

function isExternalServiceVisible(service) {
  return Boolean(service.enabled && service.title && service.href);
}

function compareExternalServices(left, right) {
  const leftOrder = Number(left.order);
  const rightOrder = Number(right.order);
  const normalizedLeftOrder = Number.isFinite(leftOrder) ? leftOrder : 0;
  const normalizedRightOrder = Number.isFinite(rightOrder) ? rightOrder : 0;

  if (normalizedLeftOrder !== normalizedRightOrder) {
    return normalizedLeftOrder - normalizedRightOrder;
  }

  const leftUpdatedAt = Date.parse(left.updatedAt || "");
  const rightUpdatedAt = Date.parse(right.updatedAt || "");
  const normalizedLeftUpdatedAt = Number.isFinite(leftUpdatedAt) ? leftUpdatedAt : 0;
  const normalizedRightUpdatedAt = Number.isFinite(rightUpdatedAt) ? rightUpdatedAt : 0;

  return normalizedRightUpdatedAt - normalizedLeftUpdatedAt;
}

function normalizeExternalServiceString(value, fallback) {
  return typeof value === "string" ? value.trim() : fallback;
}

function normalizeExternalServiceTone(value, fallback) {
  return normalizeExternalServiceAllowedValue(value, fallback, ALLOWED_EXTERNAL_SERVICE_TONES);
}

function normalizeExternalServiceIconKey(value, fallback) {
  return normalizeExternalServiceAllowedValue(value, fallback, ALLOWED_EXTERNAL_SERVICE_ICON_KEYS);
}

function normalizeExternalServiceAllowedValue(value, fallback, allowedValues) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  return allowedValues.indexOf(normalized) === -1 ? fallback : normalized;
}

function getContentDetail(query, options) {
  const config = options || {};
  const includeUnpublished = Boolean(config.includeUnpublished);
  const spreadsheet = getSpreadsheet();
  const rows = readObjects(spreadsheet.getSheetByName(SHEETS.content), CONTENT_HEADERS);
  const id = query.id || "";
  const slug = query.slug || "";
  const item = rows.find((row) => (id && row.id === id) || (slug && row.slug === slug));

  if (!item) {
    throw createHttpError("Content item not found.", 404);
  }

  if (!includeUnpublished && item.status !== "published") {
    throw createHttpError("Content item not found.", 404);
  }

  const detail = normalizeContentRecord(item, {
    includeBody: true
  });

  return includeUnpublished ? detail : sanitizePublicContentRecord(detail, { includeBody: true });
}

function incrementContentView(input) {
  const lookup = input || {};
  const id = normalizeContentIdValue(lookup.id || "");
  const slug = lookup.slug ? normalizeSlugValue(lookup.slug) : "";

  if (!id && !slug) {
    throw createHttpError("Missing content id or slug.", 400);
  }

  const lock = LockService.getScriptLock();
  let lockAcquired = false;

  try {
    lockAcquired = lock.tryLock(5000);

    if (!lockAcquired) {
      throw createHttpError("Content view counter is busy. Please retry.", 503);
    }

    const spreadsheet = getSpreadsheet();
    const sheet = ensureSheet(spreadsheet, SHEETS.content, CONTENT_HEADERS);
    const activeHeaders = getActiveHeaders(sheet, CONTENT_HEADERS);
    const rows = sheet.getDataRange().getValues();
    const idIndex = activeHeaders.indexOf("id");
    const slugIndex = activeHeaders.indexOf("slug");
    const statusIndex = activeHeaders.indexOf("status");
    const viewCountIndex = activeHeaders.indexOf("viewCount");
    const lastViewedAtIndex = activeHeaders.indexOf("lastViewedAt");

    for (let index = 1; index < rows.length; index += 1) {
      const row = rows[index];
      const rowId = String(row[idIndex] || "");
      const rowSlug = String(row[slugIndex] || "");

      if ((id && rowId === id) || (slug && rowSlug === slug)) {
        if (String(row[statusIndex] || "") !== "published") {
          throw createHttpError("Content item not found.", 404);
        }

        const viewCount = normalizeViewCount(row[viewCountIndex]) + 1;
        const lastViewedAt = new Date().toISOString();

        sheet.getRange(index + 1, viewCountIndex + 1).setValue(viewCount);
        sheet.getRange(index + 1, lastViewedAtIndex + 1).setValue(lastViewedAt);

        return {
          id: rowId,
          slug: rowSlug,
          viewCount,
          lastViewedAt
        };
      }
    }

    throw createHttpError("Content item not found.", 404);
  } finally {
    if (lockAcquired) {
      lock.releaseLock();
    }
  }
}

function upsertMedia(asset) {
  validateRequired(asset, ["name", "type", "owner"]);

  const spreadsheet = getSpreadsheet();
  const sheet = spreadsheet.getSheetByName(SHEETS.media);
  const uploadedFile = asset.fileBase64 ? createDriveFile(asset) : null;
  const driveUrl = normalizePublicMediaUrl(uploadedFile ? uploadedFile.getUrl() : asset.driveUrl || "");
  const fileId = uploadedFile ? uploadedFile.getId() : asset.fileId || extractDriveFileId(driveUrl);
  const mimeType = uploadedFile ? uploadedFile.getMimeType() : asset.mimeType || "";
  const previewUrl = normalizePublicMediaUrl(
    asset.previewUrl || buildPreviewUrl(fileId, asset.type),
    ALLOWED_PUBLIC_MEDIA_EMBED_HOSTS
  );
  const embedUrl = normalizePublicMediaUrl(asset.embedUrl || buildEmbedUrl(fileId), ALLOWED_PUBLIC_MEDIA_EMBED_HOSTS);
  const nextAsset = {
    id: asset.id || `media-${Date.now()}`,
    name: asset.name,
    type: asset.type,
    size: uploadedFile ? formatBytes(uploadedFile.getSize()) : asset.size || "",
    owner: asset.owner,
    driveUrl,
    fileId,
    mimeType,
    previewUrl,
    embedUrl,
    updatedAt: new Date().toISOString()
  };

  upsertRow(sheet, MEDIA_HEADERS, nextAsset);
  invalidatePublicSnapshotCache();
  return nextAsset;
}

function deleteMedia(id, deleteDriveFile) {
  const spreadsheet = getSpreadsheet();
  const sheet = spreadsheet.getSheetByName(SHEETS.media);
  const asset = findRowById(sheet, MEDIA_HEADERS, id);

  if (deleteDriveFile && asset && asset.fileId) {
    try {
      DriveApp.getFileById(asset.fileId).setTrashed(true);
    } catch (error) {
      console.warn(`Unable to trash Drive file ${asset.fileId}: ${error.message || error}`);
    }
  }

  deleteRowById(SHEETS.media, MEDIA_HEADERS, id);
  invalidatePublicSnapshotCache();

  return {
    id,
    deleted: true
  };
}

function upsertEvent(event) {
  validateRequired(event, ["title", "date", "audience", "status"]);
  validateEventDateRange(event.date, event.endDate);

  const spreadsheet = getSpreadsheet();
  const sheet = spreadsheet.getSheetByName(SHEETS.events);
  const nextEvent = {
    id: event.id || `event-${Date.now()}`,
    title: event.title,
    date: event.date,
    endDate: event.endDate || "",
    audience: event.audience,
    status: event.status,
    location: event.location || "",
    description: event.description || "",
    category: event.category || "",
    visibility: event.visibility || "public",
    updatedAt: new Date().toISOString()
  };

  upsertRow(sheet, EVENT_HEADERS, nextEvent);
  invalidatePublicSnapshotCache();
  return nextEvent;
}

function deleteEvent(id) {
  deleteRowById(SHEETS.events, EVENT_HEADERS, id);
  invalidatePublicSnapshotCache();

  return {
    id,
    deleted: true
  };
}

function publishContent(id) {
  if (!id) {
    throw new Error("Missing content id.");
  }

  const spreadsheet = getSpreadsheet();
  const sheet = spreadsheet.getSheetByName(SHEETS.content);
  const rows = sheet.getDataRange().getValues();
  const idIndex = CONTENT_HEADERS.indexOf("id");
  const statusIndex = CONTENT_HEADERS.indexOf("status");
  const updatedIndex = CONTENT_HEADERS.indexOf("updatedAt");

  for (let index = 1; index < rows.length; index += 1) {
    if (rows[index][idIndex] === id) {
      sheet.getRange(index + 1, statusIndex + 1).setValue("published");
      sheet.getRange(index + 1, updatedIndex + 1).setValue(new Date().toISOString());
      invalidatePublicSnapshotCache();
      return {
        id,
        published: true
      };
    }
  }

  throw new Error(`Content item not found: ${id}`);
}

function normalizeContentRecord(item, options) {
  const config = options || {};
  const includeBody = Boolean(config.includeBody);
  const documentBody = includeBody ? readContentBody(item.bodyDocId) : "";
  const bodyValue = includeBody ? documentBody || item.body || "" : "";
  const readingMinutes = resolveReadingMinutes(item.readingMinutes, bodyValue || item.summary || item.title);

  return {
    ...item,
    body: bodyValue,
    category: normalizeCategoryValue(item.category),
    tags: normalizeTags(item.tags),
    seoTitle: item.seoTitle || "",
    seoDescription: item.seoDescription || "",
    canonicalUrl: normalizePublicMediaUrlOrEmpty(item.canonicalUrl),
    featured: normalizeSheetBoolean(item.featured),
    readingMinutes,
    template: item.template || "standard",
    bodyDocId: item.bodyDocId || "",
    bodyDocUrl: item.bodyDocUrl || "",
    featuredMediaId: item.featuredMediaId || "",
    mediaIds: normalizeMediaIds(item.mediaIds),
    viewCount: normalizeViewCount(item.viewCount),
    lastViewedAt: item.lastViewedAt || ""
  };
}

function sanitizePublicContentRecord(item, options) {
  const config = options || {};
  const sanitized = {
    ...item
  };

  sanitized.canonicalUrl = normalizePublicMediaUrlOrEmpty(sanitized.canonicalUrl);

  delete sanitized.bodyDocId;
  delete sanitized.bodyDocUrl;

  if (!config.includeBody) {
    delete sanitized.body;
  }

  return sanitized;
}

function sanitizePublicContentListRecord(item) {
  const sanitized = sanitizePublicContentRecord(item);

  return {
    id: sanitized.id || "",
    title: sanitized.title || "",
    slug: sanitized.slug || "",
    type: sanitized.type || "page",
    status: "published",
    owner: sanitized.owner || "",
    summary: sanitized.summary || "",
    category: sanitized.category || "",
    tags: sanitized.tags || [],
    featured: Boolean(sanitized.featured),
    readingMinutes: sanitized.readingMinutes || 0,
    featuredMediaId: sanitized.featuredMediaId || "",
    mediaIds: sanitized.mediaIds || [],
    updatedAt: sanitized.updatedAt || "",
    publishAt: sanitized.publishAt || ""
  };
}

function normalizeSlugValue(value) {
  const rawValue = String(value || "");

  if (!rawValue || /[\u0000-\u001F\u007F\s/\\?#:]/u.test(rawValue) || rawValue.indexOf("..") !== -1) {
    throw createHttpError("Invalid slug format.", 400);
  }

  const normalized = rawValue
    .toLowerCase()
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!normalized || normalized.length > 120 || !/^[\p{L}\p{M}\p{N}-]+$/u.test(normalized)) {
    throw createHttpError("Invalid slug format.", 400);
  }

  return normalized;
}

function normalizeContentIdValue(value) {
  const normalized = String(value || "").trim();

  if (!normalized) {
    return "";
  }

  if (normalized.length > 160 || /[\u0000-\u001F\u007F\s/\\?#:]/u.test(normalized)) {
    throw createHttpError("Invalid content id.", 400);
  }

  return normalized;
}

function normalizeViewCount(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return 0;
  }

  return Math.floor(numericValue);
}

function normalizePublicMediaUrl(url, allowedHosts) {
  const value = String(url || "").trim();
  const hostAllowlist = allowedHosts || [];

  if (!value) {
    return "";
  }

  if (/[\u0000-\u001F\u007F\s\\]/.test(value)) {
    throw createHttpError("Invalid public URL.", 400);
  }

  const protocolMatch = value.match(/^([A-Za-z][A-Za-z0-9+.-]*):/);

  if (!protocolMatch) {
    throw createHttpError("Public URL must use https.", 400);
  }

  const protocol = `${protocolMatch[1].toLowerCase()}:`;

  if (protocol !== "https:") {
    throw createHttpError("Public URL must use https.", 400);
  }

  const hostMatch = value.match(/^https:\/\/([^/?#]+)(?:[/?#]|$)/i);

  if (!hostMatch || !hostMatch[1] || hostMatch[1].indexOf("@") !== -1) {
    throw createHttpError("Invalid public URL.", 400);
  }

  const hostname = hostMatch[1].split(":")[0].toLowerCase();

  if (hostAllowlist.length && hostAllowlist.indexOf(hostname) === -1) {
    throw createHttpError("Public media preview/embed URL host is not allowed.", 400);
  }

  return value;
}

function normalizePublicMediaUrlOrEmpty(url, allowedHosts) {
  try {
    return normalizePublicMediaUrl(url, allowedHosts);
  } catch (error) {
    console.warn(`Dropping unsafe public URL: ${error.message || error}`);
    return "";
  }
}

function validateContentType(value) {
  return validateAllowedContentValue("type", value, ALLOWED_CONTENT_TYPES);
}

function validateContentStatus(value) {
  return validateAllowedContentValue("status", value, ALLOWED_CONTENT_STATUSES);
}

function validateAllowedContentValue(fieldName, value, allowedValues) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  if (allowedValues.indexOf(normalized) === -1) {
    throw createHttpError(`Invalid content ${fieldName}.`, 400);
  }

  return normalized;
}

function assertUniqueContentSlug(sheet, contentId, normalizedSlug) {
  const rows = readObjects(sheet, CONTENT_HEADERS);
  const duplicate = rows.find((row) => {
    if (row.id === contentId) {
      return false;
    }

    try {
      return normalizeSlugValue(row.slug) === normalizedSlug;
    } catch (error) {
      return false;
    }
  });

  if (duplicate) {
    throw createHttpError("Slug นี้ถูกใช้งานแล้ว กรุณาเปลี่ยนลิงก์ถาวร", 409);
  }
}

function resolveReadingMinutes(value, text) {
  const numericValue = Number(value);

  if (Number.isFinite(numericValue) && numericValue > 0) {
    return Math.ceil(numericValue);
  }

  return estimateReadingMinutes(text);
}

function estimateReadingMinutes(text) {
  const words = String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  if (!words) {
    return 1;
  }

  return Math.max(1, Math.ceil(words / 220));
}

function normalizeTags(value) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value
      .map((tag) => String(tag || "").trim())
      .filter(Boolean)
      .filter((tag, index, tags) => tags.indexOf(tag) === index);
  }

  try {
    const parsed = JSON.parse(value);

    if (Array.isArray(parsed)) {
      return parsed
        .map((tag) => String(tag || "").trim())
        .filter(Boolean)
        .filter((tag, index, tags) => tags.indexOf(tag) === index);
    }
  } catch (error) {
    // Fall back to comma-separated values.
  }

  return String(value)
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .filter((tag, index, tags) => tags.indexOf(tag) === index);
}

function normalizeCategoryValue(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item, index, items) => items.indexOf(item) === index)
    .join(", ");
}

function normalizeSheetBoolean(value) {
  return value === true || value === "TRUE" || value === "true";
}

function toSheetBoolean(value) {
  return normalizeSheetBoolean(value) ? "TRUE" : "FALSE";
}

function normalizeMediaIds(value) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  try {
    const parsed = JSON.parse(value);

    if (Array.isArray(parsed)) {
      return parsed.filter(Boolean);
    }
  } catch (error) {
    // Fall back to comma-separated sheet values.
  }

  return String(value)
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

function upsertContentBodyDocument(input) {
  const docsFolder = resolveContentDocsFolder();
  const existingDocId = input.existingDocId || "";
  let document = null;
  let createdNewDocument = false;

  if (existingDocId) {
    try {
      document = DocumentApp.openById(existingDocId);
    } catch (error) {
      console.warn(`Unable to open existing Google Doc ${existingDocId}: ${error.message || error}`);
    }
  }

  if (!document) {
    document = DocumentApp.create(buildContentDocumentName(input.title, input.id));
    createdNewDocument = true;
  }

  const body = document.getBody();
  body.clear();
  body.appendParagraph(input.body || "");
  document.saveAndClose();

  const file = DriveApp.getFileById(document.getId());
  if (createdNewDocument) {
    ensureFileInFolder(file, docsFolder);
  }

  makeContentBodyDocumentPrivate(file);

  return {
    id: document.getId(),
    url: file.getUrl()
  };
}

function buildContentDocumentName(title, id) {
  const safeTitle = String(title || "Untitled Content").trim();
  return `${safeTitle} (${id})`;
}

function makeContentBodyDocumentPrivate(file) {
  if (!file) {
    return;
  }

  file.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
}

function ensureFileInFolder(file, folder) {
  if (!folder || !file) {
    return;
  }

  const parents = file.getParents();
  let existsInFolder = false;

  while (parents.hasNext()) {
    if (parents.next().getId() === folder.getId()) {
      existsInFolder = true;
      break;
    }
  }

  if (!existsInFolder) {
    folder.addFile(file);
  }
}

function readContentBody(docId) {
  if (!docId) {
    return "";
  }

  try {
    return DocumentApp.openById(docId).getBody().getText() || "";
  } catch (error) {
    console.warn(`Unable to read Google Doc ${docId}: ${error.message || error}`);
    return "";
  }
}

function createDriveFile(asset) {
  const uploadFolder = resolveMediaUploadFolder();
  const contentType = resolveUploadMimeType(asset);
  const bytes = decodeUploadBytes(asset.fileBase64);
  const fileName = asset.fileName || asset.name;
  const blob = Utilities.newBlob(bytes, contentType, fileName);
  const file = uploadFolder.createFile(blob);

  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return file;
}

function resolveUploadMimeType(asset) {
  const contentType = normalizeUploadMimeType(asset.mimeType || parseDataUrlMimeType(asset.fileBase64));

  if (!isAllowedUploadMimeType(contentType)) {
    throw createHttpError("Unsupported file type.", 400);
  }

  return contentType;
}

function parseDataUrlMimeType(value) {
  const match = String(value || "").match(/^data:([^;,]+)[;,]/i);
  return match && match[1] ? match[1] : "";
}

function normalizeUploadMimeType(value) {
  return String(value || "")
    .split(";")[0]
    .trim()
    .toLowerCase();
}

function isAllowedUploadMimeType(value) {
  const contentType = normalizeUploadMimeType(value);

  if (contentType.indexOf("image/") === 0 || contentType.indexOf("video/") === 0) {
    return true;
  }

  return ALLOWED_EXACT_UPLOAD_MIME_TYPES.indexOf(contentType) !== -1;
}

function decodeUploadBytes(fileBase64) {
  let bytes;

  try {
    bytes = Utilities.base64Decode(stripDataUrlPrefix(fileBase64));
  } catch (error) {
    throw createHttpError("Invalid file upload data.", 400);
  }

  validateUploadBytes(bytes);
  return bytes;
}

function validateUploadBytes(bytes) {
  if (!bytes || bytes.length > MAX_UPLOAD_BYTES) {
    throw createHttpError("File upload exceeds the 10 MB limit.", 413);
  }
}

function resolveMediaUploadFolder() {
  const folders = ensureFolders();
  return DriveApp.getFolderById(folders.driveFolderId);
}

function resolveContentDocsFolder() {
  const folders = ensureFolders();
  return DriveApp.getFolderById(folders.docsFolderId);
}

function stripDataUrlPrefix(value) {
  return String(value || "").replace(/^data:[^;]+;base64,/, "");
}

function extractDriveFileId(url) {
  if (!url) {
    return "";
  }

  const patterns = [/\/file\/d\/([^/]+)/, /[?&]id=([^&]+)/, /\/d\/([^/]+)/];

  for (let index = 0; index < patterns.length; index += 1) {
    const match = String(url).match(patterns[index]);

    if (match && match[1]) {
      return match[1];
    }
  }

  return "";
}

function buildPreviewUrl(fileId, type) {
  if (!fileId) {
    return "";
  }

  if (type === "image") {
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1200`;
  }

  return buildEmbedUrl(fileId);
}

function buildEmbedUrl(fileId) {
  return fileId ? `https://drive.google.com/file/d/${fileId}/preview` : "";
}

function formatBytes(size) {
  if (!size) {
    return "";
  }

  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
