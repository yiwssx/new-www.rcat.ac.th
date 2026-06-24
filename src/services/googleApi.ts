import { getGoogleAppsScriptUrl, projectSettings } from "../config/projectSettings";
import {
  CalendarEvent,
  CarouselSlide,
  CmsSnapshot,
  ContentItem,
  DisplaySettings,
  ExternalServiceLink,
  HomepageSettings,
  IntegrationStatus,
  MediaAsset,
  MediaType,
  CmsDocumentItem,
  PublicContentListKind,
  PublicContentListSnapshot,
  PublicDocumentListSnapshot,
  PublicHomeSnapshot,
  PublicMenuItem,
  PublicProgramListSnapshot,
  PublicSearchIndexSnapshot,
  Session,
  SiteSettings,
  VisitorStatsSettings
} from "../types";

const resources = projectSettings.api.resources;
const requestTimeoutMs = 20_000;

type GoogleResource = keyof typeof resources;
type GoogleApiActivitySubscriber = () => void;
type ApiEnvelope<T> = T & {
  error?: string;
  statusCode?: number;
};

const cacheFriendlyPublicGetResources = new Set<GoogleResource>([
  "snapshot",
  "publicHome",
  "publicContentList",
  "publicDocumentList",
  "publicProgramList",
  "publicSearchIndex",
  "menu",
  "displaySettings",
  "contentDetail"
]);
const unauthenticatedPostResources = new Set<GoogleResource>(["contentView", "siteView"]);

let activeGoogleApiRequestCount = 0;
const googleApiActivitySubscribers = new Set<GoogleApiActivitySubscriber>();

interface HealthResponse {
  ok: boolean;
  hasSpreadsheet: boolean;
  hasDriveFolder: boolean;
  hasDocsFolder: boolean;
  timestamp: string;
}

function notifyGoogleApiActivitySubscribers() {
  googleApiActivitySubscribers.forEach((subscriber) => {
    subscriber();
  });
}

function beginGoogleApiRequest() {
  activeGoogleApiRequestCount += 1;
  notifyGoogleApiActivitySubscribers();

  let ended = false;
  return () => {
    if (ended) {
      return;
    }

    ended = true;
    activeGoogleApiRequestCount = Math.max(0, activeGoogleApiRequestCount - 1);
    notifyGoogleApiActivitySubscribers();
  };
}

export function getGoogleApiActivityCount() {
  return activeGoogleApiRequestCount;
}

export function subscribeGoogleApiActivity(subscriber: GoogleApiActivitySubscriber) {
  googleApiActivitySubscribers.add(subscriber);

  return () => {
    googleApiActivitySubscribers.delete(subscriber);
  };
}

export interface CalendarEventInput {
  id?: string;
  revision?: number;
  title: string;
  date: string;
  endDate?: string;
  audience: string;
  status: CalendarEvent["status"];
  location?: string;
  description?: string;
  category?: string;
  visibility?: CalendarEvent["visibility"];
}

export interface MediaAssetInput {
  id?: string;
  name: string;
  type: MediaType;
  size?: string;
  owner: string;
  driveUrl?: string;
  fileId?: string;
  mimeType?: string;
  thumbnailUrl?: string;
  previewUrl?: string;
  embedUrl?: string;
  fileName?: string;
  fileBase64?: string;
}

export type CarouselSlideInput = Partial<CarouselSlide>;
export type ExternalServiceLinkInput = Partial<ExternalServiceLink>;
export type DocumentItemInput = Partial<CmsDocumentItem>;

function assertAppScriptUrl() {
  const appScriptUrl = getGoogleAppsScriptUrl();

  if (!appScriptUrl) {
    throw new Error(`ยังไม่ได้ตั้งค่า ${projectSettings.api.googleAppsScriptUrlEnv}`);
  }

  return appScriptUrl;
}

function readStoredSessionToken() {
  if (typeof window === "undefined") {
    return "";
  }

  try {
    const raw = window.localStorage.getItem(projectSettings.storageKeys.session);
    if (!raw) {
      return "";
    }

    const parsed = JSON.parse(raw) as Session;
    if (!parsed?.token || !parsed?.expiresAt) {
      return "";
    }

    const expiresAtMs = Date.parse(parsed.expiresAt);
    if (Number.isNaN(expiresAtMs) || expiresAtMs <= Date.now()) {
      window.localStorage.removeItem(projectSettings.storageKeys.session);
      return "";
    }

    return parsed.token;
  } catch {
    return "";
  }
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function createErrorWithCause(message: string, cause: unknown) {
  const error = new Error(message) as Error & { cause?: unknown };
  error.cause = cause;
  return error;
}

async function googleFetch<T>(
  resource: GoogleResource,
  init?: RequestInit,
  queryParams?: Record<string, string | undefined>
): Promise<T> {
  const url = new URL(assertAppScriptUrl());
  url.searchParams.set("resource", resources[resource]);
  const method = init?.method ?? "GET";
  const normalizedMethod = method.toUpperCase();
  const isCacheFriendlyPublicGet = normalizedMethod === "GET" && cacheFriendlyPublicGetResources.has(resource);
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), requestTimeoutMs);
  const endGoogleApiRequest = beginGoogleApiRequest();

  if (normalizedMethod === "GET" && !isCacheFriendlyPublicGet) {
    url.searchParams.set("_ts", String(Date.now()));
  }

  if (queryParams) {
    Object.entries(queryParams).forEach(([key, value]) => {
      if (value) {
        url.searchParams.set(key, value);
      }
    });
  }

  try {
    const requestInit: RequestInit = {
      ...init,
      signal: controller.signal
    };

    if (!isCacheFriendlyPublicGet) {
      requestInit.cache = "no-store";
    }

    const response = await fetch(url, requestInit);

    if (!response.ok) {
      throw new Error(`คำขอ Google API ล้มเหลวด้วยสถานะ ${response.status}`);
    }

    const data = (await response.json()) as ApiEnvelope<T>;

    if (data.error || (data.statusCode && data.statusCode >= 400)) {
      throw new Error(data.error ?? `คำขอ Google API ล้มเหลวด้วยสถานะ ${data.statusCode}`);
    }

    return data;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw createErrorWithCause("Google Apps Script ตอบสนองช้าเกินไป กรุณาลองอีกครั้ง", error);
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
    endGoogleApiRequest();
  }
}

function postJson<T>(resource: GoogleResource, body: unknown) {
  const authToken = unauthenticatedPostResources.has(resource) ? "" : readStoredSessionToken();
  const payload = isObjectRecord(body)
    ? {
        ...body,
        ...(authToken ? { authToken } : {})
      }
    : body;

  return googleFetch<T>(resource, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify(payload)
  });
}

export async function getCmsSnapshot(): Promise<CmsSnapshot> {
  const snapshot = await googleFetch<CmsSnapshot>("snapshot");

  persistSnapshotDisplaySettings(snapshot);
  return snapshot;
}

export async function getPublicHomeSnapshot(): Promise<PublicHomeSnapshot> {
  const snapshot = await googleFetch<PublicHomeSnapshot>("publicHome");

  persistDisplaySettings(snapshot.displaySettings);
  return snapshot;
}

export async function getPublicContentListSnapshot(kind: PublicContentListKind): Promise<PublicContentListSnapshot> {
  const snapshot = await googleFetch<PublicContentListSnapshot>("publicContentList", undefined, {
    kind
  });

  persistDisplaySettings(snapshot.displaySettings);
  return snapshot;
}

export async function getPublicDocumentList(): Promise<PublicDocumentListSnapshot> {
  return googleFetch<PublicDocumentListSnapshot>("publicDocumentList");
}

export async function getPublicProgramListSnapshot(): Promise<PublicProgramListSnapshot> {
  const snapshot = await googleFetch<PublicProgramListSnapshot>("publicProgramList");

  persistDisplaySettings(snapshot.displaySettings);
  return snapshot;
}

export async function getPublicSearchIndexSnapshot(): Promise<PublicSearchIndexSnapshot> {
  const snapshot = await googleFetch<PublicSearchIndexSnapshot>("publicSearchIndex");

  persistDisplaySettings(snapshot.displaySettings);
  return snapshot;
}

export async function getAdminCmsSnapshot(): Promise<CmsSnapshot> {
  const snapshot = await postJson<CmsSnapshot>("adminSnapshot", {});

  persistSnapshotDisplaySettings(snapshot);
  return snapshot;
}

function persistDisplaySettings(displaySettings?: DisplaySettings) {
  if (typeof window !== "undefined" && displaySettings) {
    window.localStorage.setItem(
      projectSettings.storageKeys.displaySettings || "rcat.cms.display.settings",
      JSON.stringify(displaySettings)
    );
  }
}

function persistSnapshotDisplaySettings(snapshot: Pick<CmsSnapshot, "displaySettings">) {
  persistDisplaySettings(snapshot.displaySettings);
}

export async function saveContentItem(item: ContentItem): Promise<ContentItem> {
  return postJson<ContentItem>("content", item);
}

export async function getContentDetail(input: { id?: string; slug?: string }): Promise<ContentItem> {
  return googleFetch<ContentItem>("contentDetail", undefined, {
    id: input.id,
    slug: input.slug
  });
}

export interface ContentViewResponse {
  id: string;
  slug: string;
  viewCount: number;
  lastViewedAt: string;
}

export async function recordContentView(input: { id?: string; slug?: string }): Promise<ContentViewResponse> {
  return postJson<ContentViewResponse>("contentView", input);
}

export interface SiteViewInput {
  visitorId: string;
  path: string;
  timestamp: string;
  referrerOrigin?: string;
  pageTitle?: string;
}

export function recordSiteView(input: SiteViewInput): boolean {
  try {
    const url = new URL(assertAppScriptUrl());
    const body = JSON.stringify(input);

    url.searchParams.set("resource", resources.siteView);

    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function" && typeof Blob !== "undefined") {
      const payload = new Blob([body], {
        type: "text/plain;charset=utf-8"
      });

      if (navigator.sendBeacon(url.toString(), payload)) {
        return true;
      }
    }

    if (typeof fetch !== "function") {
      return false;
    }

    void fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body,
      keepalive: true,
      cache: "no-store"
    }).catch(() => undefined);

    return true;
  } catch {
    return false;
  }
}

export async function getAdminContentDetail(input: { id?: string; slug?: string }): Promise<ContentItem> {
  return postJson<ContentItem>("adminContentDetail", input);
}

export async function deleteContentItem(id: string): Promise<{ id: string; deleted: boolean }> {
  return postJson<{ id: string; deleted: boolean }>("deleteContent", { id });
}

export async function saveDocumentToApi(document: DocumentItemInput): Promise<CmsDocumentItem> {
  return postJson<CmsDocumentItem>("document", document);
}

export async function deleteDocumentFromApi(id: string): Promise<{ id: string; deleted: boolean }> {
  return postJson<{ id: string; deleted: boolean }>("deleteDocument", { id });
}

export async function saveCarouselSlideToApi(slide: CarouselSlideInput): Promise<CarouselSlide> {
  return postJson<CarouselSlide>("carousel", slide);
}

export async function deleteCarouselSlideFromApi(id: string): Promise<{ id: string; deleted: boolean }> {
  return postJson<{ id: string; deleted: boolean }>("deleteCarousel", { id });
}

export async function saveExternalServiceLinkToApi(service: ExternalServiceLinkInput): Promise<ExternalServiceLink> {
  return postJson<ExternalServiceLink>("externalService", service);
}

export async function deleteExternalServiceLinkFromApi(id: string): Promise<{ id: string; deleted: boolean }> {
  return postJson<{ id: string; deleted: boolean }>("deleteExternalService", { id });
}

export async function getPublicMenuItems(): Promise<PublicMenuItem[]> {
  const response = await googleFetch<{ items: PublicMenuItem[] }>("menu");
  return response.items;
}

export async function savePublicMenuItems(items: PublicMenuItem[]): Promise<PublicMenuItem[]> {
  const response = await postJson<{ items: PublicMenuItem[] }>("menu", { items });
  return response.items;
}

export async function uploadMediaAsset(asset: MediaAsset): Promise<MediaAsset> {
  return postJson<MediaAsset>("media", asset);
}

export async function saveMediaAsset(asset: MediaAssetInput): Promise<MediaAsset> {
  return postJson<MediaAsset>("media", asset);
}

export async function deleteMediaAsset(id: string): Promise<{ id: string; deleted: boolean }> {
  return postJson<{ id: string; deleted: boolean }>("deleteMedia", { id, deleteDriveFile: true });
}

export async function publishContent(id: string): Promise<{ id: string; published: boolean }> {
  return postJson<{ id: string; published: boolean }>("publish", { id });
}

export async function saveCalendarEvent(input: CalendarEventInput): Promise<CalendarEvent> {
  return postJson<CalendarEvent>("event", input);
}

export async function deleteCalendarEvent(id: string): Promise<{ id: string; deleted: boolean }> {
  return postJson<{ id: string; deleted: boolean }>("deleteEvent", { id });
}

export async function getDisplaySettingsFromApi(): Promise<DisplaySettings> {
  return googleFetch<DisplaySettings>("displaySettings");
}

export async function saveDisplaySettingsToApi(settings: Partial<DisplaySettings>): Promise<DisplaySettings> {
  return postJson<DisplaySettings>("displaySettings", settings);
}

export async function saveSiteSettingsToApi(settings: Partial<SiteSettings>): Promise<SiteSettings> {
  return postJson<SiteSettings>("siteSettings", settings);
}

export async function saveHomepageSettingsToApi(settings: Partial<HomepageSettings>): Promise<HomepageSettings> {
  return postJson<HomepageSettings>("homepageSettings", settings);
}

export async function saveVisitorStatsToApi(stats: Partial<VisitorStatsSettings>): Promise<VisitorStatsSettings> {
  return postJson<VisitorStatsSettings>("visitorStats", stats);
}

export async function checkGoogleConnection(): Promise<IntegrationStatus[]> {
  const health = await googleFetch<HealthResponse>("health");
  const lastSync = health.timestamp;

  return [
    {
      service: "Sheets",
      status: health.ok && health.hasSpreadsheet ? "connected" : "error",
      detail: health.hasSpreadsheet ? "ตั้งค่า Spreadsheet แล้ว" : "ยังไม่ได้เชื่อมต่อ Spreadsheet",
      lastSync
    },
    {
      service: "Drive",
      status: health.hasDriveFolder ? "connected" : "pending",
      detail: health.hasDriveFolder ? "ตั้งค่าโฟลเดอร์ Drive แล้ว" : "ยังไม่ได้ตั้งค่าโฟลเดอร์ Drive",
      lastSync: health.hasDriveFolder ? lastSync : "Not connected"
    },
    {
      service: "Docs",
      status: health.hasDocsFolder ? "connected" : "pending",
      detail: health.hasDocsFolder ? "ตั้งค่าโฟลเดอร์ Docs แล้ว" : "ยังไม่ได้ตั้งค่าโฟลเดอร์ Docs",
      lastSync: health.hasDocsFolder ? lastSync : "Not connected"
    }
  ];
}
