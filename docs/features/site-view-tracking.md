# Site View Tracking

The public website records lightweight, privacy-friendly site view counters through the Google Apps Script public API.
This replaces manual visitor statistic entry for the `Website Visitors / สถิติผู้เข้าชมเว็บไซต์` card.

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

The frontend throttles duplicate tracking for the same path for 30 minutes to avoid React StrictMode double effects and repeated refreshes. The Apps Script backend also throttles the same visitor id and same path within a 30-minute window.

## Backend Storage

Apps Script accepts unauthenticated public `POST ?resource=site-view` requests. The endpoint updates only visitor stats storage and does not rebuild CMS snapshots.

Storage uses the `VisitorStats` sheet with one compact row per anonymous visitor id. Each row stores first/last seen timestamps, the last path, total accepted views, and compact day/month/year keys used for unique counts.

## Cache And Staleness

`site-view` does not call `invalidatePublicSnapshotCache()`. This is intentional: invalidating public snapshots on every page view would recreate the slow public API behavior the cache is meant to avoid.

The homepage visitor card reads stats from the public-home snapshot, so visible stats can be stale until the public cache expires. This keeps page load fast and avoids blocking public rendering.

## Admin Behavior

Admins can enable or disable the public display of the visitor stats card. Counted values are read-only in Settings because they are generated automatically from public site views.

## Deployment Steps

Deploy both the frontend and Apps Script changes.
Use the full Apps Script release checklist in [`docs/deployment/apps-script-deployment-checklist.md`](../deployment/apps-script-deployment-checklist.md) for versioning, deployment update, production verification, and rollback steps.

```powershell
pnpm build
pnpm gas:push
pnpm gas:version
pnpm gas:deployments
cd apps-script
pnpm dlx @google/clasp deploy --deploymentId <WEB_APP_DEPLOYMENT_ID> --versionNumber <NEW_VERSION_NUMBER> --description "automatic site view tracking"
```

Confirm the frontend `VITE_GOOGLE_APPS_SCRIPT_URL` points to the updated web app deployment.

## Manual Verification

1. Deploy the frontend.
2. Deploy Apps Script.
3. Open a public page in a normal browser.
4. In DevTools Network, filter for `script.google.com`.
5. Confirm a non-blocking `POST` request with `resource=site-view`.
6. Refresh the same path repeatedly and confirm the 30-minute throttle prevents excessive increments.
7. Visit a different public route and confirm a new accepted view is counted.
8. Visit `/login` and `/admin` and confirm no `site-view` request is sent.
9. Confirm the visitor stats card updates after the public-home cache window expires.
