# Current Runtime Ownership

Updated: 2026-08-01.

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
