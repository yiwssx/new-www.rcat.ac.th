# Controlled public image delivery rollout — 2026-09-27

Updated: 2026-09-28.

Status: production rollout active for the bounded `portrait`, `carousel`, and `intro-gate` intents.

## Proven baseline

The preceding isolated benchmark showed lower transferred image bytes and lower median page timings when eligible Google Drive thumbnails were routed through the Cloudflare image Worker. The benchmark also confirmed that cold variants can be slower than Drive direct, while warmed variants are materially faster.

The production Worker identity is now:

```text
https://rcat-image-production.rcat-digital.workers.dev
```

The earlier `rcat-image-test` workers.dev endpoint was used during isolated validation and is no longer the configured frontend production endpoint.

## Runtime switches

The production build enables the bounded rollout with:

```text
VITE_PUBLIC_IMAGE_DELIVERY_BASE_URL=https://rcat-image-production.rcat-digital.workers.dev
VITE_PUBLIC_IMAGE_DELIVERY_INTENTS=portrait,carousel,intro-gate
```

`VITE_PUBLIC_IMAGE_DELIVERY_INTENTS=*` remains supported for a later deliberate full rollout, but is not the current production policy.

Removing either variable returns public rendering to direct Google Drive thumbnails after the next frontend deployment.

## Current rollout scope

- `portrait`: director image
- `carousel`: homepage carousel desktop/mobile images
- `intro-gate`: mandatory IntroGate image

Other public image intents remain direct Drive until explicitly enabled.

## Failure behavior

For an enabled Google Drive image intent:

1. Browser requests the Cloudflare Worker variant.
2. If that image request fails, the image component retries the same Drive file at the same responsive width directly from Google Drive.
3. Only after both paths fail does the UI expose its final image fallback state.

Carousel implements the same Worker-to-Drive fallback for its `<picture>` path.

## Publish-time warmup

CMS writes perform best-effort warmup before the corresponding Cloudflare write:

- site settings -> director `portrait` variants;
- homepage settings -> enabled `intro-gate` variants;
- carousel slide -> desktop and mobile `carousel` variants.

Warmup failures are counted internally by the helper but do not block ordinary CMS writes because the direct-Drive fallback remains available. An enabled IntroGate is stricter: its image URL must first resolve to a renderer-safe public image source or the settings write is rejected.

## Mandatory IntroGate contract

IntroGate is not optional when its CMS setting is enabled.

- The full-screen gate continues to own page interaction and scroll lock.
- No `กำลังโหลดภาพประชาสัมพันธ์` copy is rendered.
- While the current image is pending, a neutral visual shell is shown.
- Entry and secondary actions do not appear until the current IntroGate image has loaded successfully.
- Worker failure first retries the same image through Google Drive.
- If both delivery paths fail, the gate remains in place and exposes a retry action; it does not allow bypass into the website.
- Session dismissal behavior remains unchanged after a successful image load and explicit user entry.

## Worker telemetry

The production Worker exposes:

- `x-rcat-image-production`
- `x-rcat-image-width`
- `x-rcat-image-source-width`
- `x-rcat-image-requested-format`
- `x-rcat-image-format` (actual returned `Content-Type` format)
- `server-timing`
- Cloudflare cache headers such as `CF-Cache-Status`

Its `/health` endpoint must return `service: "rcat-image-production"` and `status: "ok"` before frontend production routing is changed.

## Production gate

The production rollout requires:

- frontend format/lint;
- unit and integration tests;
- production build;
- public media governance;
- image Worker typecheck and Wrangler dry-run;
- successful production Worker deploy and `/health` smoke;
- IntroGate Playwright functional regression;
- post-merge Vercel Production Verification for runtime-impacting frontend changes.

Validate Vercel Speed Insights/RUM for representative Thailand traffic before expanding beyond the three current intents.
