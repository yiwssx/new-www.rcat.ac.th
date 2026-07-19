# Site View Tracking

The public website records lightweight, privacy-friendly site view counters through the Cloudflare Worker and D1 public analytics path.
This replaces manual visitor statistic entry for the `Website Visitors / สถิติผู้เข้าชมเว็บไซต์` card.

Current status: M20 migration/runtime/domain-cutover scope is closed. Site-view tracking is owned by Cloudflare Worker and D1; M21 owns remaining UI/logic stabilization.

## What Is Counted

- `totalViews`: accepted public page views.
- `usersToday`: unique anonymous browser visitor ids active today.
- `usersYesterday`: unique anonymous browser visitor ids active yesterday.
- `usersThisMonth`: unique anonymous browser visitor ids active in the current month.
- `usersThisYear`: unique anonymous browser visitor ids active in the current year.
- `totalUsers`: unique anonymous browser visitor ids seen historically.
- `onlineUsers`: unique anonymous browser visitor ids active in the last 5 minutes.
- `updatedAt`: latest accepted site view timestamp.

Unique users are browser-based, not identity-based. A person using two browsers or clearing storage can be counted as more than one visitor.

## Privacy Model

The frontend creates a random anonymous visitor id and stores it in localStorage under:

```text
rcat.site.visitor.id
```

The tracking request sends only:

- anonymous `visitorId`
- public `path`
- client `timestamp`
- page title, capped to a short public string
- optional referrer origin only, not the full referrer URL

The system does not collect email, name, login state, IP address, or raw user agent. Do not add those fields to this endpoint.

## Tracking Behavior

Only public routes are tracked. These routes are excluded:

- `/login`
- `/admin`
- `/admin/*`

The tracker runs on route changes and sends the request with `navigator.sendBeacon()` when available. If beacon is unavailable, it falls back to `fetch()` with `keepalive: true`. The request is fire-and-forget; page rendering does not wait for it, and failures are ignored silently.

The frontend throttles duplicate tracking for the same path for 30 minutes to avoid React StrictMode double effects and repeated refreshes. The Cloudflare Worker/D1 analytics path also enforces server-side throttling and aggregation rules for site view, content view, visitor presence, and live visitor stats.

## Backend Storage

The Cloudflare Worker accepts public analytics writes for approved public routes and stores aggregate counters in D1. The endpoint updates analytics storage only and does not rebuild CMS snapshots.

Storage uses D1 analytics tables for privacy-safe aggregate counters and presence windows. The system must not store email, name, login state, raw user agent, API tokens, or secrets in these public analytics records.

## Cache And Staleness

`site-view` does not call `invalidatePublicSnapshotCache()`. This is intentional: invalidating public snapshots on every page view would recreate the slow public API behavior the cache is meant to avoid.

The homepage visitor card reads stats from the Cloudflare public home/visitor stats responses, so visible stats can be stale until the public cache expires. This keeps page load fast and avoids blocking public rendering.

## Admin Behavior

Admins can enable or disable the public display of the visitor stats card. Counted values are read-only in Settings because they are generated automatically from public site views.

## Deployment Steps

Deploy the frontend and Worker only when those surfaces changed. Apps Script deployment is not required for site-view tracking unless the separate media/file bridge code changed.

```powershell
pnpm worker:typecheck
pnpm build
```

Confirm the public frontend uses `VITE_PUBLIC_API_PROVIDER=cloudflare` and a non-secret `VITE_CLOUDFLARE_PUBLIC_API_URL` for the approved environment. Do not configure site-view tracking through `VITE_GOOGLE_APPS_SCRIPT_URL`.

## Manual Verification

1. Deploy the frontend.
2. Confirm the approved Cloudflare Worker/D1 environment is configured.
3. Open a public page in a normal browser.
4. In DevTools Network, filter for the approved public Worker origin.
5. Confirm a non-blocking public analytics request.
6. Refresh the same path repeatedly and confirm the 30-minute throttle prevents excessive increments.
7. Visit a different public route and confirm a new accepted view is counted.
8. Visit `/login` and `/admin` and confirm no public analytics request is sent.
9. Confirm the visitor stats card updates after the public-home cache window expires.
