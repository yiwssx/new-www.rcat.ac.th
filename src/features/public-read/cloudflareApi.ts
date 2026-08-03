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
import type { ContentViewResponse, SiteViewInput } from "../site-view/types";
import type { VisitorStatsSettings } from "../visitor-stats";
import { isPublicReadNotFoundError, PublicReadError } from "./errors";
import { getPublicJson, type PublicReadRequestOptions } from "./request";

const PRESENCE_FAILURE_BACKOFF_MS = 5 * 60 * 1000;
let presenceBackoffUntil = 0;

export function isCloudflarePublicApiNotFoundError(error: unknown) {
  return isPublicReadNotFoundError(error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readErrorDetail(payload: unknown) {
  if (!isRecord(payload)) {
    return { error: "", diagnostic: "", suggestedMigration: "" };
  }

  return {
    error: typeof payload.error === "string" ? payload.error : "",
    diagnostic: typeof payload.diagnostic === "string" ? payload.diagnostic : "",
    suggestedMigration: typeof payload.suggestedMigration === "string" ? payload.suggestedMigration : ""
  };
}

function isVisitorPresenceUnavailable(error: unknown) {
  return (
    error instanceof PublicReadError &&
    (error.diagnostic === "visitor-presence-schema-missing-v1" ||
      /visitor[- ]presence[- ]schema[- ]missing|visitor presence schema/i.test(error.message))
  );
}

function warnPublicPresenceBackoff(error: unknown) {
  if (!import.meta.env.DEV) {
    return;
  }

  const detail = error instanceof PublicReadError && error.suggestedMigration ? ` ${error.suggestedMigration}` : "";
  console.warn(`Public presence tracking is temporarily disabled.${detail}`);
}

export function resetCloudflarePublicApiBackoffForTests() {
  presenceBackoffUntil = 0;
}

function persistDisplaySettings(displaySettings?: DisplaySettings) {
  if (typeof window !== "undefined" && displaySettings) {
    window.localStorage.setItem(
      projectSettings.storageKeys.displaySettings || "rcat.cms.display.settings",
      JSON.stringify(displaySettings)
    );
  }
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
    let payload: unknown = null;

    try {
      payload = await response.json();
    } catch {
      // Keep the generic HTTP status message below when the body is not JSON.
    }

    const detail = readErrorDetail(payload);
    throw new PublicReadError(detail.error || `Cloudflare ${resource} request failed with HTTP ${response.status}`, {
      kind: "http",
      resource,
      status: response.status,
      diagnostic: detail.diagnostic,
      suggestedMigration: detail.suggestedMigration
    });
  }

  return (await response.json()) as T;
}

function assertPublicSnapshot(value: Record<string, unknown>, resource: string, requiredArrays: string[]) {
  if (typeof value.generatedAt !== "string") {
    throw new PublicReadError(`Cloudflare ${resource} response is missing generatedAt`, {
      kind: "invalid-response",
      resource
    });
  }

  requiredArrays.forEach((key) => {
    if (!Array.isArray(value[key])) {
      throw new PublicReadError(`Cloudflare ${resource} response is missing ${key}`, {
        kind: "invalid-response",
        resource
      });
    }
  });
}

export async function getPublicHomeSnapshotFromCloudflare(
  options: PublicReadRequestOptions = {}
): Promise<PublicHomeSnapshot> {
  const payload = await getPublicJson("/api/public/home", "public-home", options);
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
  kind: PublicContentListKind,
  options: PublicReadRequestOptions = {}
): Promise<PublicContentListSnapshot> {
  const payload = await getPublicJson(
    `/api/public/content?kind=${encodeURIComponent(kind)}`,
    "content-list",
    options
  );
  assertPublicSnapshot(payload, "content-list", ["items", "media", "menu"]);

  if (payload.kind !== kind) {
    throw new PublicReadError("Cloudflare content-list response kind does not match the request", {
      kind: "invalid-response",
      resource: "content-list"
    });
  }

  persistDisplaySettings(payload.displaySettings as DisplaySettings | undefined);
  return payload as unknown as PublicContentListSnapshot;
}

export async function getContentDetailFromCloudflare(
  input: { id?: string; slug?: string },
  options: PublicReadRequestOptions = {}
): Promise<ContentItem> {
  const identifier = input.slug?.trim() || input.id?.trim();

  if (!identifier) {
    throw new PublicReadError("Cloudflare content-detail requires an id or slug", {
      kind: "invalid-response",
      resource: "content-detail"
    });
  }

  const payload = await getPublicJson(
    `/api/public/content/${encodeURIComponent(identifier)}`,
    "content-detail",
    options
  );

  if (!isRecord(payload.item)) {
    throw new PublicReadError("Cloudflare content-detail response is missing item", {
      kind: "invalid-response",
      resource: "content-detail"
    });
  }

  return payload.item as unknown as ContentItem;
}

export async function getPublicProgramListSnapshotFromCloudflare(
  options: PublicReadRequestOptions = {}
): Promise<PublicProgramListSnapshot> {
  const payload = await getPublicJson("/api/public/programs", "program", options);
  assertPublicSnapshot(payload, "program", ["items", "media", "menu"]);
  persistDisplaySettings(payload.displaySettings as DisplaySettings | undefined);
  return payload as unknown as PublicProgramListSnapshot;
}

export async function getPublicSearchIndexSnapshotFromCloudflare(
  options: PublicReadRequestOptions = {}
): Promise<PublicSearchIndexSnapshot> {
  const payload = await getPublicJson("/api/public/search", "search", options);
  assertPublicSnapshot(payload, "search", ["items", "menu"]);
  persistDisplaySettings(payload.displaySettings as DisplaySettings | undefined);
  return payload as unknown as PublicSearchIndexSnapshot;
}

export async function getVisitorStatsFromCloudflare(
  options: PublicReadRequestOptions = {}
): Promise<VisitorStatsSettings> {
  const payload = await getPublicJson("/api/public/visitor-stats", "visitor-stats", options);

  if (
    typeof payload.onlineUsers !== "number" ||
    typeof payload.usersToday !== "number" ||
    typeof payload.totalViews !== "number" ||
    typeof payload.updatedAt !== "string"
  ) {
    throw new PublicReadError("Cloudflare visitor-stats returned an invalid response", {
      kind: "invalid-response",
      resource: "visitor-stats"
    });
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
    if (Date.now() < presenceBackoffUntil) {
      return false;
    }

    void postCloudflareJson("/api/public/presence", "presence", input).catch((error) => {
      if (isVisitorPresenceUnavailable(error)) {
        presenceBackoffUntil = Date.now() + PRESENCE_FAILURE_BACKOFF_MS;
        warnPublicPresenceBackoff(error);
      }
    });
    return true;
  } catch {
    return false;
  }
}

export function recordContentViewToCloudflare(input: { id?: string; slug?: string }): Promise<ContentViewResponse> {
  return postCloudflareJson<ContentViewResponse>("/api/public/content-view", "content-view", input);
}
