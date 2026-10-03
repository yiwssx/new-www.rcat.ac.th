# Phase C Deep Field Verification

Status: complete.

Started: 2026-09-04.

Completed: 2026-09-07.

Operational maintenance reviewed: 2026-10-03.

## Goal

Phase C extends the completed development-quality, field-QA, and operational-visibility baseline with deeper production verification without reopening P6 or introducing paid observability/browser services.

## C1 — Automated accessibility

Status: complete.

Completed: 2026-09-05.

The production Playwright suite audits representative public routes plus the unauthenticated Admin boundary on the existing desktop/mobile Chromium projects. The field audit is read-only and checks a bounded semantic baseline: document language/title, public h1 structure, image alt attributes, form-control labels, interactive accessible names, duplicate IDs, and positive tabindex values.

C1 now runs through the consolidated `.github/workflows/production-verification.yml` browser-smoke path with `playwright.production.config.ts`. The former standalone Phase A workflow is historical and intentionally absent from the current workflow inventory. No commercial browser service, production credential, or mutable CMS operation is required.

Historical completion evidence is the successful exact-SHA production field run after PR #223, including the accessibility suite on desktop and mobile Chromium.

## C2 — Synthetic performance regression

Status: complete.

Completed: 2026-09-05.

C2 remains inside the consolidated deployment-driven production Playwright path and adds one bounded home-route synthetic check per existing desktop/mobile Chromium project. Current automatic verification follows successful `main` CI and the matching Vercel deployment when a runtime deployment is required.

The fixed release guardrails are intentionally looser than the real-user Core Web Vitals objectives because GitHub-hosted runner network conditions are synthetic and variable. They detect gross release regressions rather than replace Vercel Speed Insights/Web Analytics or deterministic build evidence:

- Time to First Byte: <= 5,000 ms
- First Contentful Paint: <= 7,000 ms
- DOMContentLoaded: <= 10,000 ms
- load event: <= 12,000 ms

The test remains read-only, serial (`workers: 1`), retry-bounded by the production Playwright configuration, and adds no paid performance service or new runtime telemetry.

Historical completion evidence is PR #224 merged to the then-default `master` branch at `443e82e2697e261b22ae671718bc5ee7274fd7fb`, successful CI #1846, successful exact-SHA Vercel deployment, and successful Phase A Production Browser Smoke #38. The production field suite passed 16/16 tests. C2 measurements were:

- desktop Chromium: TTFB 56.4 ms, FCP 212 ms, DOMContentLoaded 268.6 ms, load 282.5 ms;
- mobile Chromium: TTFB 32.5 ms, FCP 184 ms, DOMContentLoaded 258 ms, load 272 ms.

## C3 — Authenticated disposable CMS field test

Status: complete.

Completed: 2026-09-07.

C3 is deliberately separated from automatic read-only Production Verification. The former standalone `.github/workflows/phase-c3-authenticated-cms-field.yml` workflow is retired. Its protected manual operation now lives in `.github/workflows/production-data-operations.yml` as operation `authenticated-cms-field`.

The current C3 operation is manual, `main`-only, and protected by the existing `production` Environment because it performs tightly bounded production writes.

The operation does not use a normal Admin credential. It uses existing protected Cloudflare production infrastructure credentials to create a run-scoped, non-root `editor` identity with a random one-run password. The password is masked immediately and is never committed, uploaded, or retained after the run.

The browser flow uses `playwright.phase-c3.config.ts` with one desktop Chromium worker and no retries. It verifies:

- real `/login` authentication with the disposable editor;
- creation of a uniquely prefixed disposable content record;
- the Facebook-thumbnail failure path continuing through Save and surfacing the successful-save warning;
- publishing and verification through the production public `/content/:slug` SSR path;
- deletion through the CMS and a resulting `404` from the same production public route;
- session-cookie removal returning the browser to the login boundary.

The production Vercel app does not expose `/api/public/*` as a same-origin rewrite. Public structured-data requests use the configured Cloudflare Worker origin (`CLOUDFLARE_PUBLIC_API_URL` server-side and `VITE_CLOUDFLARE_PUBLIC_API_URL` in browser code). Phase C3 therefore verifies public visibility through the real SSR route instead of fabricating a same-origin `/api/public/content/:slug` request that production does not serve.

Dynamic public content detail responses use a no-store policy so publish/delete verification observes the current Worker/D1 state rather than stale CDN content.

The thumbnail source intentionally uses a non-Facebook `.invalid` URL while the content template is `Facebook Embed`. The server rejects that source before any Facebook fetch or media persistence, making the fallback deterministic and ensuring C3 cannot leave an uploaded media artifact.

Infrastructure cleanup runs with `always()` and hard-deletes the exact run-scoped content slug and non-root QA user. A final D1 count query requires the QA user, credential, session, and content counts all to be zero. Immutable Admin audit-log events are intentionally retained as operational evidence, not as live QA data.

Historical completion evidence is Phase C3 Round 19, GitHub Actions run `34126501500`, on exact then-default `master` SHA `88ef27396472d618fbf2091c4bab0255c4d31397`. The browser field test passed, deterministic cleanup passed, and zero-row verification passed for user, credential, session, and content records.

After Phase C closure, C3 remains available only as the deliberate `authenticated-cms-field` operation in Production Data Operations. It is not automatically dispatched by normal Worker production releases or Production Verification.

## Closure rule

Phase C closes only when C1, C2, and C3 have merged implementation plus passing repository/field evidence, with deterministic cleanup for every mutable C3 test artifact.

This closure rule is satisfied. Phase C is complete as of 2026-09-07. Current workflow consolidation changes only operational ownership, not that historical closure decision.
