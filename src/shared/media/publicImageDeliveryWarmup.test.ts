import { afterEach, describe, expect, it, vi } from "vitest";
import { prewarmPublicImageDeliveryVariants } from "./publicImageDeliveryWarmup";

const workerBaseUrl = "https://rcat-image-test.rcat-digital.workers.dev";
const driveFileId = "RCAT_media-2026_ABC123";
const driveFileUrl = `https://drive.google.com/file/d/${driveFileId}/view?usp=sharing`;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("prewarmPublicImageDeliveryVariants", () => {
  it("does nothing while the intent rollout is disabled", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(prewarmPublicImageDeliveryVariants(driveFileUrl, "portrait")).resolves.toEqual({
      attempted: 0,
      succeeded: 0,
      failed: 0
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("warms every responsive variant for an enabled intent", async () => {
    vi.stubEnv("VITE_PUBLIC_IMAGE_DELIVERY_BASE_URL", workerBaseUrl);
    vi.stubEnv("VITE_PUBLIC_IMAGE_DELIVERY_INTENTS", "portrait");
    const fetchMock = vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(prewarmPublicImageDeliveryVariants(driveFileUrl, "portrait")).resolves.toEqual({
      attempted: 4,
      succeeded: 4,
      failed: 0
    });

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      `${workerBaseUrl}/image/${driveFileId}?w=192`,
      `${workerBaseUrl}/image/${driveFileId}?w=256`,
      `${workerBaseUrl}/image/${driveFileId}?w=384`,
      `${workerBaseUrl}/image/${driveFileId}?w=512`
    ]);
  });

  it("reports partial warmup failures without throwing and blocking CMS saves", async () => {
    vi.stubEnv("VITE_PUBLIC_IMAGE_DELIVERY_BASE_URL", workerBaseUrl);
    vi.stubEnv("VITE_PUBLIC_IMAGE_DELIVERY_INTENTS", "portrait");
    let callCount = 0;
    const fetchMock = vi.fn(async () => {
      callCount += 1;
      return callCount === 2
        ? new Response("bad gateway", { status: 502 })
        : new Response(new Uint8Array([1]), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(prewarmPublicImageDeliveryVariants(driveFileUrl, "portrait")).resolves.toEqual({
      attempted: 4,
      succeeded: 3,
      failed: 1
    });
  });
});
