import { buildCloudflarePublicApiUrl } from "../../config/publicApiProvider";
import { projectSettings } from "../../config/projectSettings";
import type {
  ContentItem,
  DisplaySettings,
  PublicContentListKind,
  PublicContentListSnapshot,
  PublicHomeSnapshot,
  PublicProgramListSnapshot,
  PublicSearchIndexSnapshot
} from "../../types";
import type { ContentViewResponse, SiteViewInput } from "../../services/googleApi";
import type { VisitorStatsSettings } from "../visitor-stats";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function persistDisplaySettings(displaySettings?: DisplaySettings) {
  if (typeof window !== "undefined" && displaySettings) {
    window.localStorage.setItem(
      projectSettings.storageKeys.displaySettings || "rcat.cms.display.settings",
      JSON.stringify(displaySettings)
    );
  }
}

async function getCloudflareJson(path: string, resource: string) {
  const response = await fetch(buildCloudflarePublicApiUrl(path), {
    method: "GET",
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Cloudflare ${resource} request failed with HTTP ${response.status}`);
  }

  let payload: unknown;

  try {
    payload = await response.json();
  } catch (error) {
    const invalidJsonError = new Error(`Cloudflare ${resource} returned invalid JSON`) as Error & {
      cause?: unknown;
    };
    invalidJsonError.cause = error;
    throw invalidJsonError;
  }

  if (!isRecord(payload)) {
    throw new Error(`Cloudflare ${resource} returned an invalid response`);
  }

  return payload;
}

async function postCloudflareJson<T>(path: string, resource: string, body: unknown): Promise<T> {
  const response = await fetch(buildCloudflarePublicApiUrl(path), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body),
    keepalive: true
  });

  if (!response.ok) {
    throw new Error(`Cloudflare ${resource} request failed with HTTP ${response.status}`);
  }

  return (await response.json()) as T;
}

function assertPublicSnapshot(value: Record<string, unknown>, resource: string, requiredArrays: string[]) {
  if (typeof value.generatedAt !== "string") {
    throw new Error(`Cloudflare ${resource} response is missing generatedAt`);
  }

  requiredArrays.forEach((key) => {
    if (!Array.isArray(value[key])) {
      throw new Error(`Cloudflare ${resource} response is missing ${key}`);
    }
  });
}

export async function getPublicHomeSnapshotFromCloudflare(): Promise<PublicHomeSnapshot> {
  const payload = await getCloudflareJson("/api/public/home", "public-home");
  assertPublicSnapshot(payload, "public-home", [
    "menu",
    "carouselSlides",
    "externalServices",
    "latestNews",
    "latestAnnouncements",
    "procurementItems",
    "jobOpportunityItems",
    "achievementItems",
    "programItems",
    "documentItems",
    "eventItems",
    "media"
  ]);
  persistDisplaySettings(payload.displaySettings as DisplaySettings | undefined);
  return payload as unknown as PublicHomeSnapshot;
}

export async function getPublicContentListSnapshotFromCloudflare(
  kind: PublicContentListKind
): Promise<PublicContentListSnapshot> {
  const payload = await getCloudflareJson(`/api/public/content?kind=${encodeURIComponent(kind)}`, "content-list");
  assertPublicSnapshot(payload, "content-list", ["items", "media", "menu"]);

  if (payload.kind !== kind) {
    throw new Error("Cloudflare content-list response kind does not match the request");
  }

  persistDisplaySettings(payload.displaySettings as DisplaySettings | undefined);
  return payload as unknown as PublicContentListSnapshot;
}

export async function getContentDetailFromCloudflare(input: { id?: string; slug?: string }): Promise<ContentItem> {
  const identifier = input.slug?.trim() || input.id?.trim();

  if (!identifier) {
    throw new Error("Cloudflare content-detail requires an id or slug");
  }

  const payload = await getCloudflareJson(`/api/public/content/${encodeURIComponent(identifier)}`, "content-detail");

  if (!isRecord(payload.item)) {
    throw new Error("Cloudflare content-detail response is missing item");
  }

  return payload.item as unknown as ContentItem;
}

export async function getPublicProgramListSnapshotFromCloudflare(): Promise<PublicProgramListSnapshot> {
  const payload = await getCloudflareJson("/api/public/programs", "program");
  assertPublicSnapshot(payload, "program", ["items", "media", "menu"]);
  persistDisplaySettings(payload.displaySettings as DisplaySettings | undefined);
  return payload as unknown as PublicProgramListSnapshot;
}

export async function getPublicSearchIndexSnapshotFromCloudflare(): Promise<PublicSearchIndexSnapshot> {
  const payload = await getCloudflareJson("/api/public/search", "search");
  assertPublicSnapshot(payload, "search", ["items", "menu"]);
  persistDisplaySettings(payload.displaySettings as DisplaySettings | undefined);
  return payload as unknown as PublicSearchIndexSnapshot;
}

export async function getVisitorStatsFromCloudflare(): Promise<VisitorStatsSettings> {
  const payload = await getCloudflareJson("/api/public/visitor-stats", "visitor-stats");

  if (
    typeof payload.onlineUsers !== "number" ||
    typeof payload.usersToday !== "number" ||
    typeof payload.totalViews !== "number" ||
    typeof payload.updatedAt !== "string"
  ) {
    throw new Error("Cloudflare visitor-stats returned an invalid response");
  }

  return payload as unknown as VisitorStatsSettings;
}

export function recordSiteViewToCloudflare(input: SiteViewInput): boolean {
  try {
    void postCloudflareJson("/api/public/site-view", "site-view", input).catch(() => undefined);
    return true;
  } catch {
    return false;
  }
}

export function recordPresenceToCloudflare(input: Pick<SiteViewInput, "visitorId" | "path">): boolean {
  try {
    void postCloudflareJson("/api/public/presence", "presence", input).catch(() => undefined);
    return true;
  } catch {
    return false;
  }
}

export function recordContentViewToCloudflare(input: { id?: string; slug?: string }): Promise<ContentViewResponse> {
  return postCloudflareJson<ContentViewResponse>("/api/public/content-view", "content-view", input);
}
