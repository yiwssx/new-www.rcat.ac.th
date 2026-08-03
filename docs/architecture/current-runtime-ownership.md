# Current Runtime Ownership

Updated: 2026-08-03.

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

## SSR Readiness

The production frontend remains CSR-only until the dedicated SSR implementation phase is explicitly enabled.

Runtime construction is factory-based so a future server renderer can create isolated state per request:

- `createAppQueryClient()` creates a new TanStack Query `QueryClient` with the existing project query defaults;
- `createAppRouter()` creates a new TanStack Router instance from the static route tree;
- the browser entrypoint creates one QueryClient and one Router instance for the browser runtime and injects both into `App`;
- `App` no longer owns module-scope runtime singletons.

Public structured reads now expose reusable TanStack Query option factories for Home, CMS shell snapshot, content lists, content detail, programs, search index, events, and documents. Existing React hooks consume those same factories and add browser-only local-storage `initialData`/freshness behavior at the hook boundary. A future route loader can therefore call `ensureQueryData()` with the same key, query function, stale time, and cache policy without importing a React hook.

The reusable query factories are cancellable by default: they consume TanStack Query's `AbortSignal` and forward it to the underlying Cloudflare `fetch`, which is the policy intended for future route-loader/request ownership. Existing browser hooks deliberately use the same factories with `consumeAbortSignal: false`. This preserves the established browser behavior where an in-flight query survives a transient inactive observer (including React StrictMode's development remount) and is reused instead of issuing a duplicate network request. The Public API layer itself remains signal-aware, so server/loaders and explicit cancellable query consumers retain end-to-end request cancellation.

Public read failures use the shared `PublicReadError` taxonomy: `aborted`, `network`, `http`, `invalid-json`, or `invalid-response`, with HTTP status, backend message, and existing diagnostic/migration detail retained where available. Endpoint-specific legacy HTTP message semantics are preserved explicitly: content-style reads may expose the backend message while document/event list clients keep their established generic HTTP status message. Cancellation is not treated as a live visitor-stat outage/backoff event.

Live visitor statistics remain intentionally browser-oriented polling rather than an SSR loader dependency. Their request consumes query cancellation, and Step 6 explicitly disables the live polling query when no browser runtime exists so the server-visible value remains the prefetched snapshot.

Public list URL state is now owned by TanStack Router. Route search validators normalize `page`, `announcementsPage`, `pagesPage`, `tag`, `category`, and `q` where applicable, while unrelated query parameters are preserved. Public pagination and filter rendering reads the router location instead of `window.location.search`, and pagination writes use TanStack navigation instead of custom `window.history`/event synchronization. This makes request URL state deterministic between a future server render and the hydrating browser without changing the current CSR deployment mode.

Public API contract readiness separates list/search/home summaries from full content detail. Summary reads omit article body fields, and content detail retains the full body plus only media rows referenced by that item. Paginated public content-list requests now execute D1 `COUNT(*)` plus `LIMIT/OFFSET` reads instead of loading the complete matching dataset and slicing it in Worker memory. The Public page collection embedded in `/announcements` is independently D1-paginated through `pagesPage`/`pagesPageSize` and returns `pageItemsPagination`, so changing that route page issues a page-specific TanStack Query request rather than loading every published `type=page` row. Search supports the same D1-backed pagination boundary; the current Public Search page requests one Worker-owned page at a time while preserving `q` and `page` in TanStack Router state. Search and content-list metadata reads are scoped to lightweight shell metadata, and media reads are ID-scoped rather than full-table reads. The unpaginated main content-list/search contracts remain available where current client features still depend on them, so later route-loader adoption can remain incremental. `/api/public/shell` continues to expose only site/homepage/display/menu metadata, with the frontend 404 fallback to the home metadata projection retained for incremental Worker rollout.

Step 5 makes the route-level PublicSiteShell the authoritative shell renderer. Nested page-level PublicSiteShell instances now render their children on the first render pass and no longer gate page HTML on a client registration effect. Their remaining registration is a client-side enhancement for page-specific metadata and preloaded shell props only; it is not required for page-content rendering. The route shell now reads the lightweight /api/public/shell query through a dedicated Public shell hook, including on the home route, instead of depending on a child page effect to provide settings/menu data. Until those shell settings resolve, page media stays gated so an enabled Intro Gate cannot be bypassed by first-pass page rendering; server-prefetched shell data can later remove that client wait without changing the contract. This keeps shell ownership compatible with a future server render while preserving the current CSR deployment and a testable data-hook boundary.

Step 6 makes browser-sensitive Public presentation deterministic across a future server render and the hydrating browser. Production Home sections no longer depend on IntersectionObserver to exist in the semantic first-pass tree; `content-visibility` and Suspense remain performance/layout tools without removing their content from the render contract. The Home Carousel now has a deterministic static first-pass boundary seeded from the snapshot `generatedAt` time and becomes the existing interactive Carousel only after a client effect. Intro Gate initial visibility is derived only from its settings, while sessionStorage dismissal is reconciled after mount. Event lifecycle labels are also seeded from snapshot `generatedAt` and move to the live browser clock after mount. Normal Public images remain semantic `<img>` elements and use native `loading="lazy"`/low priority rather than suppressing `src` until an IntersectionObserver fires; the page-media gate still withholds page image sources while Intro Gate owns critical-media priority. Heavy iframe/embed resources remain eligible for explicit near-viewport activation. The legacy Home viewport-defer behavior exists only behind an explicit `MODE === "test"` compatibility harness and is not a production runtime path.

Step 7 moves baseline document-head ownership into TanStack Router route `head` descriptors and renders `HeadContent` from the root route layout. Static Public routes now own their baseline title, description, and canonical URL at route-match time; indexable archive routes also derive canonical pagination from validated Router search state. Normalized page 2+ values are self-referencing, page 1/invalid values collapse to the base route, and filter/tracking parameters are not copied into pagination canonicals. `/announcements` preserves its independent `announcementsPage` and `pagesPage` channels in canonical order. The Search route remains explicitly `noindex,follow` with canonical `/search`, while the CMS Auth/Admin route hierarchy is explicitly `noindex,nofollow`. Both `/content/$slug` and the root permalink route establish `/content/$slug` as the baseline canonical path. The root route itself is canonical-neutral so Public canonical metadata cannot leak into CMS/Admin routes. The Vite HTML template no longer owns a competing title or description, and browser bootstrap no longer assigns `document.title` imperatively. Existing CMS-driven page metadata remains a client enhancement for values that require fetched content, including Home descriptions, query-specific Search titles, and content-specific SEO/canonical overrides; a later server data-loader phase can move those dynamic values into route head evaluation without changing the baseline ownership model.

These readiness changes still do not enable server rendering, hydration, network route loaders, server-prefetched dynamic CMS head metadata, canonical HTTP redirects, Emotion SSR extraction, or Vercel SSR routing. The current production deployment remains a CSR application; Step 7 and its audit hardening establish the route-head and paginated read contracts that a future server renderer can consume.

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
