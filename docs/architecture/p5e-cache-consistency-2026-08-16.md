# P5E Cache Consistency — 2026-08-16

Status: implementation candidate; closure requires green CI on the P5E pull request.

## Goal

P5E makes public structured-data freshness deterministic after the P5B–P5D SSR/data-flow changes and the P5X production cutover. It does not change Cloudflare Worker/D1 identity, production data, API URLs, Vercel environment variables, Apps Script deployment, or authentication policy.

## Root cause found

The browser had two public cache owners:

1. TanStack Query, including SSR hydration and in-memory query state.
2. A legacy localStorage public CMS cache used as `initialData` and written again from public query functions.

The most important shell conflict was the legacy `cms-snapshot` projection. It combines `public-home` and `public-shell`, including menu/site/display/homepage settings. The canonical `public-shell` query used a 2-minute stale window while the persisted combined snapshot used a 15-minute window. A component fallback could therefore observe shell data through a different query key and freshness window.

## Canonical ownership after P5E

TanStack Query is the active browser cache owner for structured public reads.

| Data family | Query owner | Freshness class |
| --- | --- | --- |
| Site settings / display settings / homepage settings / menu | `public-shell` | `shell` = 2 minutes |
| Public home | `public-home-snapshot` | `collection` = 15 minutes |
| Content lists | `public-content-list` | `collection` = 15 minutes |
| Documents | `public-document-list` | `collection` = 15 minutes |
| Events | `public-event-list` | `collection` = 15 minutes |
| Programs | `public-program-list` | `collection` = 15 minutes |
| Search | `public-search-index` | `collection` = 15 minutes |
| Content detail | `content-detail` | `detail` = 30 minutes |

All public query families use a 60-minute TanStack Query GC window. GC controls unused in-memory retention and is not a freshness promise.

The values are owned by `src/config/publicCachePolicy.ts`; feature query files no longer carry independent numeric TTLs.

## Legacy persistence retirement

Active public query functions no longer write structured snapshots to localStorage. Active public hooks no longer read localStorage snapshots into `initialData` or maintain a separate `refetchOnMount` freshness calculation.

`createAppQueryClient()` performs a one-time browser-session purge of the retired `rcat.cms.public.*` persistence keys so users upgrading from the previous build do not retain obsolete structured snapshots indefinitely. The legacy cache helpers remain temporarily for compatibility/tests and can be deleted later as maintainability cleanup; they are not active public-read owners after P5E.

## Shell single-owner rule

`usePublicCmsSnapshot` is retained only as a compatibility shape for the remaining menu fallback. It delegates to `usePublicShellSnapshot`, so the fallback uses the same `public-shell` query key and freshness state instead of issuing/owning a separate combined `cms-snapshot` request.

`getPublicCmsSnapshotForProvider()` remains as a legacy projection for parity/tests, but production components must consume `public-shell` plus feature-specific queries directly.

## Invalidation

`invalidatePublicCmsData()` now invalidates active TanStack Query roots only. It no longer clears a second localStorage cache or treats `cms-snapshot` as an active runtime query root.

Deleting content removes the exact `content-detail` query and then invalidates the active public query roots. Mutation-to-surface dependency narrowing can be added later if measurements justify it; P5E first removes divergent owners.

## Regression gate

`src/test/publicCacheConsistency.test.ts` fails CI if:

- canonical freshness classes drift from the documented values;
- public query families stop using the central freshness/GC policy;
- active public query functions regain localStorage write side effects;
- active public hooks regain persisted `initialData` ownership;
- the legacy CmsSnapshot hook stops delegating to `public-shell`;
- active invalidation starts clearing a second persistence owner again.

## Closure criteria

P5E is closed when the PR CI is green with these guards and the production source still satisfies:

- one shell runtime owner: `public-shell`;
- one browser cache owner for public structured data: TanStack Query;
- centralized freshness classes;
- QueryClient-owned invalidation;
- legacy persisted structured cache purged on browser boot;
- no production data, Worker/D1, Vercel URL, or Apps Script change required.
