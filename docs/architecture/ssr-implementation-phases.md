# SSR/SEO Implementation Phases

Updated: 2026-08-03.

The seven SSR-readiness steps are complete on the integration line. The implementation phase begins after those readiness steps and is intentionally tracked separately so readiness work is not confused with production SSR activation.

## Phase 1 — SSR Runtime Foundation

Status: implemented on the SSR runtime foundation branch; production remains CSR-only.

Phase 1 establishes the runtime boundary required by later server data loading and hydration work:

- `createAppRuntime()` creates a fresh TanStack Query `QueryClient` and TanStack Router as one paired runtime;
- the Router receives that exact QueryClient through typed route context;
- the browser entry remains `ReactDOM.createRoot()` and therefore does not hydrate server markup yet;
- `entry-server.tsx` accepts a Web API `Request` and renders through TanStack Router `createRequestHandler`, `RouterServer`, and non-streaming `renderRouterToString`;
- shared Query/MUI providers are reusable by both browser and server render paths;
- every call to the server renderer creates a new runtime, preventing QueryClient/Router state from crossing requests;
- `pnpm test:ssr:foundation` validates runtime isolation and route-aware server head rendering;
- `pnpm build:ssr:foundation` verifies the server entry can be bundled by Vite independently of the client build.

Phase 1 does **not** enable the new renderer in Vercel. It does not add route loaders, Query dehydration/hydration, `hydrateRoot`, dynamic CMS server metadata, Emotion critical CSS extraction, production HTTP redirect/404 semantics, or CDN cache policy.

## Remaining implementation phases

1. Phase 2 — Public route data loading and server-prefetch ownership.
2. Phase 3 — Query dehydration and browser hydration.
3. Phase 4 — MUI/Emotion SSR styling and critical CSS.
4. Phase 5 — Full dynamic SEO, social metadata, and structured data.
5. Phase 6 — HTTP status, canonical redirects, indexing, sitemap, and robots correctness.
6. Phase 7 — Vercel routing, cache policy, production validation, and cutover.

Production SSR/SEO is complete only after the remaining phases are finished and the production Vercel routing is explicitly switched from the CSR fallback to the verified SSR renderer.
