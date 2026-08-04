# SSR/SEO Implementation Phases

Updated: 2026-08-04.

The seven SSR-readiness steps are complete on the integration line. The implementation phase begins after those readiness steps and is intentionally tracked separately so readiness work is not confused with production SSR activation.

## Phase 1 — SSR Runtime Foundation

Status: implemented on the SSR integration line; production remains CSR-only.

Phase 1 establishes the runtime boundary required by later server data loading and hydration work:

- `createAppRuntime()` creates a fresh TanStack Query `QueryClient` and TanStack Router as one paired runtime;
- the Router receives that exact QueryClient through typed route context;
- `entry-server.tsx` accepts a Web API `Request` and renders through TanStack Router `createRequestHandler`, `RouterServer`, and non-streaming `renderRouterToString`;
- TanStack's request handler/server router path derives request-local server history from the incoming Request instead of using browser history;
- shared Query/MUI providers are reusable by both browser and server render paths;
- every call to the server renderer creates a new runtime, preventing QueryClient/Router state from crossing requests;
- `pnpm test:ssr:foundation` validates runtime isolation and route-aware server head rendering;
- `pnpm build:ssr:foundation` verifies the server entry can be bundled by Vite independently of the client build.

## Phase 2 — Public Route Data Loading / Server Prefetch Ownership

Status: implemented on the SSR integration line; production remains on the CSR routing path.

Phase 2 gives matched Public routes explicit ownership of the TanStack Query data they require before a server render:

- the Public layout prefetches the lightweight `/api/public/shell` query so navigation/settings are available before shell rendering;
- Home prefetches the Home snapshot;
- News and Blog prefetch their reusable content-list queries;
- Announcements prefetches its list using normalized `pagesPage` loader dependencies so the independently paginated public-page collection uses the same query key as the page hook;
- Departments prefetches the Public program query;
- Documents and Calendar prefetch their dedicated document/event queries;
- Achievements prefetches the current Public search-index query used by that page;
- Contact prefetches the existing CMS snapshot required by its current component contract;
- Search prefetches only when `q` is non-empty and keys the request by normalized query/page with the same 12-item page size as the page hook;
- both content URL forms prefetch content detail plus the supporting CMS snapshot currently used for related content and media;
- loader query factories are dynamically imported so route-data ownership does not pull the Public data layer into the synchronous browser entry graph;
- query failures remain intentionally non-fatal at the loader boundary until Phase 6 maps typed errors to production HTTP semantics.

The loader layer calls the same reusable query-option factories as the React hooks, so server-prefetched data lands in the exact QueryClient keys the page components already consume. No second server-side data store is introduced.

## Phase 3 — Query Dehydration / Browser Hydration

Status: implemented on the Phase 3 branch; production Vercel routing is still not switched to the SSR renderer.

Phase 3 carries the request-scoped QueryClient cache produced by Phase 2 across the server/client boundary:

- the Router `dehydrate` callback uses TanStack Query `dehydrate()` after matched route loaders have populated the request-local QueryClient;
- the Router `hydrate` callback restores that state into the browser runtime's QueryClient before hydrated route components consume their query hooks;
- dehydration is restricted to known Public query-key roots, so unrelated or future privileged query caches cannot be serialized into Public SSR HTML accidentally;
- TanStack Query's default successful-query dehydration rule remains in force, so failed loader/query states are not serialized during this phase;
- the Public Query cache crosses the Router serializer through an explicit JSON-safe DTO boundary; mutations are excluded, and Public API snapshots/query keys remain JSON-compatible by contract;
- `renderRouterToString` consumes the request-bound Router produced by `createRequestHandler`; the installed TanStack Router render helper receives the Router, response headers, and rendered children, and emits Router/application hydration state from that request-local Router;
- the browser SSR path uses `RouterClient` with React `hydrateRoot()` when `#root` already contains server-rendered markup;
- the existing empty-root `createRoot()` path remains as a CSR fallback so current Vite/Vercel SPA deployment continues to work until the explicit production cutover;
- `pnpm test:ssr:hydration` validates Public query round-trip hydration, the Public-only serialization boundary, route-loader readiness, and SSR runtime/head regressions.

Phase 3 still does **not** extract Emotion/MUI critical CSS, generate full dynamic CMS SEO/structured data, map Public errors to final 301/404/503 responses, or change Vercel production routing/cache policy.

## Remaining implementation phases

1. Phase 4 — MUI/Emotion SSR styling and critical CSS.
2. Phase 5 — Full dynamic SEO, social metadata, and structured data.
3. Phase 6 — HTTP status, canonical redirects, indexing, sitemap, and robots correctness.
4. Phase 7 — Vercel routing, cache policy, production validation, and cutover.

Production SSR/SEO is complete only after the remaining phases are finished and the production Vercel routing is explicitly switched from the CSR fallback to the verified SSR renderer.
