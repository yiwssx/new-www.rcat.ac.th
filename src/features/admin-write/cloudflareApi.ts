import { buildCloudflareAdminApiUrl } from "../../config/adminWriteProvider";
import type {
  CalendarEvent,
  CarouselSlide,
  CmsSnapshot,
  DisplaySettings,
  ExternalServiceLink,
  HomepageSettings,
  PublicMenuItem,
  SiteSettings
} from "../../types";
import type { CalendarEventInput, CarouselSlideInput, ExternalServiceLinkInput } from "../../services/googleApi";
import type { CmsDocumentItem } from "../cms-documents/types";
import type { ContentItem } from "../public-content/types";

interface ItemEnvelope<T> {
  item: T;
}

function createCloudflareAdminError(message: string, cause: unknown) {
  const error = new Error(message) as Error & { cause?: unknown };
  error.cause = cause;
  return error;
}

function getCloudflareAdminHeaders(init: RequestInit) {
  const headers = new Headers(init.headers);

  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  if (init.body !== undefined && init.body !== null && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return Object.fromEntries(headers.entries());
}

async function requestCloudflareAdmin<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(buildCloudflareAdminApiUrl(path), {
    ...init,
    credentials: "include",
    headers: getCloudflareAdminHeaders(init)
  });

  let payload: unknown;

  try {
    payload = await response.json();
  } catch (error) {
    throw createCloudflareAdminError("Cloudflare admin API returned invalid JSON", error);
  }

  if (!response.ok) {
    const errorMessage =
      payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : `Cloudflare admin API request failed with status ${response.status}`;
    throw new Error(errorMessage);
  }

  return payload as T;
}

function writeJson<T>(path: string, method: "POST" | "PATCH" | "PUT", body: unknown): Promise<T> {
  return requestCloudflareAdmin<T>(path, {
    method,
    body: JSON.stringify(body)
  });
}

export async function getAdminCmsSnapshotFromCloudflare(): Promise<CmsSnapshot> {
  return requestCloudflareAdmin<CmsSnapshot>("/api/admin/snapshot");
}

export async function getAdminContentDetailFromCloudflare(input: { id?: string; slug?: string }): Promise<ContentItem> {
  const identifier = encodeURIComponent(input.id || input.slug || "");

  if (!identifier) {
    throw new Error("Content id or slug is required");
  }

  const response = await requestCloudflareAdmin<ItemEnvelope<ContentItem>>(`/api/admin/content/${identifier}`);

  return response.item;
}

export async function saveContentItemToCloudflare(item: ContentItem): Promise<ContentItem> {
  const response = await writeJson<ItemEnvelope<ContentItem>>("/api/admin/content", "POST", item);

  return response.item;
}

export async function deleteContentItemFromCloudflare(id: string): Promise<{ id: string; deleted: boolean }> {
  return requestCloudflareAdmin<{ id: string; deleted: boolean }>(`/api/admin/content/${encodeURIComponent(id)}`, {
    method: "DELETE"
  });
}

export async function publishContentFromCloudflare(id: string): Promise<{ id: string; published: boolean }> {
  return writeJson<{ id: string; published: boolean }>(
    `/api/admin/content/${encodeURIComponent(id)}/publish`,
    "POST",
    {}
  );
}

export async function saveDocumentToCloudflare(document: Partial<CmsDocumentItem>): Promise<CmsDocumentItem> {
  const response = await writeJson<ItemEnvelope<CmsDocumentItem>>("/api/admin/documents", "POST", document);

  return response.item;
}

export async function deleteDocumentFromCloudflare(id: string): Promise<{ id: string; deleted: boolean }> {
  return requestCloudflareAdmin<{ id: string; deleted: boolean }>(`/api/admin/documents/${encodeURIComponent(id)}`, {
    method: "DELETE"
  });
}

export function getDisplaySettingsFromCloudflare(): Promise<DisplaySettings> {
  return requestCloudflareAdmin<DisplaySettings>("/api/admin/settings/display");
}

export function saveDisplaySettingsToCloudflare(settings: Partial<DisplaySettings>): Promise<DisplaySettings> {
  return writeJson<DisplaySettings>("/api/admin/settings/display", "PUT", settings);
}

export function saveSiteSettingsToCloudflare(settings: Partial<SiteSettings>): Promise<SiteSettings> {
  return writeJson<SiteSettings>("/api/admin/settings/site", "PUT", settings);
}

export function saveHomepageSettingsToCloudflare(settings: Partial<HomepageSettings>): Promise<HomepageSettings> {
  return writeJson<HomepageSettings>("/api/admin/settings/homepage", "PUT", settings);
}

export async function getPublicMenuItemsFromCloudflare(): Promise<PublicMenuItem[]> {
  const response = await requestCloudflareAdmin<{ items: PublicMenuItem[] }>("/api/admin/menu");
  return response.items;
}

export async function savePublicMenuItemsToCloudflare(items: PublicMenuItem[]): Promise<PublicMenuItem[]> {
  const response = await writeJson<{ items: PublicMenuItem[] }>("/api/admin/menu", "PUT", { items });
  return response.items;
}

export async function saveCarouselSlideToCloudflare(input: CarouselSlideInput): Promise<CarouselSlide> {
  const response = await writeJson<ItemEnvelope<CarouselSlide>>("/api/admin/carousel", "POST", input);
  return response.item;
}

export function deleteCarouselSlideFromCloudflare(id: string): Promise<{ id: string; deleted: boolean }> {
  return requestCloudflareAdmin(`/api/admin/carousel/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function saveExternalServiceLinkToCloudflare(
  input: ExternalServiceLinkInput
): Promise<ExternalServiceLink> {
  const response = await writeJson<ItemEnvelope<ExternalServiceLink>>("/api/admin/external-services", "POST", input);
  return response.item;
}

export function deleteExternalServiceLinkFromCloudflare(id: string): Promise<{ id: string; deleted: boolean }> {
  return requestCloudflareAdmin(`/api/admin/external-services/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function saveCalendarEventToCloudflare(input: CalendarEventInput): Promise<CalendarEvent> {
  const response = await writeJson<ItemEnvelope<CalendarEvent>>("/api/admin/events", "POST", input);
  return response.item;
}

export function deleteCalendarEventFromCloudflare(id: string): Promise<{ id: string; deleted: boolean }> {
  return requestCloudflareAdmin(`/api/admin/events/${encodeURIComponent(id)}`, { method: "DELETE" });
}
