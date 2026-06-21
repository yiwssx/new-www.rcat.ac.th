import { buildCloudflareAdminApiUrl } from "../../config/adminWriteProvider";
import type {
  CalendarEvent,
  CarouselSlide,
  CmsSnapshot,
  DisplaySettings,
  ExternalServiceLink,
  HomepageSettings,
  MediaAsset,
  PublicMenuItem,
  SiteSettings
} from "../../types";
import type { CalendarEventInput, CarouselSlideInput, ExternalServiceLinkInput } from "../../services/googleApi";
import type { CmsDocumentItem } from "../cms-documents/types";
import type { ContentItem } from "../public-content/types";
import { mergeBridgeMediaAssets } from "../cms-media/bridgeCache";
import { ADMIN_PROXY_SESSION_EXPIRED_MESSAGE, notifyAdminProxySessionExpired } from "../../services/adminProxySession";

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
    if (response.status === 401 && /admin proxy session is (?:required|invalid or expired)/i.test(errorMessage)) {
      notifyAdminProxySessionExpired();
      throw new Error(ADMIN_PROXY_SESSION_EXPIRED_MESSAGE);
    }

    throw new Error(errorMessage);
  }

  return payload as T;
}

function writeJson<T>(
  path: string,
  method: "POST" | "PATCH" | "PUT",
  body: unknown,
  headers?: HeadersInit
): Promise<T> {
  return requestCloudflareAdmin<T>(path, {
    method,
    headers,
    body: JSON.stringify(body)
  });
}

function getRevisionHeaders(revision: unknown) {
  return Number.isInteger(revision) && Number(revision) >= 0 ? { "If-Match": `"${revision}"` } : undefined;
}

function getEntityIdentity(input: { id?: string; revision?: number }) {
  const { id, revision, ...body } = input;
  return { id: id?.trim() || "", revision, body };
}

export async function getAdminCmsSnapshotFromCloudflare(): Promise<CmsSnapshot> {
  const snapshot = await requestCloudflareAdmin<CmsSnapshot>("/api/admin/snapshot");
  return {
    ...snapshot,
    media: mergeBridgeMediaAssets(snapshot.media ?? [])
  };
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
  const { id, revision, body } = getEntityIdentity(item);
  const response =
    id && revision !== undefined
      ? await writeJson<ItemEnvelope<ContentItem>>(
          `/api/admin/content/${encodeURIComponent(id)}`,
          "PATCH",
          body,
          getRevisionHeaders(revision)
        )
      : await writeJson<ItemEnvelope<ContentItem>>("/api/admin/content", "POST", body);

  return response.item;
}

export async function deleteContentItemFromCloudflare(
  input: string | Pick<ContentItem, "id" | "revision">
): Promise<{ id: string; deleted: boolean }> {
  const id = typeof input === "string" ? input : input.id;
  const revision = typeof input === "string" ? undefined : input.revision;
  return requestCloudflareAdmin<{ id: string; deleted: boolean }>(`/api/admin/content/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: getRevisionHeaders(revision)
  });
}

export async function publishContentFromCloudflare(
  input: string | Pick<ContentItem, "id" | "revision">
): Promise<{ id: string; published: boolean }> {
  const id = typeof input === "string" ? input : input.id;
  const revision = typeof input === "string" ? undefined : input.revision;
  return writeJson<{ id: string; published: boolean }>(
    `/api/admin/content/${encodeURIComponent(id)}/publish`,
    "POST",
    {},
    getRevisionHeaders(revision)
  );
}

export async function saveDocumentToCloudflare(document: Partial<CmsDocumentItem>): Promise<CmsDocumentItem> {
  const { id, revision, body } = getEntityIdentity(document);
  const response =
    id && revision !== undefined
      ? await writeJson<ItemEnvelope<CmsDocumentItem>>(
          `/api/admin/documents/${encodeURIComponent(id)}`,
          "PATCH",
          body,
          getRevisionHeaders(revision)
        )
      : await writeJson<ItemEnvelope<CmsDocumentItem>>("/api/admin/documents", "POST", body);

  return response.item;
}

export async function saveMediaMetadataToCloudflare(asset: MediaAsset): Promise<MediaAsset> {
  const response = await writeJson<ItemEnvelope<MediaAsset>>("/api/admin/media", "POST", asset);
  return response.item;
}

export function deleteMediaMetadataFromCloudflare(id: string): Promise<{ id: string; deleted: boolean }> {
  return requestCloudflareAdmin(`/api/admin/media/${encodeURIComponent(id)}`, { method: "DELETE" });
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
  const { id, revision, body } = getEntityIdentity(input);
  const response =
    id && revision !== undefined
      ? await writeJson<ItemEnvelope<CarouselSlide>>(
          `/api/admin/carousel/${encodeURIComponent(id)}`,
          "PATCH",
          body,
          getRevisionHeaders(revision)
        )
      : await writeJson<ItemEnvelope<CarouselSlide>>("/api/admin/carousel", "POST", body);
  return response.item;
}

export function deleteCarouselSlideFromCloudflare(id: string): Promise<{ id: string; deleted: boolean }> {
  return requestCloudflareAdmin(`/api/admin/carousel/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function saveExternalServiceLinkToCloudflare(
  input: ExternalServiceLinkInput
): Promise<ExternalServiceLink> {
  const { id, revision, body } = getEntityIdentity(input);
  const response =
    id && revision !== undefined
      ? await writeJson<ItemEnvelope<ExternalServiceLink>>(
          `/api/admin/external-services/${encodeURIComponent(id)}`,
          "PATCH",
          body,
          getRevisionHeaders(revision)
        )
      : await writeJson<ItemEnvelope<ExternalServiceLink>>("/api/admin/external-services", "POST", body);
  return response.item;
}

export function deleteExternalServiceLinkFromCloudflare(id: string): Promise<{ id: string; deleted: boolean }> {
  return requestCloudflareAdmin(`/api/admin/external-services/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function saveCalendarEventToCloudflare(input: CalendarEventInput): Promise<CalendarEvent> {
  const { id, revision, body } = getEntityIdentity(input);
  const response =
    id && revision !== undefined
      ? await writeJson<ItemEnvelope<CalendarEvent>>(
          `/api/admin/events/${encodeURIComponent(id)}`,
          "PATCH",
          body,
          getRevisionHeaders(revision)
        )
      : await writeJson<ItemEnvelope<CalendarEvent>>("/api/admin/events", "POST", body);
  return response.item;
}

export function deleteCalendarEventFromCloudflare(id: string): Promise<{ id: string; deleted: boolean }> {
  return requestCloudflareAdmin(`/api/admin/events/${encodeURIComponent(id)}`, { method: "DELETE" });
}
