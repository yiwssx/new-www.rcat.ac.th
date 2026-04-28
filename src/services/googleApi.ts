import { getGoogleAppsScriptUrl, projectSettings } from "../config/projectSettings";
import {
  CalendarEvent,
  CmsSnapshot,
  ContentItem,
  DisplaySettings,
  IntegrationStatus,
  MediaAsset,
  MediaType,
  PublicMenuItem,
  Session,
  UserAccount
} from "../types";

const resources = projectSettings.api.resources;
const requestTimeoutMs = 20_000;

type GoogleResource = keyof typeof resources;
type GoogleApiActivitySubscriber = () => void;
type ApiEnvelope<T> = T & {
  error?: string;
  statusCode?: number;
};

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

export interface UserAccountInput {
  id?: string;
  name: string;
  email: string;
  role: UserAccount["role"];
  status: UserAccount["status"];
  password?: string;
  passwordHash?: string;
  avatarUrl?: string;
}

export interface CalendarEventInput {
  id?: string;
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
  previewUrl?: string;
  embedUrl?: string;
  fileName?: string;
  fileBase64?: string;
}

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

async function googleFetch<T>(
  resource: GoogleResource,
  init?: RequestInit,
  queryParams?: Record<string, string | undefined>
): Promise<T> {
  const url = new URL(assertAppScriptUrl());
  url.searchParams.set("resource", resources[resource]);
  const method = init?.method ?? "GET";
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), requestTimeoutMs);
  const endGoogleApiRequest = beginGoogleApiRequest();

  if (method.toUpperCase() === "GET") {
    url.searchParams.set("_ts", String(Date.now()));
  }

  if (queryParams) {
    Object.entries(queryParams).forEach(([key, value]) => {
      if (value) {
        url.searchParams.set(key, value);
      }
    });
  }

  const authToken = readStoredSessionToken();
  if (authToken && method.toUpperCase() === "GET" && resource !== "health") {
    url.searchParams.set("authToken", authToken);
  }

  try {
    const response = await fetch(url, {
      cache: "no-store",
      ...init,
      signal: controller.signal
    });

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
      throw new Error("Google Apps Script ตอบสนองช้าเกินไป กรุณาลองอีกครั้ง");
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
    endGoogleApiRequest();
  }
}

function postJson<T>(resource: GoogleResource, body: unknown) {
  const authToken = resource === "authLogin" ? "" : readStoredSessionToken();
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

export async function loginUserFromApi(email: string, password: string): Promise<Session> {
  return postJson<Session>("authLogin", {
    email,
    password
  });
}

export async function getCmsSnapshot(): Promise<CmsSnapshot> {
  const snapshot = await googleFetch<CmsSnapshot>("snapshot");

  if (typeof window !== "undefined" && snapshot.displaySettings) {
    window.localStorage.setItem(
      projectSettings.storageKeys.displaySettings || "rcat.cms.display.settings",
      JSON.stringify(snapshot.displaySettings)
    );
  }

  return snapshot;
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

export async function deleteContentItem(id: string): Promise<{ id: string; deleted: boolean }> {
  return postJson<{ id: string; deleted: boolean }>("deleteContent", { id });
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

export async function getUserAccountsFromApi(): Promise<UserAccount[]> {
  const response = await googleFetch<{ items: UserAccount[] }>("users");
  return response.items;
}

export async function saveUserAccountToApi(input: UserAccountInput): Promise<UserAccount> {
  return postJson<UserAccount>("users", input);
}

export async function deleteUserAccountFromApi(id: string): Promise<{ id: string; deleted: boolean }> {
  return postJson<{ id: string; deleted: boolean }>("deleteUser", { id });
}

export async function resetUserAccountsFromApi(): Promise<UserAccount[]> {
  const response = await postJson<{ items: UserAccount[] }>("resetUsers", {});
  return response.items;
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
