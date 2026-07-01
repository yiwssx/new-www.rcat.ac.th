import type { MediaAsset, MediaAssetInput } from "./types";

const mediaBridgePath = "/api/apps-script-proxy";

type MediaBridgeResource = "media" | "deleteMedia";
type MediaBridgeEnvelope<T> = T & {
  error?: string;
  statusCode?: number;
};

export interface MediaBridgeStatus {
  mode: "server-proxy";
  configured: boolean;
  appsScriptUrlConfigured: boolean;
  bridgeTokenConfigured: boolean;
}

export async function checkMediaBridgeStatus(): Promise<MediaBridgeStatus> {
  const response = await fetch(mediaBridgePath, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
    credentials: "same-origin"
  });
  const result = (await response.json()) as MediaBridgeStatus & { error?: string };

  if (!response.ok || result.error) {
    throw new Error(result.error || `Apps Script media bridge status failed with status ${response.status}`);
  }

  return result;
}

async function requestMediaBridge<T>(resource: MediaBridgeResource, payload: Record<string, unknown>): Promise<T> {
  const response = await fetch(mediaBridgePath, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      resource,
      payload
    }),
    cache: "no-store",
    credentials: "same-origin"
  });

  let result: MediaBridgeEnvelope<T>;

  try {
    result = (await response.json()) as MediaBridgeEnvelope<T>;
  } catch {
    throw new Error("Apps Script media bridge returned an invalid response");
  }

  if (!response.ok || result.error || (result.statusCode && result.statusCode >= 400)) {
    throw new Error(result.error || `Apps Script media bridge failed with status ${response.status}`);
  }

  return result;
}

export function uploadMediaAssetToBridge(asset: MediaAsset): Promise<MediaAsset> {
  return requestMediaBridge<MediaAsset>("media", asset as unknown as Record<string, unknown>);
}

export function saveMediaAssetToBridge(asset: MediaAssetInput): Promise<MediaAsset> {
  return requestMediaBridge<MediaAsset>("media", asset as unknown as Record<string, unknown>);
}

export function deleteMediaAssetFromBridge(id: string): Promise<{ id: string; deleted: boolean }> {
  return requestMediaBridge("deleteMedia", { id, deleteDriveFile: true });
}
