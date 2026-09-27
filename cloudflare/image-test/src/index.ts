const ALLOWED_WIDTHS = new Set([128, 160, 192, 240, 256, 320, 384, 480, 512, 640, 900, 1200, 1600]);

const DEFAULT_WIDTH = 900;
const FIXED_QUALITY = 82;
const SOURCE_CACHE_TTL_SECONDS = 604800;
const DRIVE_FILE_ID_PATTERN = /^[A-Za-z0-9_-]{10,128}$/;

function json(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  headers.set("access-control-allow-origin", "*");
  headers.set("timing-allow-origin", "*");

  return new Response(JSON.stringify(body, null, 2), {
    ...init,
    headers
  });
}

function resolveWidth(rawWidth: string | null): number | null {
  if (rawWidth === null || rawWidth === "") return DEFAULT_WIDTH;

  const width = Number(rawWidth);
  if (!Number.isInteger(width) || !ALLOWED_WIDTHS.has(width)) return null;
  return width;
}

function resolveFormat(accept: string | null): "avif" | "webp" | undefined {
  if (accept?.includes("image/avif")) return "avif";
  if (accept?.includes("image/webp")) return "webp";
  return undefined;
}

function withPublicImageHeaders(
  response: Response,
  width: number,
  sourceWidth: number,
  requestedFormat: string | undefined,
  durationMs: number
): Response {
  const headers = new Headers(response.headers);
  const actualContentType = String(headers.get("content-type") || "").split(";", 1)[0].trim().toLowerCase();
  const actualFormat = actualContentType.startsWith("image/") ? actualContentType.slice("image/".length) : "unknown";

  headers.set("cache-control", "public, max-age=604800, stale-while-revalidate=2592000");
  headers.set("access-control-allow-origin", "*");
  headers.set("timing-allow-origin", "*");
  headers.set("vary", "Accept");
  headers.set("x-rcat-image-test", "cloudflare-transform");
  headers.set("x-rcat-image-width", String(width));
  headers.set("x-rcat-image-source-width", String(sourceWidth));
  headers.set("x-rcat-image-format", actualFormat);
  headers.set("x-rcat-image-requested-format", requestedFormat ?? "source");
  headers.set("server-timing", `rcat_image;dur=${durationMs}`);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

async function handleImage(request: Request, fileId: string, url: URL): Promise<Response> {
  if (!DRIVE_FILE_ID_PATTERN.test(fileId)) {
    return json(
      {
        error: "invalid_drive_file_id",
        message: "The image test worker accepts only a Google Drive file ID."
      },
      { status: 400 }
    );
  }

  const width = resolveWidth(url.searchParams.get("w"));
  if (width === null) {
    return json(
      {
        error: "invalid_width",
        allowedWidths: [...ALLOWED_WIDTHS]
      },
      { status: 400 }
    );
  }

  const format = resolveFormat(request.headers.get("accept"));
  const imageOptions: Record<string, string | number> = {
    fit: "scale-down",
    width,
    quality: FIXED_QUALITY
  };
  if (format) imageOptions.format = format;

  const sourceWidth = width;
  const sourceUrl = new URL("https://drive.google.com/thumbnail");
  sourceUrl.searchParams.set("id", fileId);
  sourceUrl.searchParams.set("sz", `w${sourceWidth}`);

  const startedAt = Date.now();
  let upstream: Response;

  try {
    upstream = await fetch(sourceUrl.toString(), {
      cf: {
        image: imageOptions,
        cacheEverything: true,
        cacheTtl: SOURCE_CACHE_TTL_SECONDS
      }
    });
  } catch (error) {
    return json(
      {
        error: "image_transform_fetch_failed",
        message: error instanceof Error ? error.message : "Unknown transform error"
      },
      { status: 502 }
    );
  }

  if (!upstream.ok) {
    return json(
      {
        error: "image_transform_failed",
        upstreamStatus: upstream.status,
        upstreamStatusText: upstream.statusText
      },
      { status: 502 }
    );
  }

  return withPublicImageHeaders(upstream, width, sourceWidth, format, Date.now() - startedAt);
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method !== "GET" && request.method !== "HEAD") {
      return json({ error: "method_not_allowed" }, { status: 405, headers: { allow: "GET, HEAD" } });
    }

    if (url.pathname === "/" || url.pathname === "/health") {
      return json({
        service: "rcat-image-test",
        status: "ok",
        purpose: "isolated Google Drive to Cloudflare image-delivery experiment",
        sourceHost: "drive.google.com",
        sourceWidthPolicy: "match-target-width",
        sourceCacheTtlSeconds: SOURCE_CACHE_TTL_SECONDS,
        defaultWidth: DEFAULT_WIDTH,
        allowedWidths: [...ALLOWED_WIDTHS],
        quality: FIXED_QUALITY
      });
    }

    const match = /^\/image\/([^/]+)$/.exec(url.pathname);
    if (!match) {
      return json(
        {
          error: "not_found",
          usage: "/image/<google-drive-file-id>?w=900"
        },
        { status: 404 }
      );
    }

    return handleImage(request, match[1], url);
  }
};
