import { chromium } from "@playwright/test";

const HOME_URL = "https://www.rcat.ac.th/";
const WORKER_BASE = "https://rcat-image-test-v2.rcat-digital.workers.dev";
const ALLOWED_WIDTHS = new Set([128, 160, 192, 240, 256, 320, 384, 480, 512, 640, 900, 1200, 1600]);

const PROFILES = [
  {
    name: "desktop-native",
    viewport: { width: 1366, height: 768 },
    deviceScaleFactor: 1,
    network: null
  },
  {
    name: "mobile-4g-like",
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    network: {
      offline: false,
      latency: 100,
      downloadThroughput: 500_000,
      uploadThroughput: 250_000,
      connectionType: "cellular4g"
    }
  }
];

const SYNTHETIC_CASES = [
  {
    label: "intro-king-birthday",
    fileId: "1FsYaGfDWlj6pEaAQedS6409PsgZtuIFa",
    widths: { "desktop-native": 1200, "mobile-4g-like": 900 }
  },
  {
    label: "intro-princess",
    fileId: "1BEKEnay0iqYBiH5CzTuUxNF3LL44i_cD",
    widths: { "desktop-native": 900, "mobile-4g-like": 640 }
  },
  {
    label: "intro-coronation",
    fileId: "1k9KdRhXwxX1ATy6BLf2CG14_Mj_JpxSK",
    widths: { "desktop-native": 1600, "mobile-4g-like": 1200 }
  },
  {
    label: "director",
    fileId: "1WoFIoK4inXY5PmUS043AGJxyYKi6X6Mi",
    widths: { "desktop-native": 512, "mobile-4g-like": 384 }
  }
];

function median(values) {
  const clean = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (clean.length === 0) return null;
  const middle = Math.floor(clean.length / 2);
  return clean.length % 2 === 0 ? (clean[middle - 1] + clean[middle]) / 2 : clean[middle];
}

function round(value) {
  return Number.isFinite(value) ? Math.round(value * 10) / 10 : null;
}

function driveUrl(fileId, width) {
  return `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w${width}`;
}

function workerUrl(fileId, width) {
  return `${WORKER_BASE}/image/${encodeURIComponent(fileId)}?w=${width}`;
}

function rewriteDriveThumbnail(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (url.hostname !== "drive.google.com" || url.pathname !== "/thumbnail") return null;
    const fileId = url.searchParams.get("id");
    const size = url.searchParams.get("sz") ?? "";
    const match = /^w(\d+)$/.exec(size);
    if (!fileId || !match) return null;
    const width = Number(match[1]);
    if (!ALLOWED_WIDTHS.has(width)) return null;
    return workerUrl(fileId, width);
  } catch {
    return null;
  }
}

async function configureProfile(context, page, profile) {
  if (!profile.network) return;
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", profile.network);
}

async function captureImage(page, url) {
  const responseRecords = [];
  const responseTasks = [];

  const onResponse = (response) => {
    const task = (async () => {
      const request = response.request();
      if (request.resourceType() !== "image") return;
      let headers = {};
      try {
        headers = await response.allHeaders();
      } catch {
        headers = response.headers();
      }
      responseRecords.push({
        url: response.url(),
        status: response.status(),
        contentType: headers["content-type"] ?? null,
        contentLength: Number(headers["content-length"] ?? 0) || null,
        cfCacheStatus: headers["cf-cache-status"] ?? null,
        age: Number(headers.age ?? 0) || 0,
        cfResized: headers["cf-resized"] ?? null,
        serverTiming: headers["server-timing"] ?? null,
        sourceWidth: headers["x-rcat-image-source-width"] ?? null,
        requestedFormat: headers["x-rcat-image-format"] ?? null
      });
    })();
    responseTasks.push(task);
  };

  page.on("response", onResponse);

  const result = await page.evaluate(async (src) => {
    return await new Promise((resolve) => {
      const startedAt = performance.now();
      const image = new Image();
      image.decoding = "async";
      image.onload = () => {
        const endedAt = performance.now();
        const entry = performance.getEntriesByName(src).at(-1);
        resolve({
          ok: true,
          loadMs: endedAt - startedAt,
          naturalWidth: image.naturalWidth,
          naturalHeight: image.naturalHeight,
          resourceDurationMs: entry?.duration ?? null,
          transferSize: entry?.transferSize ?? null,
          encodedBodySize: entry?.encodedBodySize ?? null
        });
      };
      image.onerror = () => resolve({ ok: false, loadMs: performance.now() - startedAt });
      document.body.appendChild(image);
      image.src = src;
    });
  }, url);

  await Promise.allSettled(responseTasks);
  page.off("response", onResponse);
  return { ...result, responses: responseRecords };
}

async function runSynthetic(browser) {
  const results = [];

  for (const profile of PROFILES) {
    for (const testCase of SYNTHETIC_CASES) {
      const width = testCase.widths[profile.name];
      const direct = driveUrl(testCase.fileId, width);
      const worker = workerUrl(testCase.fileId, width);

      for (const phase of ["direct", "worker-first", "worker-second"]) {
        const context = await browser.newContext({
          viewport: profile.viewport,
          deviceScaleFactor: profile.deviceScaleFactor,
          serviceWorkers: "block"
        });
        const page = await context.newPage();
        await configureProfile(context, page, profile);
        await page.setContent("<!doctype html><html><head><meta charset='utf-8'></head><body></body></html>");

        const url = phase === "direct" ? direct : worker;
        const measured = await captureImage(page, url);
        const primaryResponse = measured.responses.at(-1) ?? null;
        results.push({
          profile: profile.name,
          label: testCase.label,
          width,
          phase,
          ok: measured.ok,
          loadMs: round(measured.loadMs),
          naturalWidth: measured.naturalWidth ?? null,
          naturalHeight: measured.naturalHeight ?? null,
          resourceDurationMs: round(measured.resourceDurationMs),
          transferSize: measured.transferSize ?? null,
          encodedBodySize: measured.encodedBodySize ?? null,
          responseUrl: primaryResponse?.url ?? null,
          status: primaryResponse?.status ?? null,
          contentType: primaryResponse?.contentType ?? null,
          contentLength: primaryResponse?.contentLength ?? null,
          cfCacheStatus: primaryResponse?.cfCacheStatus ?? null,
          age: primaryResponse?.age ?? null,
          cfResized: Boolean(primaryResponse?.cfResized),
          sourceWidth: primaryResponse?.sourceWidth ?? null,
          requestedFormat: primaryResponse?.requestedFormat ?? null
        });

        await context.close();
      }
    }
  }

  return results;
}

async function installMetricsObserver(page) {
  await page.addInitScript(() => {
    window.__RCAT_IMAGE_BENCH__ = { lcp: 0, lcpUrl: "", lcpSize: 0, cls: 0 };
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          window.__RCAT_IMAGE_BENCH__.lcp = entry.startTime;
          window.__RCAT_IMAGE_BENCH__.lcpUrl = entry.url || "";
          window.__RCAT_IMAGE_BENCH__.lcpSize = entry.size || 0;
        }
      }).observe({ type: "largest-contentful-paint", buffered: true });
    } catch {}
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) window.__RCAT_IMAGE_BENCH__.cls += entry.value;
        }
      }).observe({ type: "layout-shift", buffered: true });
    } catch {}
  });
}

async function runHomepageOnce(browser, profile, mode, run) {
  const context = await browser.newContext({
    viewport: profile.viewport,
    deviceScaleFactor: profile.deviceScaleFactor,
    serviceWorkers: "block"
  });
  const page = await context.newPage();
  await configureProfile(context, page, profile);
  await installMetricsObserver(page);

  let rewritten = 0;
  if (mode === "worker") {
    await page.route("https://drive.google.com/**", async (route) => {
      const replacement = rewriteDriveThumbnail(route.request().url());
      if (replacement) {
        rewritten += 1;
        await route.continue({ url: replacement });
      } else {
        await route.continue();
      }
    });
  }

  const imageResponses = [];
  const responseTasks = [];
  page.on("response", (response) => {
    const task = (async () => {
      if (response.request().resourceType() !== "image") return;
      let headers = {};
      try {
        headers = await response.allHeaders();
      } catch {
        headers = response.headers();
      }
      const url = response.url();
      if (
        !url.includes("drive.google.com") &&
        !url.includes("googleusercontent.com") &&
        !url.includes("workers.dev")
      ) return;
      imageResponses.push({
        url,
        status: response.status(),
        contentType: headers["content-type"] ?? null,
        contentLength: Number(headers["content-length"] ?? 0) || 0,
        cfCacheStatus: headers["cf-cache-status"] ?? null,
        age: Number(headers.age ?? 0) || 0
      });
    })();
    responseTasks.push(task);
  });

  const startedAt = Date.now();
  await page.goto(`${HOME_URL}?image-delivery-benchmark=${profile.name}-${mode}-${run}-${startedAt}`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000
  });

  await page.waitForTimeout(3_000);
  const initial = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0];
    return {
      metrics: window.__RCAT_IMAGE_BENCH__,
      domContentLoadedMs: nav?.domContentLoadedEventEnd ?? null,
      loadEventMs: nav?.loadEventEnd ?? null,
      imageTotal: document.images.length,
      imageReady: [...document.images].filter((image) => image.complete && image.naturalWidth > 0).length
    };
  });

  const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < scrollHeight; y += Math.max(500, Math.floor(profile.viewport.height * 0.8))) {
    await page.evaluate((nextY) => window.scrollTo(0, nextY), y);
    await page.waitForTimeout(180);
  }
  await page.waitForTimeout(1_500);

  const final = await page.evaluate(() => ({
    imageTotal: document.images.length,
    imageReady: [...document.images].filter((image) => image.complete && image.naturalWidth > 0).length,
    driveImageElements: [...document.images].filter((image) => image.currentSrc.includes("drive.google.com") || image.src.includes("drive.google.com")).length
  }));

  await Promise.allSettled(responseTasks);

  const workerResponses = imageResponses.filter((item) => item.url.includes("workers.dev"));
  const googleResponses = imageResponses.filter((item) => item.url.includes("drive.google.com") || item.url.includes("googleusercontent.com"));
  const totalBytes = imageResponses.reduce((sum, item) => sum + (item.contentLength || 0), 0);

  const result = {
    profile: profile.name,
    mode,
    run,
    elapsedMs: Date.now() - startedAt,
    lcpMs: round(initial.metrics?.lcp),
    lcpUrl: initial.metrics?.lcpUrl ?? "",
    lcpSize: initial.metrics?.lcpSize ?? 0,
    cls: round(initial.metrics?.cls),
    domContentLoadedMs: round(initial.domContentLoadedMs),
    loadEventMs: round(initial.loadEventMs),
    initialImageTotal: initial.imageTotal,
    initialImageReady: initial.imageReady,
    finalImageTotal: final.imageTotal,
    finalImageReady: final.imageReady,
    driveImageElements: final.driveImageElements,
    rewritten,
    imageResponseCount: imageResponses.length,
    workerResponseCount: workerResponses.length,
    googleResponseCount: googleResponses.length,
    workerHits: workerResponses.filter((item) => item.cfCacheStatus === "HIT").length,
    workerMisses: workerResponses.filter((item) => item.cfCacheStatus === "MISS").length,
    totalObservedImageBytes: totalBytes,
    workerObservedBytes: workerResponses.reduce((sum, item) => sum + (item.contentLength || 0), 0),
    googleObservedBytes: googleResponses.reduce((sum, item) => sum + (item.contentLength || 0), 0)
  };

  await context.close();
  return result;
}

async function runHomepage(browser) {
  const results = [];
  for (const profile of PROFILES) {
    for (const mode of ["direct", "worker"]) {
      for (let run = 1; run <= 4; run += 1) {
        results.push(await runHomepageOnce(browser, profile, mode, run));
      }
    }
  }
  return results;
}

function summarizeSynthetic(results) {
  const groups = new Map();
  for (const row of results) {
    const key = `${row.profile}|${row.label}|${row.width}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  return [...groups.entries()].map(([key, rows]) => {
    const [profile, label, width] = key.split("|");
    const direct = rows.find((row) => row.phase === "direct");
    const first = rows.find((row) => row.phase === "worker-first");
    const second = rows.find((row) => row.phase === "worker-second");
    const aspect = (row) => row?.naturalWidth && row?.naturalHeight ? row.naturalWidth / row.naturalHeight : null;
    const directAspect = aspect(direct);
    const workerAspect = aspect(second ?? first);
    return {
      profile,
      label,
      width: Number(width),
      directLoadMs: direct?.loadMs ?? null,
      workerFirstLoadMs: first?.loadMs ?? null,
      workerSecondLoadMs: second?.loadMs ?? null,
      firstCacheStatus: first?.cfCacheStatus ?? null,
      secondCacheStatus: second?.cfCacheStatus ?? null,
      directContentLength: direct?.contentLength ?? null,
      workerContentLength: second?.contentLength ?? first?.contentLength ?? null,
      workerContentType: second?.contentType ?? first?.contentType ?? null,
      sourceWidth: second?.sourceWidth ?? first?.sourceWidth ?? null,
      aspectRatioDelta: directAspect && workerAspect ? round(Math.abs(directAspect - workerAspect)) : null,
      dimensionsMatch: direct?.naturalWidth === (second?.naturalWidth ?? first?.naturalWidth) && direct?.naturalHeight === (second?.naturalHeight ?? first?.naturalHeight)
    };
  });
}

function summarizeHomepage(results) {
  const groups = new Map();
  for (const row of results) {
    const key = `${row.profile}|${row.mode}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return [...groups.entries()].map(([key, rows]) => {
    const [profile, mode] = key.split("|");
    return {
      profile,
      mode,
      runs: rows.length,
      medianLcpMs: round(median(rows.map((row) => row.lcpMs))),
      medianDomContentLoadedMs: round(median(rows.map((row) => row.domContentLoadedMs))),
      medianLoadEventMs: round(median(rows.map((row) => row.loadEventMs))),
      medianObservedImageBytes: Math.round(median(rows.map((row) => row.totalObservedImageBytes)) ?? 0),
      medianWorkerHits: round(median(rows.map((row) => row.workerHits))),
      medianWorkerMisses: round(median(rows.map((row) => row.workerMisses))),
      medianRewritten: round(median(rows.map((row) => row.rewritten)),
      medianFinalReadyRatio: round(median(rows.map((row) => row.finalImageTotal ? row.finalImageReady / row.finalImageTotal : 1)))
    };
  });
}

const browser = await chromium.launch({ headless: true });
try {
  const healthResponse = await fetch(`${WORKER_BASE}/health`);
  if (!healthResponse.ok) throw new Error(`Worker health failed: ${healthResponse.status}`);
  console.log("WORKER_HEALTH", await healthResponse.text());

  const synthetic = await runSynthetic(browser);
  console.log("SYNTHETIC_RESULTS", JSON.stringify(synthetic, null, 2));

  const homepage = await runHomepage(browser);
  console.log("HOMEPAGE_RESULTS", JSON.stringify(homepage, null, 2));

  const summary = {
    generatedAt: new Date().toISOString(),
    worker: WORKER_BASE,
    synthetic: summarizeSynthetic(synthetic),
    homepage: summarizeHomepage(homepage)
  };
  console.log("BENCHMARK_SUMMARY", JSON.stringify(summary, null, 2));
} finally {
  await browser.close();
}
