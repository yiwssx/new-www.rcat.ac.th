import { buildCloudflareAdminApiUrl } from "../../config/adminWriteProvider";
import type { CmsSnapshot } from "../../types";
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

async function requestCloudflareAdmin<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(buildCloudflareAdminApiUrl(path), {
    ...init,
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init.headers ?? {})
    }
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
