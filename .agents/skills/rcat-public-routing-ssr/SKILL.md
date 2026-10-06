---
name: rcat-public-routing-ssr
description: RCAT-specific Public route, TanStack Router/Query, SSR, hydration, Vercel rewrite, SEO/head, sitemap, permalink, slug, canonical URL, and public-route registry guidance. Use whenever adding/changing Public routes or SSR behavior.
metadata:
  owner: rcat
  version: '1.0.0'
---

# RCAT Public Routing + SSR

Use this skill whenever a Public URL, route contract, SSR boundary, sitemap, metadata, canonical URL, slug, or Vercel SSR rewrite changes.

Also load `router-query`, `vite`, `security-guidance`, and accessibility guidance as applicable.

## Trigger this skill when

- adding or changing a Public route;
- changing `config/public-routes.json` or route registry/policy code;
- changing TanStack Router route definitions/loaders/context;
- changing React Query preload/dehydrate/hydrate behavior;
- editing `src/entry-server.tsx`, `src/entry-client.tsx`, `src/runtime.ts`, or SSR response finalization;
- changing route head/meta/canonical/noindex behavior;
- changing `/sitemap.xml`, robots, permalink/slug rules, Vercel rewrites, middleware, or public SSR catch-all behavior.

## Canonical sources

Use the current relevant files:

- `config/public-routes.json`;
- `src/public/routing/publicRouteRegistry.ts`;
- `cloudflare/public-api/src/publicRoutePolicy.ts`;
- `src/routes.tsx`;
- `src/routeComponents.tsx`;
- `src/public/routing/publicRouteHead.ts`;
- `src/runtime.ts`;
- `src/entry-server.tsx`;
- `src/entry-client.tsx`;
- `src/vercelSsr.ts`;
- `api/sitemap.mjs`;
- `vercel.json` and routing middleware when relevant;
- `docs/architecture/public-route-registry-v1-2026-09-27.md`;
- `docs/architecture/ssr-implementation-phases.md`;
- `docs/operations/public-ssr-cutover.md`;
- `docs/architecture/current-runtime-ownership.md`.

Do not create a second route registry.

## Route registry contract

`config/public-routes.json` is the shared Public static/application route source of truth.

When adding/changing a registered route:

1. update the shared registry rather than creating an independent route list;
2. preserve stable route IDs and operator labels where existing contracts rely on them;
3. set indexability/sitemap behavior deliberately;
4. preserve reserved-root-slug protection;
5. update route implementation and any Worker policy derived from the registry;
6. update governance tests that prove registry consumers stay aligned.

Sitemap, route policy, and UI routing should derive from the shared registry where the architecture already does so.

## Dynamic content and slug rules

Preserve current canonical content routing:

- published canonical CMS content uses the `/content/$slug` namespace;
- do not reintroduce ambiguous root `/$slug` content permalinks as the primary canonical route;
- registered/system-reserved root slugs must not be taken by dynamic content;
- menu aliases are navigation behavior, not a second canonical content namespace;
- drafts/private/Admin/Auth/API routes must not enter the public sitemap;
- external absolute canonical URLs must be respected according to current head/sitemap policy.

Before inventing a new dynamic namespace, check existing content-kind and permalink contracts.

## TanStack Router + Query contract

The application runtime owns Router and Query state together.

- create a fresh runtime per browser runtime or server request;
- the Router context must receive the exact request-local QueryClient;
- route loaders/preloading should use the established QueryClient integration;
- preserve request isolation on SSR;
- preserve dehydration/hydration so the client does not refetch solely because server state was lost;
- do not introduce a global singleton QueryClient/Router for server requests;
- keep loader error/not-found behavior aligned with current route/error boundaries.

Use the vendored `router-query` skill for generic TanStack patterns, but RCAT route/SSR contracts take precedence.

## SSR and Emotion/CSP contract

Server and client must use the same runtime/provider architecture.

- SSR uses the request-local runtime through the current TanStack request handler;
- preserve the runtime-owned Emotion cache;
- preserve critical CSS extraction/finalization;
- preserve CSP nonce propagation;
- preserve hydration-safe markup;
- do not add a second Emotion cache or a client-only styling provider that diverges from SSR.

Any change to entry/runtime/styling boundaries must run SSR and hydration regression tests.

## SEO/head behavior

Metadata must be correct in the server-rendered response where the current SSR architecture supports it.

For each changed route, decide:

- title/description;
- canonical URL;
- index/follow policy;
- Open Graph/social metadata where applicable;
- error/search/private-route indexing policy.

Preserve current noindex rules for search/error/auth/admin/non-public surfaces.

Do not solve metadata by client-only effects when the SSR route head contract already owns it.

## Sitemap and robots

The sitemap is runtime-owned.

- `/sitemap.xml` is served through the Vercel API route;
- it reads current Public data through the approved Worker/D1 boundary;
- it includes the registered indexable Public route set plus eligible published canonical content;
- do not restore the removed build-time static sitemap generator;
- do not source-control a generated `public/sitemap.xml`.

Keep `robots.txt` and response-level indexing directives consistent with the SSR/search policy.

## Vercel routing order

Preserve explicit routes/proxies ahead of the Public SSR catch-all.

At minimum, check current ordering for:

- `/sitemap.xml`;
- CMS/Auth/Admin/API proxy paths;
- static assets and special framework/runtime paths;
- the Public SSR catch-all.

Do not let a new catch-all shadow API/proxy routes.

## Cache and error behavior

Use the current SSR response/cache policy.

- 4xx/5xx SSR responses must not become indexable cache artifacts;
- private/auth/admin surfaces must not inherit public cache/indexing behavior;
- preserve current no-store/noindex rules where defined;
- route loader/data cache behavior must not leak request-local or authenticated state.

## Verification

For routing/SSR changes, use the current relevant subset of:

- public-route registry governance tests;
- route loader tests;
- route head SSR tests;
- SSR foundation tests;
- hydration tests;
- sitemap tests;
- SSR build;
- normal Vite build;
- functional E2E;
- normal repository CI/governance.

Current package scripts and workflow definitions are authoritative.

Production SSR cutover or deployment verification is a separate protected action and must not be triggered merely because route code changed.

## Anti-patterns

Do not:

- maintain separate hard-coded route arrays in multiple subsystems;
- create root dynamic slugs that collide with registered routes;
- use a global Router/QueryClient on the server;
- make SEO metadata client-only when SSR owns it;
- restore a build-time sitemap;
- place the SSR catch-all before API/proxy routes;
- break CSP nonce or Emotion extraction to simplify rendering;
- add a new public route without defining indexability/canonical behavior.

## Related skills

- `rcat-workstream-governance`;
- `router-query`;
- `vite`;
- `security-guidance`;
- `frontend-accessibility-best-practices`.
