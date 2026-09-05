# Phase C Deep Field Verification

Status: active.

Started: 2026-09-04.

## Goal

Phase C extends the completed development-quality, field-QA, and operational-visibility baseline with deeper production verification without reopening P6 or introducing paid observability/browser services.

## C1 — Automated accessibility

Status: complete.

Completed: 2026-09-05.

The production Playwright suite audits representative public routes plus the unauthenticated Admin boundary on the existing desktop/mobile Chromium projects. The field audit is read-only and checks a bounded semantic baseline: document language/title, public h1 structure, image alt attributes, form-control labels, interactive accessible names, duplicate IDs, and positive tabindex values.

C1 reuses `.github/workflows/phase-a-production-browser-smoke.yml` and `playwright.production.config.ts`. No commercial browser service, production credential, or mutable CMS operation is required. Completion evidence is the successful exact-SHA production field run after PR #223, including the accessibility suite on desktop and mobile Chromium.

## C2 — Synthetic performance regression

Status: complete.

Completed: 2026-09-05.

C2 reuses the existing deployment-driven production Playwright pipeline and adds one bounded home-route synthetic check per existing desktop/mobile Chromium project. It records browser-native Time to First Byte, First Contentful Paint, DOMContentLoaded, and load-event timings after the exact `master` SHA is deployed by Vercel.

The fixed release guardrails are intentionally looser than the real-user Core Web Vitals objectives because GitHub-hosted runner network conditions are synthetic and variable. They detect gross release regressions rather than replace Vercel Speed Insights/Web Analytics or the existing static bundle budget:

- Time to First Byte: <= 5,000 ms
- First Contentful Paint: <= 7,000 ms
- DOMContentLoaded: <= 10,000 ms
- load event: <= 12,000 ms

The test remains read-only, serial (`workers: 1`), retry-bounded by the existing production Playwright configuration, and adds no paid performance service or new runtime telemetry.

Completion evidence is PR #224 merged to `master` at `443e82e2697e261b22ae671718bc5ee7274fd7fb`, successful master CI #1846, successful exact-SHA Vercel deployment, and successful Phase A Production Browser Smoke #38. The production field suite passed 16/16 tests. C2 measurements were:

- desktop Chromium: TTFB 56.4 ms, FCP 212 ms, DOMContentLoaded 268.6 ms, load 282.5 ms;
- mobile Chromium: TTFB 32.5 ms, FCP 184 ms, DOMContentLoaded 258 ms, load 272 ms.

## C3 — Authenticated disposable CMS field test

Status: implementation complete; production validation pending.

C3 is deliberately separated from the automatic read-only Phase A suite. `.github/workflows/phase-c3-authenticated-cms-field.yml` is manual, master-only, and protected by the existing `production` Environment because it performs tightly bounded production writes.

The workflow does not use a normal Admin credential. It uses the existing protected Cloudflare production infrastructure credentials to create a run-scoped, non-root `editor` identity with a random one-run password. The password is masked immediately and is never committed, uploaded, or retained after the workflow.

The browser flow uses `playwright.phase-c3.config.ts` with one desktop Chromium worker and no retries. It verifies:

- real `/login` authentication with the disposable editor;
- creation of a uniquely prefixed disposable content record;
- the Facebook-thumbnail failure path continuing through Save and surfacing the successful-save warning;
- publishing and verification through `/api/public/content/:slug` plus the public `/content/:slug` page;
- deletion through the CMS and removal from the public read path;
- session-cookie removal returning the browser to the login boundary.

The thumbnail source intentionally uses a non-Facebook `.invalid` URL while the content template is `Facebook Embed`. The server rejects that source before any Facebook fetch or media persistence, making the fallback deterministic and ensuring C3 cannot leave an uploaded media artifact.

Infrastructure cleanup runs with `always()` and hard-deletes the exact run-scoped content slug and non-root QA user. A final D1 count query requires the QA user, credential, session, and content counts all to be zero. Immutable Admin audit-log events are intentionally retained as operational evidence, not as live QA data.

C3 must not be marked complete until the implementation is merged, repository CI is green, the exact merge SHA is deployed by Vercel, the protected C3 workflow passes on `master`, and its final deterministic cleanup verification succeeds.

## Closure rule

Phase C closes only when C1, C2, and C3 have merged implementation plus passing repository/field evidence, with deterministic cleanup for every mutable C3 test artifact.
