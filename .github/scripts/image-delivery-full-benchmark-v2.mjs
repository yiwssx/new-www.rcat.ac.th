import { chromium } from '@playwright/test';

const HOME_URL = 'https://www.rcat.ac.th/';
const WORKER_BASE = 'https://rcat-image-test-v2.rcat-digital.workers.dev';
const ALLOWED_WIDTHS = new Set([128,160,192,240,256,320,384,480,512,640,900,1200,1600]);
const PROFILES = [
  { name: 'desktop-native', viewport: { width: 1366, height: 768 }, dpr: 1, network: null },
  { name: 'mobile-4g-like', viewport: { width: 390, height: 844 }, dpr: 2,
    network: { offline: false, latency: 100, downloadThroughput: 500000, uploadThroughput: 250000, connectionType: 'cellular4g' } }
];
const CASES = [
  { label:'intro-king-birthday', id:'1FsYaGfDWlj6pEaAQedS6409PsgZtuIFa', desktop:1200, mobile:900 },
  { label:'intro-princess', id:'1BEKEnay0iqYBiH5CzTuUxNF3LL44i_cD', desktop:900, mobile:640 },
  { label:'intro-coronation', id:'1k9KdRhXwxX1ATy6BLf2CG14_Mj_JpxSK', desktop:1600, mobile:1200 },
  { label:'director', id:'1WoFIoK4inXY5PmUS043AGJxyYKi6X6Mi', desktop:512, mobile:384 }
];

const median = (xs) => {
  const a = xs.filter(Number.isFinite).sort((x,y)=>x-y);
  if (!a.length) return null;
  const m = Math.floor(a.length/2);
  return a.length % 2 ? a[m] : (a[m-1]+a[m])/2;
};
const round = (n) => Number.isFinite(n) ? Math.round(n*10)/10 : null;
const driveUrl = (id,w) => `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w${w}`;
const workerUrl = (id,w) => `${WORKER_BASE}/image/${encodeURIComponent(id)}?w=${w}`;

function rewriteDrive(raw) {
  try {
    const u = new URL(raw);
    if (u.hostname !== 'drive.google.com' || u.pathname !== '/thumbnail') return null;
    const id = u.searchParams.get('id');
    const m = /^w(\d+)$/.exec(u.searchParams.get('sz') || '');
    if (!id || !m) return null;
    const w = Number(m[1]);
    if (!ALLOWED_WIDTHS.has(w)) return null;
    return workerUrl(id,w);
  } catch { return null; }
}

async function applyNetwork(context,page,profile) {
  if (!profile.network) return;
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', profile.network);
}

async function newPage(browser, profile) {
  const context = await browser.newContext({ viewport: profile.viewport, deviceScaleFactor: profile.dpr, serviceWorkers: 'block' });
  const page = await context.newPage();
  await applyNetwork(context,page,profile);
  return { context, page };
}

async function loadSingleImage(browser, profile, url) {
  const { context, page } = await newPage(browser,profile);
  const responses = [];
  page.on('response', async (res) => {
    if (res.request().resourceType() !== 'image') return;
    const h = await res.allHeaders().catch(()=>res.headers());
    responses.push({
      url: res.url(), status: res.status(), contentType: h['content-type'] || null,
      contentLength: Number(h['content-length'] || 0) || null,
      cfCacheStatus: h['cf-cache-status'] || null, age: Number(h.age || 0) || 0,
      cfResized: Boolean(h['cf-resized']), sourceWidth: h['x-rcat-image-source-width'] || null,
      requestedFormat: h['x-rcat-image-format'] || null
    });
  });
  await page.setContent('<!doctype html><body></body>');
  const metrics = await page.evaluate(async (src) => await new Promise((resolve) => {
    const t0 = performance.now();
    const img = new Image();
    img.onload = () => resolve({ ok:true, loadMs: performance.now()-t0, w:img.naturalWidth, h:img.naturalHeight });
    img.onerror = () => resolve({ ok:false, loadMs: performance.now()-t0, w:0, h:0 });
    document.body.appendChild(img);
    img.src = src;
  }), url);
  await page.waitForTimeout(50);
  await context.close();
  return { ...metrics, response: responses.at(-1) || null };
}

async function runSynthetic(browser) {
  const rows = [];
  for (const profile of PROFILES) {
    for (const c of CASES) {
      const width = profile.name === 'desktop-native' ? c.desktop : c.mobile;
      for (const phase of ['direct','worker-first','worker-second']) {
        const url = phase === 'direct' ? driveUrl(c.id,width) : workerUrl(c.id,width);
        const r = await loadSingleImage(browser,profile,url);
        rows.push({
          profile:profile.name,label:c.label,width,phase,ok:r.ok,loadMs:round(r.loadMs),
          naturalWidth:r.w,naturalHeight:r.h,status:r.response?.status ?? null,
          contentType:r.response?.contentType ?? null,contentLength:r.response?.contentLength ?? null,
          cfCacheStatus:r.response?.cfCacheStatus ?? null,age:r.response?.age ?? null,
          cfResized:r.response?.cfResized ?? false,sourceWidth:r.response?.sourceWidth ?? null,
          requestedFormat:r.response?.requestedFormat ?? null
        });
      }
    }
  }
  return rows;
}

async function installPerf(page) {
  await page.addInitScript(() => {
    window.__bench = { lcp:0, cls:0 };
    try { new PerformanceObserver(list => { for (const e of list.getEntries()) window.__bench.lcp = e.startTime; }).observe({type:'largest-contentful-paint',buffered:true}); } catch {}
    try { new PerformanceObserver(list => { for (const e of list.getEntries()) if (!e.hadRecentInput) window.__bench.cls += e.value; }).observe({type:'layout-shift',buffered:true}); } catch {}
  });
}

async function homepageRun(browser, profile, mode, run) {
  const { context, page } = await newPage(browser,profile);
  await installPerf(page);
  let rewritten = 0;
  if (mode === 'worker') {
    await page.route('https://drive.google.com/**', async route => {
      const replacement = rewriteDrive(route.request().url());
      if (replacement) { rewritten += 1; await route.continue({url:replacement}); }
      else await route.continue();
    });
  }
  const imageResponses = [];
  page.on('response', async (res) => {
    if (res.request().resourceType() !== 'image') return;
    const url = res.url();
    if (!/drive\.google\.com|googleusercontent\.com|workers\.dev/.test(url)) return;
    const h = await res.allHeaders().catch(()=>res.headers());
    imageResponses.push({url,contentLength:Number(h['content-length']||0)||0,cache:h['cf-cache-status']||null});
  });
  const started = Date.now();
  await page.goto(`${HOME_URL}?image-bench=${profile.name}-${mode}-${run}-${started}`, {waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForTimeout(3000);
  const initial = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    return {
      lcp: window.__bench?.lcp || 0, cls: window.__bench?.cls || 0,
      dcl: nav?.domContentLoadedEventEnd ?? null, load: nav?.loadEventEnd ?? null,
      total: document.images.length, ready: [...document.images].filter(i=>i.complete&&i.naturalWidth>0).length
    };
  });
  const h = await page.evaluate(()=>document.documentElement.scrollHeight);
  const step = Math.max(500,Math.floor(profile.viewport.height*0.8));
  for (let y=0; y<h; y+=step) { await page.evaluate(v=>window.scrollTo(0,v),y); await page.waitForTimeout(150); }
  await page.waitForTimeout(1200);
  const final = await page.evaluate(() => ({ total:document.images.length, ready:[...document.images].filter(i=>i.complete&&i.naturalWidth>0).length }));
  const workerResponses = imageResponses.filter(r=>r.url.includes('workers.dev'));
  const googleResponses = imageResponses.filter(r=>/drive\.google\.com|googleusercontent\.com/.test(r.url));
  const row = {
    profile:profile.name,mode,run,lcpMs:round(initial.lcp),cls:round(initial.cls),
    dclMs:round(initial.dcl),loadMs:round(initial.load),rewritten,
    initialReadyRatio:initial.total?round(initial.ready/initial.total):1,
    finalReadyRatio:final.total?round(final.ready/final.total):1,
    workerHits:workerResponses.filter(r=>r.cache==='HIT').length,
    workerMisses:workerResponses.filter(r=>r.cache==='MISS').length,
    workerResponses:workerResponses.length,googleResponses:googleResponses.length,
    observedImageBytes:imageResponses.reduce((s,r)=>s+r.contentLength,0),
    elapsedMs:Date.now()-started
  };
  await context.close();
  return row;
}

async function runHomepage(browser) {
  const rows = [];
  for (const profile of PROFILES) {
    for (const mode of ['direct','worker']) {
      for (let run=1; run<=4; run++) rows.push(await homepageRun(browser,profile,mode,run));
    }
  }
  return rows;
}

function syntheticSummary(rows) {
  const out = [];
  for (const profile of PROFILES.map(p=>p.name)) {
    for (const c of CASES) {
      const rr = rows.filter(r=>r.profile===profile && r.label===c.label);
      const direct = rr.find(r=>r.phase==='direct');
      const first = rr.find(r=>r.phase==='worker-first');
      const second = rr.find(r=>r.phase==='worker-second');
      const ar = x => x?.naturalWidth && x?.naturalHeight ? x.naturalWidth/x.naturalHeight : null;
      out.push({
        profile,label:c.label,width:direct?.width ?? first?.width ?? null,
        directLoadMs:direct?.loadMs ?? null,workerFirstLoadMs:first?.loadMs ?? null,workerSecondLoadMs:second?.loadMs ?? null,
        firstCacheStatus:first?.cfCacheStatus ?? null,secondCacheStatus:second?.cfCacheStatus ?? null,
        directBytes:direct?.contentLength ?? null,workerBytes:second?.contentLength ?? first?.contentLength ?? null,
        workerType:second?.contentType ?? first?.contentType ?? null,
        dimensionsMatch:Boolean(direct && second && direct.naturalWidth===second.naturalWidth && direct.naturalHeight===second.naturalHeight),
        aspectRatioDelta: direct && second && ar(direct) && ar(second) ? round(Math.abs(ar(direct)-ar(second))) : null
      });
    }
  }
  return out;
}

function homepageSummary(rows) {
  const out = [];
  for (const profile of PROFILES.map(p=>p.name)) {
    for (const mode of ['direct','worker']) {
      const rr = rows.filter(r=>r.profile===profile && r.mode===mode);
      out.push({
        profile,mode,runs:rr.length,
        medianLcpMs:round(median(rr.map(r=>r.lcpMs))),
        medianDclMs:round(median(rr.map(r=>r.dclMs))),
        medianLoadMs:round(median(rr.map(r=>r.loadMs))),
        medianObservedImageBytes:Math.round(median(rr.map(r=>r.observedImageBytes))||0),
        medianWorkerHits:round(median(rr.map(r=>r.workerHits))),
        medianWorkerMisses:round(median(rr.map(r=>r.workerMisses))),
        medianRewritten:round(median(rr.map(r=>r.rewritten))),
        medianFinalReadyRatio:round(median(rr.map(r=>r.finalReadyRatio)))
      });
    }
  }
  return out;
}

const browser = await chromium.launch({headless:true});
try {
  const health = await fetch(`${WORKER_BASE}/health`);
  if (!health.ok) throw new Error(`worker health ${health.status}`);
  console.log('WORKER_HEALTH', await health.text());
  const synthetic = await runSynthetic(browser);
  console.log('SYNTHETIC_RESULTS', JSON.stringify(synthetic,null,2));
  const homepage = await runHomepage(browser);
  console.log('HOMEPAGE_RESULTS', JSON.stringify(homepage,null,2));
  console.log('BENCHMARK_SUMMARY', JSON.stringify({
    generatedAt:new Date().toISOString(),
    synthetic:syntheticSummary(synthetic),
    homepage:homepageSummary(homepage)
  },null,2));
} finally {
  await browser.close();
}
