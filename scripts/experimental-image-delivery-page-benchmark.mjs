import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';

const SITE_URL = 'https://www.rcat.ac.th/';
const WORKER_BASE = 'https://rcat-image-test.rcat-digital.workers.dev';
const ALLOWED_WIDTHS = new Set([128, 160, 192, 240, 256, 320, 384, 480, 512, 640, 900, 1200, 1600]);
const SAMPLES_PER_MODE = 4;

const profiles = [
  {
    name: 'desktop',
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    isMobile: false,
    throttle: null
  },
  {
    name: 'mobile-fast4g-like',
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    throttle: {
      latency: 75,
      downloadThroughput: (1.6 * 1024 * 1024) / 8,
      uploadThroughput: (0.75 * 1024 * 1024) / 8
    }
  }
];

const syntheticIntroCases = [
  { label: 'intro-lent-1200', fileId: '1xexq29XFWIHLM7OzfdwRnM1Pu37FRGyR', width: 1200 },
  { label: 'intro-asalha-900', fileId: '1Yd7-yLPCjlPJoBkzHJx--rrL4kR85BBy', width: 900 },
  { label: 'intro-coronation-1200', fileId: '1k9KdRhXwxX1ATy6BLf2CG14_Mj_JpxSK', width: 1200 }
];

function median(values) {
  const clean = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!clean.length) return null;
  const middle = Math.floor(clean.length / 2);
  return clean.length % 2 ? clean[middle] : (clean[middle - 1] + clean[middle]) / 2;
}

function round(value, digits = 1) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function parseDriveThumbnail(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (url.hostname !== 'drive.google.com' || url.pathname !== '/thumbnail') return null;
    const fileId = url.searchParams.get('id');
    const size = url.searchParams.get('sz') ?? '';
    const match = /^w(\d+)$/.exec(size);
    const width = match ? Number(match[1]) : null;
    if (!fileId || !width) return null;
    return { fileId, width };
  } catch {
    return null;
  }
}

function driveInfoFromRequest(request, requestMeta) {
  if (requestMeta.has(request)) return requestMeta.get(request);
  let cursor = request;
  while (cursor) {
    const parsed = parseDriveThumbnail(cursor.url());
    if (parsed) return parsed;
    cursor = cursor.redirectedFrom();
  }
  return null;
}

async function applyThrottle(context, page, throttle) {
  if (!throttle) return;
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: throttle.latency,
    downloadThroughput: throttle.downloadThroughput,
    uploadThroughput: throttle.uploadThroughput,
    connectionType: 'cellular4g'
  });
}

async function runPageSample(browser, profile, mode, sampleIndex) {
  const context = await browser.newContext({
    viewport: profile.viewport,
    deviceScaleFactor: profile.deviceScaleFactor,
    isMobile: profile.isMobile,
    locale: 'th-TH'
  });
  const page = await context.newPage();
  await applyThrottle(context, page, profile.throttle);

  const requestMeta = new Map();
  const imageTransfers = [];

  await page.addInitScript(() => {
    window.__rcatBench = { lcp: 0, cls: 0 };
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) window.__rcatBench.lcp = entry.startTime;
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    } catch {}
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) window.__rcatBench.cls += entry.value;
        }
      }).observe({ type: 'layout-shift', buffered: true });
    } catch {}
  });

  await page.route('https://drive.google.com/thumbnail**', async (route) => {
    const request = route.request();
    const parsed = parseDriveThumbnail(request.url());
    if (!parsed) {
      await route.continue();
      return;
    }
    requestMeta.set(request, parsed);

    if (mode === 'worker' && ALLOWED_WIDTHS.has(parsed.width)) {
      const target = `${WORKER_BASE}/image/${encodeURIComponent(parsed.fileId)}?w=${parsed.width}&pageProbe=${profile.name}-${sampleIndex}`;
      await route.continue({ url: target });
      return;
    }

    await route.continue();
  });

  page.on('requestfinished', async (request) => {
    try {
      if (request.redirectedTo()) return;
      const info = driveInfoFromRequest(request, requestMeta);
      if (!info) return;
      const response = await request.response();
      if (!response) return;
      const headers = await response.allHeaders();
      const timing = request.timing();
      imageTransfers.push({
        fileId: info.fileId,
        requestedWidth: info.width,
        finalUrl: request.url(),
        status: response.status(),
        contentType: headers['content-type'] ?? null,
        contentLength: Number(headers['content-length'] ?? 0) || null,
        cfCacheStatus: headers['cf-cache-status'] ?? null,
        cfResized: headers['cf-resized'] ?? null,
        ttfbMs: Number.isFinite(timing.responseStart) ? timing.responseStart : null,
        totalMs:
          Number.isFinite(timing.responseEnd) && Number.isFinite(timing.startTime)
            ? timing.responseEnd
            : Number.isFinite(timing.responseEnd)
              ? timing.responseEnd
              : null
      });
    } catch {}
  });

  const started = Date.now();
  await page.goto(SITE_URL, { waitUntil: 'load', timeout: 90_000 });
  await page.waitForTimeout(2500);
  const wallMs = Date.now() - started;

  const browserMetrics = await page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0];
    const images = Array.from(document.images).map((img) => ({
      currentSrc: img.currentSrc,
      src: img.src,
      complete: img.complete,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      loading: img.loading,
      fetchPriority: img.fetchPriority
    }));
    return {
      lcpMs: window.__rcatBench?.lcp ?? 0,
      cls: window.__rcatBench?.cls ?? 0,
      domContentLoadedMs: navigation?.domContentLoadedEventEnd ?? null,
      loadEventMs: navigation?.loadEventEnd ?? null,
      responseEndMs: navigation?.responseEnd ?? null,
      imageCount: images.length,
      incompleteImages: images.filter((img) => !img.complete || !img.naturalWidth).length,
      images
    };
  });

  await page.close();
  await context.close();

  const knownBytes = imageTransfers.reduce((sum, item) => sum + (item.contentLength ?? 0), 0);
  const workerHits = imageTransfers.filter((item) => item.cfCacheStatus === 'HIT').length;
  const workerMisses = imageTransfers.filter((item) => item.cfCacheStatus === 'MISS').length;

  return {
    profile: profile.name,
    mode,
    sampleIndex,
    wallMs,
    ...browserMetrics,
    driveImageTransfers: imageTransfers,
    knownImageBytes: knownBytes,
    workerHits,
    workerMisses
  };
}

async function loadImage(page, url, label) {
  const responseMeta = [];
  const handler = async (response) => {
    if (!response.url().includes('drive.google.com') && !response.url().includes('workers.dev') && !response.url().includes('googleusercontent.com')) return;
    try {
      const headers = await response.allHeaders();
      responseMeta.push({
        url: response.url(),
        status: response.status(),
        contentType: headers['content-type'] ?? null,
        contentLength: Number(headers['content-length'] ?? 0) || null,
        cfCacheStatus: headers['cf-cache-status'] ?? null,
        cfResized: headers['cf-resized'] ?? null,
        age: headers.age ?? null
      });
    } catch {}
  };
  page.on('response', handler);
  const result = await page.evaluate(
    ({ imageUrl, imageLabel }) =>
      new Promise((resolve) => {
        const started = performance.now();
        const img = new Image();
        img.decoding = 'async';
        img.onload = () =>
          resolve({
            label: imageLabel,
            ok: true,
            elapsedMs: performance.now() - started,
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight
          });
        img.onerror = () => resolve({ label: imageLabel, ok: false, elapsedMs: performance.now() - started });
        img.src = imageUrl;
      }),
    { imageUrl: url, imageLabel: label }
  );
  page.off('response', handler);
  return { ...result, responses: responseMeta };
}

async function runSyntheticIntro(browser) {
  const profile = profiles.find((item) => item.name === 'mobile-fast4g-like');
  const context = await browser.newContext({
    viewport: profile.viewport,
    deviceScaleFactor: profile.deviceScaleFactor,
    isMobile: true,
    locale: 'th-TH'
  });
  const page = await context.newPage();
  await applyThrottle(context, page, profile.throttle);
  await page.setContent('<!doctype html><meta name="viewport" content="width=device-width"><body></body>');

  const results = [];
  for (const testCase of syntheticIntroCases) {
    const direct = `https://drive.google.com/thumbnail?id=${encodeURIComponent(testCase.fileId)}&sz=w${testCase.width}`;
    const worker1 = `${WORKER_BASE}/image/${encodeURIComponent(testCase.fileId)}?w=${testCase.width}&syntheticProbe=first-${Date.now()}`;
    const worker2 = `${WORKER_BASE}/image/${encodeURIComponent(testCase.fileId)}?w=${testCase.width}&syntheticProbe=second-${Date.now()}`;

    results.push({
      case: testCase,
      direct: await loadImage(page, direct, `${testCase.label}-direct`),
      workerFirst: await loadImage(page, worker1, `${testCase.label}-worker-first`),
      workerSecond: await loadImage(page, worker2, `${testCase.label}-worker-second`)
    });
  }

  await context.close();
  return results;
}

function summarizePageRuns(runs) {
  const groups = {};
  for (const run of runs) {
    const key = `${run.profile}:${run.mode}`;
    (groups[key] ??= []).push(run);
  }

  const summary = {};
  for (const [key, values] of Object.entries(groups)) {
    summary[key] = {
      samples: values.length,
      medianLcpMs: round(median(values.map((value) => value.lcpMs))),
      medianLoadEventMs: round(median(values.map((value) => value.loadEventMs))),
      medianWallMs: round(median(values.map((value) => value.wallMs))),
      medianKnownImageBytes: round(median(values.map((value) => value.knownImageBytes)), 0),
      medianImageTransferCount: round(median(values.map((value) => value.driveImageTransfers.length)), 0),
      totalWorkerHits: values.reduce((sum, value) => sum + value.workerHits, 0),
      totalWorkerMisses: values.reduce((sum, value) => sum + value.workerMisses, 0),
      medianCls: round(median(values.map((value) => value.cls)), 4),
      incompleteImagesTotal: values.reduce((sum, value) => sum + value.incompleteImages, 0)
    };
  }
  return summary;
}

const browser = await chromium.launch({ headless: true });
const pageRuns = [];
try {
  for (const profile of profiles) {
    for (const mode of ['direct', 'worker']) {
      for (let sampleIndex = 1; sampleIndex <= SAMPLES_PER_MODE; sampleIndex += 1) {
        console.log(`PAGE profile=${profile.name} mode=${mode} sample=${sampleIndex}/${SAMPLES_PER_MODE}`);
        const result = await runPageSample(browser, profile, mode, sampleIndex);
        pageRuns.push(result);
        console.log(
          JSON.stringify({
            profile: result.profile,
            mode: result.mode,
            sample: result.sampleIndex,
            lcpMs: round(result.lcpMs),
            loadEventMs: round(result.loadEventMs),
            knownImageBytes: result.knownImageBytes,
            imageTransfers: result.driveImageTransfers.length,
            workerHits: result.workerHits,
            workerMisses: result.workerMisses,
            incompleteImages: result.incompleteImages
          })
        );
      }
    }
  }

  console.log('SYNTHETIC_INTRO mobile-fast4g-like');
  const syntheticIntro = await runSyntheticIntro(browser);
  const summary = summarizePageRuns(pageRuns);
  const output = {
    generatedAt: new Date().toISOString(),
    siteUrl: SITE_URL,
    workerBase: WORKER_BASE,
    methodology: {
      samplesPerMode: SAMPLES_PER_MODE,
      pageDriveRequestsInterceptedInBothModes: true,
      browserCacheNote: 'Playwright routing disables browser HTTP cache; comparison focuses on Drive delivery vs Cloudflare edge delivery under the same browser-routing condition.',
      mobileProfile: profiles[1].throttle,
      introGateProductionState: 'disabled; synthetic browser image-load probes are used for IntroGate assets.'
    },
    summary,
    syntheticIntro,
    pageRuns
  };

  await fs.writeFile('image-delivery-benchmark-results.json', JSON.stringify(output, null, 2));
  console.log('=== PAGE SUMMARY ===');
  console.log(JSON.stringify(summary, null, 2));
  console.log('=== SYNTHETIC INTRO SUMMARY ===');
  console.log(
    JSON.stringify(
      syntheticIntro.map((item) => ({
        label: item.case.label,
        width: item.case.width,
        directMs: round(item.direct.elapsedMs),
        workerFirstMs: round(item.workerFirst.elapsedMs),
        workerSecondMs: round(item.workerSecond.elapsedMs),
        firstCacheStatus: item.workerFirst.responses.find((response) => response.url.includes('workers.dev'))?.cfCacheStatus ?? null,
        secondCacheStatus: item.workerSecond.responses.find((response) => response.url.includes('workers.dev'))?.cfCacheStatus ?? null,
        directBytes: item.direct.responses.at(-1)?.contentLength ?? null,
        workerBytes: item.workerSecond.responses.find((response) => response.url.includes('workers.dev'))?.contentLength ?? null
      })),
      null,
      2
    )
  );
} finally {
  await browser.close();
}
