# Current Runtime Ownership

Updated: 2026-08-04.

This document is the current source of truth for runtime ownership. Historical migration milestone documents remain evidence of earlier states; when they conflict with this file about current ownership, authentication boundaries, or provider responsibilities, this file takes precedence.

## Runtime Map

```mermaid
flowchart LR
  Browser[React/Vite browser]
  Vercel[Vercel frontend + same-origin proxies]
  Worker[Cloudflare Worker]
  D1[(D1)]
  Apps[Apps Script media/file bridge]
  Drive[(Google Drive)]

  Browser --> Vercel
  Vercel --> Worker
  Worker --> D1
  Vercel --> Apps
  Apps --> Drive
```

## Public Structured Data

Owner: Cloudflare Worker + D1.

## Admin Structured Data

Owner: Cloudflare Worker + D1. Admin structured mutations remain revision-aware and capability-protected. The browser reaches privileged Admin APIs through same-origin Vercel proxy routes.

## CMS Authentication

CMS Sessions are the application Admin identity.

Vercel reads the CMS Session cookie and forwards the internal CMS proxy contract. It does not authorize by a browser-supplied role.

The Worker remains authoritative for Session validity, active user status, role/capability, Session version, MFA state, CSRF, step-up assurance, and audit actor. Role/status/capabilities are derived from validated D1 state.

## CMS Session Lifetime

Current policy:

- idle timeout: 30 minutes;
- absolute lifetime: 8 hours;
- touch threshold: 5 minutes.

The Admin frontend supports activity-aware keepalive so genuine local editing can cause throttled Session refresh while the page is visible. An unattended open tab must still become idle. Absolute lifetime remains server-enforced.

See `docs/cms-auth-session-lifecycle.md`.

## Admin Proxy 401 Contract

A genuine `CMS session is invalid or expired` response can invalidate frontend auth state.

Known non-Session authentication failures must not be blindly normalized into Session expiration. Temporary network and `5xx` failures must not automatically destroy a still-valid frontend Session.

## Admin Menu

Persistence: D1 `menu_items`.

Relationship: `parent_id`.

Public representation: nested `children`.

Admin UX: hierarchical tree, readable parent names, internal IDs hidden from routine editing, explicit paths preserved, and no automatic `/content/` prefix.

See `docs/admin/admin-menu-management.md`.

## Media and Files

Owner: Apps Script media/file bridge + Google Drive storage.

Apps Script is not the structured-data backend and must not be restored as a browser-side structured-data provider.

## Sitemap

Owner: Vercel `/api/sitemap`; public route `/sitemap.xml`; data source Cloudflare Public API / D1-backed structured data.

The runtime sitemap contains only the known indexable Public route set plus published canonical content URLs in the `/content/$slug` namespace. Search, Admin/Auth/API surfaces, legacy `/$slug` permalinks, menu aliases, drafts, and content with an external absolute canonical are excluded. Program content is sourced from the Public programs contract alongside News, Announcements, and Blog content.

## SSR Readiness

The production frontend remains CSR-only until the dedicated SSR implementation path is explicitly enabled in Vercel.

Runtime construction is factory-based so a server renderer can create isolated state per request:

- `createAppQueryClient()` creates a new TanStack Query `QueryClient` with the existing project query defaults;
- `createAppRouter()` creates a new TanStack Router instance from the static route tree and receives that runtime's QueryClient through typed context;
- `createAppEmotionCache()` creates an explicit Emotion cache using the stable `css` namespace;
- `createAppRuntime()` creates one fresh Emotion cache, QueryClient, and Router for each browser runtime or server request;
- `App` no longer owns module-scope runtime singletons.

Public structured reads expose reusable TanStack Query option factories for Home, CMS shell snapshot, content lists, content detail, programs, search index, events, and documents. Existing React hooks consume those same factories and add browser-only local-storage `initialData`/freshness behavior at the hook boundary. Public route loaders call `ensureQueryData()` with those same factories, keys, query functions, stale times, and cache policies rather than creating a second server-side data store.

The reusable query factories are cancellable by default: they consume TanStack Query's `AbortSignal` and forward it to the underlying Cloudflare `fetch`. Existing browser hooks deliberately use the same factories with `consumeAbortSignal: false`. This preserves the established browser behavior where an in-flight query survives a transient inactive observer while server/loaders and explicit cancellable query consumers retain end-to-end request cancellation.

Public read failures use the shared `PublicReadError` taxonomy: `aborted`, `network`, `http`, `invalid-json`, or `invalid-response`, with HTTP status, backend message, and existing diagnostic/migration detail retained where available. Phase 6 keeps raw error objects out of Router loader serialization: a failed Public prefetch becomes a small JSON-safe `503` marker, and the SSR response boundary promotes an otherwise successful shell response to HTTP `503` with `Retry-After`, `Cache-Control: no-store`, and `X-Robots-Tag: noindex, nofollow`. Missing content detail uses TanStack Router `notFound()` for HTTP `404`, while a valid legacy `/$slug` permalink resolves the content first and then permanently redirects with HTTP `301` to `/content/$slug`.

Live visitor statistics remain intentionally browser-oriented polling rather than an SSR loader dependency. Their request consumes query cancellation, and Step 6 explicitly disables the live polling query when no browser runtime exists so the server-visible value remains the prefetched snapshot.

Public list URL state is owned by TanStack Router. Route search validators normalize `page`, `announcementsPage`, `pagesPage`, `tag`, `category`, and `q` where applicable, while unrelated query parameters are preserved. Public pagination and filter rendering reads the router location instead of `window.location.search`, and pagination writes use TanStack navigation instead of custom `window.history`/event synchronization. This keeps request URL state deterministic between server rendering and browser hydration.

Public API contract readiness separates list/search/home summaries from full content detail. Summary reads omit article body fields, and content detail retains the full body plus only media rows referenced by that item. Paginated public content-list requests execute D1 `COUNT(*)` plus `LIMIT/OFFSET` reads instead of loading the complete matching dataset and slicing it in Worker memory. The Public page collection embedded in `/announcements` is independently D1-paginated through `pagesPage`/`pagesPageSize` and returns `pageItemsPagination`. Search supports the same D1-backed pagination boundary. Search and content-list metadata reads are scoped to lightweight shell metadata, and media reads are ID-scoped rather than full-table reads. `/api/public/shell` exposes only site/homepage/display/menu metadata, with the frontend 404 fallback to the home metadata projection retained for incremental Worker rollout.

Step 5 makes the route-level PublicSiteShell the authoritative shell renderer. Nested page-level PublicSiteShell instances render their children on the first render pass and no longer gate page HTML on a client registration effect. Their remaining registration is a client-side enhancement for page-specific metadata and preloaded shell props only. The route shell reads the lightweight `/api/public/shell` query through a dedicated Public shell hook, including on the home route. Until shell settings resolve, page media stays gated so an enabled Intro Gate cannot be bypassed by first-pass page rendering.

Step 6 makes browser-sensitive Public presentation deterministic across a server render and the hydrating browser. Production Home sections no longer depend on IntersectionObserver to exist in the semantic first-pass tree; `content-visibility` and Suspense remain performance/layout tools without removing their content from the render contract. The Home Carousel has a deterministic static first-pass boundary seeded from snapshot `generatedAt` time and becomes the interactive Carousel only after a client effect. Intro Gate initial visibility is derived only from its settings, while sessionStorage dismissal is reconciled after mount. Event lifecycle labels are seeded from snapshot `generatedAt` and move to the live browser clock after mount. Normal Public images remain semantic `<img>` elements and use native lazy loading/low priority rather than suppressing `src` until an IntersectionObserver fires. Heavy iframe/embed resources remain eligible for explicit near-viewport activation.

Step 7 moves baseline document-head ownership into TanStack Router route `head` descriptors and renders `HeadContent` from the root route layout. Static Public routes own baseline title, description, and canonical URL at route-match time; indexable archive routes derive canonical pagination from validated Router search state. Normalized page 2+ values are self-referencing, page 1/invalid values collapse to the base route, and filter/tracking parameters are not copied into pagination canonicals. `/announcements` preserves independent `announcementsPage` and `pagesPage` channels in canonical order. Search remains `noindex,follow`; CMS Auth/Admin remains `noindex,nofollow`. Both content URL forms establish `/content/$slug` as the baseline canonical path. The root route is canonical-neutral so Public canonical metadata cannot leak into CMS/Admin routes.

## SSR/SEO Implementation Runtime

Implementation Phase 1 adds a request-scoped non-streaming server renderer. `entry-server.tsx` accepts a Web `Request`, `createRequestHandler` binds the request to a fresh Router/QueryClient runtime, and `RouterServer` + `renderRouterToString` produce route-aware HTML. The server bundle can be built independently with `pnpm build:ssr:foundation`. This renderer is not yet wired into production Vercel routing.

Implementation Phase 2 makes matched Public routes own server prefetch timing. The Public layout prefetches shell data; Public pages prefetch the exact reusable query factories they already consume; Search and Announcements use normalized loader dependencies for URL-specific query keys; both content URL forms prefetch detail plus the supporting CMS snapshot. Loader factories are dynamically imported to avoid pulling the Public data layer into the synchronous browser entry graph.

Implementation Phase 3 carries successful Public Query state across the server/client boundary. TanStack Router `dehydrate` calls TanStack Query `dehydrate()` on the request-local QueryClient and only permits known Public query-key roots. Mutations are excluded. The resulting Query state is normalized through a JSON-safe DTO before entering the Router serializer, which both satisfies the Router serializability contract and prevents arbitrary non-JSON values from crossing the Public SSR boundary. The Router `hydrate` callback restores that state into the browser runtime's QueryClient before hydrated route hooks consume it.

Implementation Phase 4 makes MUI/Emotion styling request-scoped and SSR-safe. Shared providers now wrap the application in Emotion `CacheProvider`, and the server creates `createEmotionServer(cache)` against that request's cache before rendering. After the existing non-streaming Router response is produced, the server extracts the styles used by that render and emits critical `data-emotion` style tags before rendered markup, preferring the document head when one exists. The browser uses the same cache key and creates its Emotion cache before `hydrateRoot()`, allowing the server style ids to be adopted rather than creating a competing namespace. Response body rewriting preserves status and headers while dropping stale `content-length`.

Implementation Phase 5 promotes the Step 7 baseline head model into loader-driven Public SEO. The Public layout owns the current site identity, default social image, and `EducationalOrganization` JSON-LD; Home adds `WebSite` JSON-LD; archive routes add Open Graph, Twitter, locale, and breadcrumb metadata while retaining validated canonical pagination; Search stays `noindex,follow` with a stable `/search` canonical and a query-aware display title. Content detail loaders still prefetch the existing detail and CMS snapshot queries, but expose only a lightweight head projection (`item`, `siteSettings`, and referenced `featuredMedia`) instead of serializing the full supporting CMS snapshot again. Detail metadata prioritizes CMS `seoTitle`, `seoDescription`, and `canonicalUrl`, uses featured media with the site hero as fallback, emits article dates/section for News/Blog/Announcement, and renders `NewsArticle`/`Article`/`WebPage` plus `BreadcrumbList` JSON-LD. Inline JSON-LD escapes `<`, and the heavy SEO implementation is dynamically imported behind `publicRouteHead.ts` so structured-data/image-resolution logic stays out of the synchronous browser entry graph.

Implementation Phase 6 makes HTTP and indexing semantics explicit. Published canonical content remains `200`; missing content detail is a Router-native `404`; valid legacy `/$slug` requests receive a permanent `301` to `/content/$slug`; and Public loader failures are promoted to `503` without exposing raw backend error objects in serialized loader data. Error responses are `no-store` and carry response-level noindex protection, with `Retry-After: 300` on `503`. Search receives `X-Robots-Tag: noindex, follow`, while CMS/Auth/Admin surfaces receive `noindex, nofollow` in addition to their document-head metadata. The runtime sitemap now emits only indexable static Public routes and published `/content/$slug` URLs, and `robots.txt` blocks CMS/Auth/API crawling while intentionally leaving Search crawlable so crawlers can observe its noindex directive.

The browser entry has a deliberate dual bootstrap. When `#root` already contains server-rendered markup, it uses React `hydrateRoot()` with TanStack Router `RouterClient`; when `#root` is empty, it retains the existing `createRoot()` CSR path. Both paths use the same Emotion cache factory. This allows hydration, critical-CSS, dynamic-head, HTTP, and indexing behavior to be implemented and validated before production routing is switched to the server renderer.

Production is still **not** considered SSR-enabled. Vercel continues to serve the current CSR application until Phase 7. The remaining work is production SSR routing, successful-response CDN cache policy, production crawler/smoke validation, and the explicit cutover.

See `docs/architecture/ssr-implementation-phases.md`.

## Deployment Boundaries

- frontend/UI -> Vercel
- Vercel proxy/function -> Vercel
- Worker source/config -> Cloudflare Worker
- D1 schema -> D1 migration
- Apps Script `.gs` -> Apps Script
- docs/tests only -> no runtime deployment

See `docs/deployment/runtime-deployment-guide.md`.

## Toolchain

Current repository contract:

- Node `24.x`
- pnpm `10.34.5`

Any document that still describes Node 22 as current is stale historical text.

## Security Boundary

Do not place CMS Session tokens, passwords, TOTP secrets/codes, Recovery Codes, encryption keys, proxy shared secrets, Apps Script bridge tokens, production D1 IDs, or private deployment identifiers in browser code, docs, issues, commits, or chat logs.

## Historical Documentation

`docs/architecture/current-migration-status.md` and `docs/architecture/m20-cleanup-runtime-ownership.md` retain historical value but are not the current ownership source when they contain older provider/auth/toolchain descriptions.
