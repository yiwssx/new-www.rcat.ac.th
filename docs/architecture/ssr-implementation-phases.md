# SSR/SEO Implementation Phases

Updated: 2026-08-04.

The seven SSR-readiness steps are complete on the integration line. SSR/SEO implementation is tracked separately as seven production phases so readiness work is not confused with runtime activation.

## Phase 1 — SSR Runtime Foundation

Status: implemented on the SSR integration line.

- `createAppRuntime()` creates a fresh Emotion cache, TanStack Query `QueryClient`, and TanStack Router for each browser runtime or server request.
- Router context receives the exact request-local QueryClient.
- `entry-server.tsx` accepts a Web `Request` and renders through TanStack Router `createRequestHandler`, `RouterServer`, and non-streaming `renderRouterToString`.
- Request-local Router/Query state is isolated between server requests.
- `pnpm test:ssr:foundation` and `pnpm build:ssr:foundation` validate the foundation.

## Phase 2 — Public Route Data Loading / Server Prefetch Ownership

Status: implemented on the SSR integration line.

- Matched Public routes own server prefetch timing through route loaders.
- The Public layout prefetches `/api/public/shell`; Home, archives, programs, documents, events, Search, Contact, and content detail prefetch the same reusable query factories already consumed by their React hooks.
- Search and Announcements use normalized loader dependencies so URL-specific query keys remain identical across server and browser.
- Query factories are dynamically imported to avoid pulling the Public data layer into the synchronous browser entry graph.
- Phase 6 converts loader-query failures into a JSON-safe upstream-failure marker instead of serializing raw error objects.

## Phase 3 — Query Dehydration / Browser Hydration

Status: implemented on the SSR integration line.

- TanStack Query `dehydrate()` serializes successful known-Public query roots from the request-local QueryClient.
- Router hydration restores that state before hydrated route hooks consume it.
- Mutations and unrelated/future privileged query roots are excluded.
- Query state crosses the Router serializer through an explicit JSON-safe DTO boundary.
- The browser supports SSR hydration and retains a CSR fallback for non-SSR surfaces.

## Phase 4 — MUI/Emotion SSR Styling + Critical CSS

Status: implemented on the SSR integration line.

- Server and browser use the same stable Emotion cache key (`css`).
- Emotion cache state is request-scoped on the server.
- Non-streaming SSR extracts critical styles with the request-local cache and injects `data-emotion` style tags into the document head when available.
- The browser creates its Emotion cache before hydration so server style ids are adopted rather than duplicated.
- Response status/headers are preserved while stale `content-length` is removed after HTML rewriting.

## Phase 5 — Full Dynamic SEO + Social Metadata + Structured Data

Status: implemented on the SSR integration line.

- Public route head metadata is loader-driven and shared by SSR and browser navigation.
- CMS `seoTitle`, `seoDescription`, and `canonicalUrl` have priority on content detail.
- Open Graph, Twitter Card, locale, article dates/section, featured-media social image, and site-hero fallback are supported.
- Structured data includes `EducationalOrganization`, `WebSite`, `BreadcrumbList`, `NewsArticle`, `Article`, and `WebPage` as appropriate.
- Search remains `noindex,follow` with a stable `/search` canonical.
- Inline JSON-LD escapes less-than characters to prevent CMS text from terminating the script element.
- Heavy SEO implementation remains dynamically imported to protect the synchronous client budget.

## Phase 6 — HTTP Status + Canonical Redirects + Indexing + Sitemap + Robots

Status: implemented on the SSR integration line.

- Published canonical content at `/content/$slug` returns HTTP `200`.
- Missing/unpublished Public content uses Router-native HTTP `404`.
- Valid legacy `/$slug` resolves the content first, then permanently redirects with HTTP `301` to `/content/$slug`; missing legacy slugs remain `404`.
- Public upstream failures become HTTP `503 Service Unavailable` with `Retry-After: 300`, `Cache-Control: no-store`, and `X-Robots-Tag: noindex, nofollow`.
- All `4xx`/`5xx` SSR responses are no-store and protected from indexing.
- Search receives response-level `noindex, follow`; CMS/Auth/Admin receives `noindex, nofollow`.
- Runtime sitemap emits the explicit indexable Public route set plus published canonical `/content/$slug` URLs only, including Public programs; Search, drafts, legacy aliases, Admin/Auth/API, menu aliases, and local copies with an external canonical are excluded.
- `robots.txt` permits Public crawling, blocks Admin/Auth/API surfaces, advertises `/sitemap.xml`, and leaves Search crawlable so its noindex directive can be observed.

## Phase 7 — Vercel Routing + Cache Policy + Production Validation + SSR Cutover

Status: implementation complete on the Phase 7 cutover branch. It becomes live production behavior only after the SSR integration line is explicitly promoted to `master` and Vercel successfully deploys it.

Phase 7 completes the deployable SSR boundary:

- `api/ssr.ts` exposes a Web-standard Vercel Function backed by the existing `renderSsrResponse()` pipeline.
- Vercel rewrites Public application routes to the SSR Function while Login/Activation/Reset/Admin stay on the CSR application.
- The SSR renderer emits a complete `html/head/body` document, Router hydration state, dynamic SEO, structured data, Emotion critical CSS, and deterministic client JS/CSS asset references.
- SSR documents carry `data-rcat-ssr="true"`; the browser hydrates those documents at the document root with `hydrateRoot(document, ...)`. The Admin/Auth CSR fallback retains the empty-`#root` `createRoot()` path.
- Production client assets use deterministic entry names `/assets/rcat-client.js` and `/assets/rcat-client.css`; hashed lazy chunks remain hashed.
- Vercel build output renames Vite's `dist/index.html` to `dist/csr.html` and removes `dist/index.html`, preventing Vercel filesystem precedence from bypassing the Public SSR catch-all. `csr.html` is retained only for Admin/Auth CSR routes.
- Public SSR can consume server-only `PUBLIC_API_PROVIDER` / `CLOUDFLARE_PUBLIC_API_URL` aliases while continuing to support the existing `VITE_*` names.
- Successful indexable Public SSR responses use browser revalidation plus `Vercel-CDN-Cache-Control: public, max-age=300, stale-while-revalidate=86400`.
- Search and error responses remain `no-store`.
- Permanent legacy redirects use browser revalidation and a longer Vercel CDN policy (`max-age=86400, stale-while-revalidate=604800`).
- Unexpected SSR adapter failures return a protected HTTP `503` rather than exposing implementation details.
- GET and HEAD are supported by the Public SSR adapter; unsupported methods receive `405`.

Phase 7 validation covers complete no-JavaScript server HTML, semantic content, hydration assets, Search indexing/cache policy, legacy redirects, HEAD behavior, Vercel routing, deterministic build output, client/SSR/function bundling, and the earlier SSR/SEO regression suite.

A Vercel Preview deployment was requested through a temporary `preview-*` branch, but Vercel rejected that deployment because the account hit the Free-plan build-rate limit (`upgradeToPro=build-rate-limit`). This is a platform quota condition, not a code/build failure. A live Vercel crawler smoke therefore remains a deployment-time gate when quota/deployment capacity is available.

## Completion / production activation

All seven SSR/SEO implementation phases are complete in code once Phase 7 is merged into `refactor/ssr-readiness`.

That does **not** by itself change the live website. Production cutover occurs only when the user explicitly promotes the completed integration branch to `master`, Vercel deploys that commit successfully, and the live smoke checks in `docs/operations/public-ssr-cutover.md` pass.

Until that explicit promotion, the currently deployed `master` remains the production source of truth.
