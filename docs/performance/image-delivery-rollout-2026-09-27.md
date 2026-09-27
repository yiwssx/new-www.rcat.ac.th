# Controlled public image delivery rollout — 2026-09-27

Status: experimental branch only. No production environment variables, Vercel aliases, or production routing are changed by this document.

## Proven baseline

The preceding isolated benchmark showed lower transferred image bytes and lower median page timings when eligible Google Drive thumbnails were routed through the Cloudflare image Worker. The benchmark also confirmed that cold variants can be slower than Drive direct, while warmed variants are materially faster.

## Runtime switches

The frontend routing is disabled by default. It becomes active only when both variables are configured at build time:

```text
VITE_PUBLIC_IMAGE_DELIVERY_BASE_URL=https://rcat-image-test.rcat-digital.workers.dev
VITE_PUBLIC_IMAGE_DELIVERY_INTENTS=portrait,carousel,intro-gate
```

`VITE_PUBLIC_IMAGE_DELIVERY_INTENTS=*` is supported for a later full rollout, but is not the initial rollout target.

Removing either variable returns public rendering to direct Google Drive thumbnails after the next frontend deployment.

## Initial rollout scope

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

The Worker exposes:

- `x-rcat-image-width`
- `x-rcat-image-source-width`
- `x-rcat-image-requested-format`
- `x-rcat-image-format` (actual returned `Content-Type` format)
- `server-timing`
- Cloudflare cache headers such as `CF-Cache-Status`

## Production gate

Do not enable production routing until the isolated rollout branch passes:

- frontend format/lint;
- unit and integration tests;
- production build;
- public media governance;
- image Worker typecheck and Wrangler dry-run;
- IntroGate Playwright functional regression.

After production enablement, validate Vercel Speed Insights/RUM for Thailand traffic before expanding beyond the three initial intents.
