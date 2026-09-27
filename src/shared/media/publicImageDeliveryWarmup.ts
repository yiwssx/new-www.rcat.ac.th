import {
  getPublicImageDeliveryVariantUrls,
  type PublicImageAssetSource,
  type PublicImageIntent
} from "./publicImageSources";

export interface PublicImageWarmupResult {
  attempted: number;
  succeeded: number;
  failed: number;
}

export async function prewarmPublicImageDeliveryVariants(
  source: string | PublicImageAssetSource | null | undefined,
  intent: PublicImageIntent
): Promise<PublicImageWarmupResult> {
  const urls = getPublicImageDeliveryVariantUrls(source, intent);

  if (!urls.length || typeof fetch !== "function") {
    return { attempted: 0, succeeded: 0, failed: 0 };
  }

  const results = await Promise.allSettled(
    urls.map(async (url) => {
      const response = await fetch(url, {
        method: "GET",
        cache: "reload",
        headers: {
          Accept: "image/avif,image/webp,image/*,*/*;q=0.8"
        }
      });

      if (!response.ok) {
        throw new Error(`Image warmup failed with status ${response.status}`);
      }

      await response.arrayBuffer();
    })
  );

  const succeeded = results.filter((result) => result.status === "fulfilled").length;

  return {
    attempted: urls.length,
    succeeded,
    failed: urls.length - succeeded
  };
}
