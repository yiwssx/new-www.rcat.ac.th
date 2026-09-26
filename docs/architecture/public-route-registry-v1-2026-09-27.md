# Public Route Registry v1

Updated: 2026-09-27

## Goal

Centralize metadata for code-owned Public routes without turning the registry into a router framework or allowing CMS operators to create executable application routes.

The registry is metadata-only. TanStack Router remains the authoritative runtime route declaration and keeps explicit component, loader, search validation, and route-tree ownership in source code.

## Source of truth

`config/public-routes.json` owns:

- registered static/application Public route IDs and paths;
- Thai operator labels;
- route kind (`core` or `application`);
- menu-selectable policy;
- indexability and sitemap policy;
- static SEO title/description/robots metadata;
- system-reserved root slugs such as `admin`, `api`, and `content`.

Consumers must derive route metadata from this file rather than maintaining parallel static route lists.

## Consumers

### Public routing and SEO

`src/public/routing/publicRouteRegistry.ts` validates and types the shared registry. `publicRouteHeadImpl.ts` derives static route head metadata from the registry while keeping behavioral SEO logic in TypeScript, including pagination canonicals, search-query titles, site settings, social metadata, and JSON-LD.

`src/routes.tsx` remains explicit and uses `getStaticPublicRouteHead()` for registered static/application routes, including `/complaint` and `/ita2569`.

### Runtime sitemap

`api/sitemap.mjs` derives `STATIC_INDEXABLE_ROUTES` from routes where both `indexable` and `sitemap` are true. Dynamic published CMS content remains loaded from the Public API and emitted under `/content/:slug` exactly as before.

Non-indexable registered routes and system-owned roots are excluded from normalized internal sitemap routes.

### CMS menu editor

The Admin Menu editor exposes registry entries with `menuSelectable: true` as a convenience picker. Selecting an entry only fills the existing `href` field. Operators may still enter arbitrary internal paths, external URLs, `mailto:`, `tel:`, and fragments manually.

The menu persistence model is unchanged.

### Reserved content slugs

The Cloudflare Worker imports the same registry and derives reserved Public root slugs. An authenticated pre-mutation guard rejects CMS content operations that would use a reserved root slug, including create/update and restore/publish flows covered by the canonical content routes.

This prevents the root CMS permalink route (`/$slug`) from colliding with code-owned application routes or system namespaces.

## Non-goals

V1 intentionally does not add:

- generated TanStack route definitions;
- CMS-created application routes;
- a routes database table;
- dynamic React component loading from configuration;
- route-level permission configuration;
- route versioning;
- redirect or alias management changes;
- plugin/module architecture;
- URL migrations;
- department-route refactoring.

## Invariants

- route IDs and static paths are unique;
- route paths are canonical and begin with `/`;
- sitemap routes must be indexable;
- menu-selectable routes have readable labels;
- registered and system-owned root paths are reserved from CMS content slugs;
- manual menu URLs remain supported;
- route components/loaders remain explicit in `src/routes.tsx`.

## Deployment impact

The change affects the Vercel frontend/runtime sitemap and the Cloudflare Worker content-write policy. It does not require a D1 migration or change existing Public URLs.
