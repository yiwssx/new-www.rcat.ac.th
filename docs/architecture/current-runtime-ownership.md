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

Live visitor statistics remain intentionally browser-oriented polling rather than an SSR loader dependency, but their request now also consumes query cancellation.

These readiness changes do not enable server rendering, hydration, route loaders, server-side metadata, canonical redirects, or new Public API response contracts. Those remain separate migration stages and must preserve the existing Public/Admin runtime boundaries.

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
