const DEFAULT_PUBLIC_API_URL = "https://rcat-public-api-preview.rcat-digital.workers.dev";
const DEFAULT_IMAGE_TEST_WORKER_URL = "https://rcat-image-test.rcat-digital.workers.dev";
const SAMPLE_COUNT = 5;
const IMAGE_ACCEPT = "image/avif,image/webp,image/*,*/*;q=0.8";

const publicApiUrl = (process.env.PRODUCTION_PUBLIC_API_URL || DEFAULT_PUBLIC_API_URL).replace(/\/+$/, "");
const imageTestWorkerUrl = (process.env.IMAGE_TEST_WORKER_URL || DEFAULT_IMAGE_TEST_WORKER_URL).replace(/\/+$/, "");

function round(value) {
  return Math.round(value * 10) / 10;
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function percentDelta(current, baseline) {
  if (!Number.isFinite(current) || !Number.isFinite(baseline) || baseline === 0) return null;
  return ((current - baseline) / baseline) * 100;
}

function formatDelta(value) {
  if (value === null) return "n/a";
  const rounded = round(value);
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
}

function extractDriveFileId(value) {
  if (typeof value !== "string" || !value.trim()) return "";

  try {
    const url = new URL(value);
    const queryId = url.searchParams.get("id");
    if (queryId) return queryId;

    const pathMatch = url.pathname.match(/\/(?:file\/)?d\/([A-Za-z0-9_-]{10,128})(?:\/|$)/);
    return pathMatch?.[1] || "";
  } catch {
    return "";
  }
}

function isActiveSlide(slide, now) {
  if (!slide || slide.enabled === false || !slide.imageUrl) return false;
  if (slide.startAt && Date.parse(slide.startAt) > now) return false;
  if (slide.endAt && Date.parse(slide.endAt) < now) return false;
  return true;
}

function selectCandidates(snapshot) {
  const candidates = [];
  const now = Date.now();
  const introGate = snapshot.homepageSettings?.introGate;
  const siteSettings = snapshot.siteSettings || {};
  const carouselSlide = [...(snapshot.carouselSlides || [])]
    .filter((slide) => isActiveSlide(slide, now))
    .sort((a, b) => (a.order || 0) - (b.order || 0))[0];

  if (introGate?.enabled && introGate.imageUrl) {
    candidates.push({ label: "Intro Gate", width: 1600, sourceUrl: introGate.imageUrl });
  }
  if (carouselSlide?.imageUrl) {
    candidates.push({ label: "Carousel first active", width: 1600, sourceUrl: carouselSlide.imageUrl });
  }
  if (siteSettings.directorImageUrl) {
    candidates.push({ label: "Director portrait", width: 384, sourceUrl: siteSettings.directorImageUrl });
  }
  if (siteSettings.heroImageUrl) {
    candidates.push({ label: "Hero", width: 900, sourceUrl: siteSettings.heroImageUrl });
  }

  return candidates
    .map((candidate) => ({ ...candidate, fileId: extractDriveFileId(candidate.sourceUrl) }))
    .filter((candidate) => candidate.fileId);
}

async function fetchProductionHome() {
  const url = `${publicApiUrl}/api/public/home`;
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) {
    throw new Error(`Production public-home request failed: ${response.status} ${response.statusText} (${url})`);
  }

  const payload = await response.json();
  if (!payload || typeof payload !== "object" || typeof payload.generatedAt !== "string") {
    throw new Error(`Production public-home response is not a valid snapshot (${url})`);
  }

  return payload;
}

async function fetchTestWorkerHealth() {
  const response = await fetch(`${imageTestWorkerUrl}/health`, { headers: { Accept: "application/json" } });
  if (!response.ok) {
    throw new Error(`Image test Worker health failed: ${response.status} ${response.statusText}`);
  }

  const payload = await response.json();
  if (payload?.service !== "rcat-image-test" || payload?.status !== "ok") {
    throw new Error("Image test Worker returned an unexpected health payload");
  }
}

function buildDriveUrl(fileId, width) {
  const url = new URL("https://drive.google.com/thumbnail");
  url.searchParams.set("id", fileId);
  url.searchParams.set("sz", `w${width}`);
  return url.toString();
}

function buildWorkerUrl(fileId, width) {
  return `${imageTestWorkerUrl}/image/${encodeURIComponent(fileId)}?w=${width}`;
}

async function measure(url) {
  const startedAt = performance.now();
  const response = await fetch(url, {
    headers: {
      Accept: IMAGE_ACCEPT,
      "User-Agent": "RCAT-Image-Delivery-Benchmark/1.0"
    },
    redirect: "follow"
  });
  const headersAt = performance.now();
  const body = await response.arrayBuffer();
  const completedAt = performance.now();

  return {
    ok: response.ok && (response.headers.get("content-type") || "").startsWith("image/"),
    status: response.status,
    finalUrl: response.url,
    ttfbMs: headersAt - startedAt,
    totalMs: completedAt - startedAt,
    bytes: body.byteLength,
    contentType: response.headers.get("content-type") || "",
    contentLength: response.headers.get("content-length") || "",
    cfCacheStatus: response.headers.get("cf-cache-status") || "",
    age: response.headers.get("age") || "",
    serverTiming: response.headers.get("server-timing") || "",
    workerFormat: response.headers.get("x-rcat-image-format") || "",
    workerWidth: response.headers.get("x-rcat-image-width") || ""
  };
}

async function measurePath(url) {
  const first = await measure(url);
  if (!first.ok) return { first, samples: [] };

  const samples = [];
  for (let index = 0; index < SAMPLE_COUNT; index += 1) {
    samples.push(await measure(url));
  }
  return { first, samples };
}

function summarize(measurement) {
  if (!measurement.first.ok || measurement.samples.length === 0) {
    return {
      ok: false,
      status: measurement.first.status,
      contentType: measurement.first.contentType,
      bytes: measurement.first.bytes,
      firstTtfbMs: round(measurement.first.ttfbMs),
      firstTotalMs: round(measurement.first.totalMs),
      cfCacheStatus: measurement.first.cfCacheStatus,
      age: measurement.first.age,
      workerFormat: measurement.first.workerFormat,
      workerWidth: measurement.first.workerWidth,
      serverTiming: measurement.first.serverTiming
    };
  }

  const successful = measurement.samples.filter((sample) => sample.ok);
  if (successful.length === 0) return { ok: false, status: measurement.first.status };

  return {
    ok: true,
    status: measurement.first.status,
    contentType: successful.at(-1)?.contentType || measurement.first.contentType,
    bytes: Math.round(median(successful.map((sample) => sample.bytes))),
    firstTtfbMs: round(measurement.first.ttfbMs),
    firstTotalMs: round(measurement.first.totalMs),
    medianTtfbMs: round(median(successful.map((sample) => sample.ttfbMs))),
    medianTotalMs: round(median(successful.map((sample) => sample.totalMs))),
    cfCacheStatus: successful.at(-1)?.cfCacheStatus || "",
    age: successful.at(-1)?.age || "",
    workerFormat: successful.at(-1)?.workerFormat || "",
    workerWidth: successful.at(-1)?.workerWidth || "",
    serverTiming: successful.at(-1)?.serverTiming || ""
  };
}

function renderResultRow(label, width, path, summary) {
  if (!summary.ok) {
    return `| ${label} | ${width} | ${path} | HTTP ${summary.status} | ${summary.firstTtfbMs ?? "n/a"} | ${summary.firstTotalMs ?? "n/a"} | ${summary.bytes ?? "n/a"} | ${summary.contentType || "n/a"} | ${summary.cfCacheStatus || "n/a"} |`;
  }

  return `| ${label} | ${width} | ${path} | ${summary.firstTtfbMs} | ${summary.medianTtfbMs} | ${summary.medianTotalMs} | ${summary.bytes} | ${summary.contentType || "n/a"} | ${summary.cfCacheStatus || "n/a"} |`;
}

async function main() {
  await fetchTestWorkerHealth();
  const snapshot = await fetchProductionHome();
  const candidates = selectCandidates(snapshot);

  if (candidates.length === 0) {
    throw new Error("No active Google Drive image candidates were found in the current production home snapshot");
  }

  const results = [];
  for (const candidate of candidates) {
    const driveUrl = buildDriveUrl(candidate.fileId, candidate.width);
    const workerUrl = buildWorkerUrl(candidate.fileId, candidate.width);
    const direct = await measurePath(driveUrl);
    const worker = await measurePath(workerUrl);

    results.push({
      ...candidate,
      direct: summarize(direct),
      worker: summarize(worker)
    });
  }

  const lines = [
    "# RCAT Image Delivery Benchmark",
    "",
    `- Production snapshot generated: ${snapshot.generatedAt}`,
    `- Benchmark executed: ${new Date().toISOString()}`,
    `- Public API: ${publicApiUrl}`,
    `- Image test Worker: ${imageTestWorkerUrl}`,
    `- Repeated samples after first observed request: ${SAMPLE_COUNT}`,
    "",
    "| Asset | Width | Path | First TTFB ms | Median TTFB ms | Median total ms | Bytes | Content-Type | CF cache |",
    "| --- | ---: | --- | ---: | ---: | ---: | ---: | --- | --- |"
  ];

  for (const result of results) {
    lines.push(renderResultRow(result.label, result.width, "Drive", result.direct));
    lines.push(renderResultRow(result.label, result.width, "Cloudflare", result.worker));
  }

  lines.push("", "## Relative deltas", "");
  lines.push("| Asset | TTFB Δ Worker vs Drive | Total Δ Worker vs Drive | Bytes Δ Worker vs Drive | Worker format | Worker timing |");
  lines.push("| --- | ---: | ---: | ---: | --- | --- |");

  for (const result of results) {
    if (!result.direct.ok || !result.worker.ok) {
      lines.push(`| ${result.label} | unavailable | unavailable | unavailable | ${result.worker.workerFormat || "n/a"} | ${result.worker.serverTiming || "n/a"} |`);
      continue;
    }

    lines.push(
      `| ${result.label} | ${formatDelta(percentDelta(result.worker.medianTtfbMs, result.direct.medianTtfbMs))} | ${formatDelta(percentDelta(result.worker.medianTotalMs, result.direct.medianTotalMs))} | ${formatDelta(percentDelta(result.worker.bytes, result.direct.bytes))} | ${result.worker.workerFormat || result.worker.contentType} | ${result.worker.serverTiming || "n/a"} |`
    );
  }

  lines.push(
    "",
    "Negative deltas mean the Cloudflare test path was lower than direct Drive for that metric. This runner measurement is diagnostic evidence, not a substitute for production p75 Web Vitals."
  );

  console.log(lines.join("\n"));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
