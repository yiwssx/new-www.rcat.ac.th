# Image delivery experiment — 2026-09-27

Status: isolated benchmark only. No production routing or Vercel alias changes were made as part of this benchmark.

## Test setup

- Production page under test: `https://www.rcat.ac.th/`
- Test image Worker: `https://rcat-image-test-v2.rcat-digital.workers.dev`
- Runner region: Azure East US
- Browser: Playwright Chromium
- Desktop profile: 1366×768, DPR 1, native runner network
- Mobile-like profile: 390×844, DPR 2, simulated 100 ms latency, 500,000 B/s down, 250,000 B/s up
- Homepage A/B used the same production HTML/SSR/JS. Worker mode intercepted only eligible `drive.google.com/thumbnail` requests in the test browser and rewrote them to the test Worker.
- IntroGate is disabled in production, so homepage LCP does not measure IntroGate. IntroGate images were tested separately as synthetic image-readiness cases.

## Synthetic image readiness

### Desktop-native

| Image | Width | Drive direct | Worker first (MISS) | Worker second (HIT) | Drive bytes | Worker bytes | Worker format |
|---|---:|---:|---:|---:|---:|---:|---|
| Intro — King Birthday | 1200 | 583.1 ms | 761.5 ms | 55.4 ms | 223,930 | 137,652 | WebP |
| Intro — Princess | 900 | 275.1 ms | 567.6 ms | 52.0 ms | 120,222 | 67,028 | WebP |
| Intro — Coronation | 1600 | 310.2 ms | 700.1 ms | 63.3 ms | 274,650 | 167,148 | WebP |
| Director | 512 | 401.6 ms | 692.3 ms | 29.0 ms | 441,843 | 22,164 | AVIF |

### Mobile 4G-like simulation

| Image | Width | Drive direct | Worker first (MISS) | Worker second (HIT) | Drive bytes | Worker bytes | Worker format |
|---|---:|---:|---:|---:|---:|---:|---|
| Intro — King Birthday | 900 | 694.9 ms | 669.5 ms | 318.1 ms | 155,857 | 100,708 | WebP |
| Intro — Princess | 640 | 437.8 ms | 536.6 ms | 210.3 ms | 75,787 | 45,772 | AVIF |
| Intro — Coronation | 1200 | 660.1 ms | 705.1 ms | 348.0 ms | 182,580 | 116,942 | WebP |
| Director | 384 | 772.0 ms | 495.4 ms | 153.5 ms | 272,234 | 17,973 | AVIF |

All tested transformed images preserved the same natural dimensions and aspect ratio as the Drive thumbnail at the same requested width.

## Homepage A/B

Four fresh-browser-context runs were collected for each mode/profile. The page was allowed to settle, then scrolled through to trigger lazy media.

| Profile | Mode | Median LCP | Median DCL | Median load | Observed image bytes | Rewritten Drive requests |
|---|---|---:|---:|---:|---:|---:|
| Desktop | Drive direct | 1,510 ms | 1,626.0 ms | 1,632.4 ms | 1,344,855 | 0 |
| Desktop | Worker | 1,362 ms | 1,081.6 ms | 1,088.4 ms | 634,823 | 35 |
| Mobile 4G-like | Drive direct | 2,440 ms | 2,659.4 ms | 2,805.3 ms | 1,353,968 | 0 |
| Mobile 4G-like | Worker | 1,972 ms | 2,278.8 ms | 2,285.3 ms | 542,980 | 24 |

Relative median changes for Worker mode:

- Desktop LCP: 148 ms lower (9.8%)
- Desktop DOMContentLoaded: 544.4 ms lower (33.5%)
- Desktop load event: 544.0 ms lower (33.3%)
- Desktop observed image bytes: 710,032 bytes lower (52.8%)
- Mobile-like LCP: 468 ms lower (19.2%)
- Mobile-like DOMContentLoaded: 380.6 ms lower (14.3%)
- Mobile-like load event: 520.0 ms lower (18.5%)
- Mobile-like observed image bytes: 810,988 bytes lower (59.9%)

Cold-cache behavior was also visible on the real homepage: desktop Worker run 1 produced 35 MISS responses; runs 2–4 produced 35 HIT responses each. On mobile-like run 1, 20 were MISS and 3 HIT because some width variants had already been warmed by earlier synthetic/desktop tests; subsequent mobile runs were all HIT for the intercepted variants.

## Findings

1. The Worker transformation path works with public Google Drive thumbnails.
2. Match-target source width avoids fetching a 1600px Drive source for small variants.
3. Edge cache behavior is confirmed as MISS then HIT.
4. Transformed payloads are substantially smaller, especially the director PNG converted to AVIF.
5. Warm Worker variants are materially faster in this runner; cold variants are mixed and can be slower than Drive direct.
6. The real homepage A/B showed lower image bytes and lower median LCP/load timings when Drive thumbnail requests were routed through the Worker.
7. This test does not prove Thailand field-user performance. The runner was in East US and the mobile profile is a synthetic throttle.
8. IntroGate remains a separate UX concern: even with a faster image path, it should not render a blocking loading state. A readiness-gated display remains appropriate.
9. Telemetry detail to clean up before production: the custom `x-rcat-image-format` header describes the requested format, but Cloudflare can return WebP when AVIF was requested. Production telemetry should name this field as requested format or derive the actual `Content-Type` instead.

## Production decision gate

No production cutover is implied by this experiment. Before changing production routing, review:

- whether use of the `workers.dev` hostname is acceptable under institutional policy;
- expected Cloudflare Images transformation usage/billing limits;
- field validation from Thailand after a controlled rollout;
- IntroGate readiness-gated behavior separately from image-origin routing.
