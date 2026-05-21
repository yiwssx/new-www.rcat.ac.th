# Public API Cache Diagnostics - 2026-05-20

## Observed Issue

Chrome DevTools showed every public `script.google.com` request taking 7+ seconds across public pages. The affected routes are broader than the homepage, so the bottleneck is the Google Apps Script public API layer.

## Public Routes Covered

- `GET ?resource=snapshot`
- `GET ?resource=public-home`
- `GET ?resource=public-content-list&kind=news`
- `GET ?resource=public-content-list&kind=announcements`
- `GET ?resource=public-content-list&kind=blog`
- `GET ?resource=public-program-list`
- `GET ?resource=public-search-index`
- `GET ?resource=content-detail&slug=...`

## Diagnostic Design

Public cache wrappers now attach non-sensitive diagnostics only when `debugPerformance=1` is present.

Example:

```text
https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec?resource=public-home&debugPerformance=1
```

Normal responses do not include diagnostic metadata.

Debug responses include:

- `resource`
- `cacheKey`
- `cacheHit`
- `cacheMiss`
- `totalDurationMs`
- `buildPayloadDurationMs`
- `payloadBytes`
- `cacheMaxValueBytes`
- `cacheRead.returnedPayload`
- `cacheRead.payloadBytes`
- `cacheRead.parseError`
- `cacheRead.removeCachedValueCalled`
- `cacheWrite.attempted`
- `cacheWrite.success`
- `cacheWrite.skipped`
- `cacheWrite.reason`
- `cacheWrite.payloadBytes`

Diagnostics do not include CMS records, auth data, user accounts, private sheet data, document bodies, or secret values.

## Payload Size Findings

Apps Script `CacheService` has a practical per-value limit, and this code keeps public values below `PUBLIC_CACHE_MAX_VALUE_BYTES` (`95 * 1024`). Before these diagnostics, oversized payloads were logged server-side only, which made production cache misses hard to prove from DevTools.

The public cache layer now reports payload byte size and whether cache writes were skipped because the payload exceeded the limit.

Safe trimming applied:

- Public list and public snapshot content records no longer include full body data.
- Public list and public snapshot content records no longer include `bodyDocId`, `bodyDocUrl`, `canonicalUrl`, `viewCount`, or `lastViewedAt`.
- Draft, review, scheduled, unpublished, and private data remain excluded from public snapshots.
- Public media is still limited to media referenced by public content.
- `content-detail` remains the full public detail endpoint for body/content-block rendering.

The expected result is smaller cacheable payloads for routes that feed lists, cards, menus, search, and shell data while preserving visible UI fields.

## Cache Write Findings

Debug `cacheWrite.reason` values:

- Empty string: write succeeded or no error reason.
- `payload-too-large`: JSON payload exceeded `PUBLIC_CACHE_MAX_VALUE_BYTES` and was intentionally not cached.
- `cache-put-failed`: Apps Script cache write threw.
- `serialize-failed`: JSON serialization failed.
- `cache-key-unavailable`: detail/list request could not safely build a cache key.
- `invalid-cache-kind`: unsupported public content list kind.

If a route is slow on every request and debug output shows `cacheMiss: true` plus `cacheWrite.reason: "payload-too-large"`, reduce that endpoint payload further before assuming frontend rendering is the problem.

## Cache Invalidation Strategy

`invalidatePublicSnapshotCache()` currently clears:

- `snapshot`
- `public-home`
- `public-program-list`
- `public-search-index`
- public content list keys for `news`, `announcements`, and `blog`
- the public content-detail version property, which moves future detail reads onto fresh cache keys

Current invalidation callers were audited. Public cache invalidation is used for writes that can change public output:

- content create/update/delete/publish
- carousel save/delete
- external services save/delete
- media save/delete
- event save/delete
- menu replacement
- display settings
- site settings
- homepage settings
- visitor stats settings
- starter public site/menu seeding

The cache is not invalidated by login/user operations or by public content view counting. That is intentional because those operations should not force all public pages to rebuild.

Some invalidation remains broad but safe: media and event writes clear all public snapshots because media/events can appear in multiple public surfaces. Narrowing that further would require dependency tracking by content ID and route.

## Stale Deployment Check

If `debugPerformance=1` does not add `debugPerformance` to a public response after this code is pushed, production is likely running a stale Apps Script web app deployment.

## Apps Script Deployment Steps

1. Push source to Apps Script:

   ```sh
   pnpm gas:push
   ```

2. Create a new Apps Script version:

   ```sh
   pnpm gas:version
   ```

3. Update the production web app deployment to the new version:

   ```sh
   cd apps-script
   pnpm dlx @google/clasp deployments
   pnpm dlx @google/clasp deploy --deploymentId YOUR_WEB_APP_DEPLOYMENT_ID --versionNumber YOUR_NEW_VERSION --description "public api cache diagnostics"
   ```

   Alternatively, use Apps Script UI: Deploy -> Manage deployments -> edit the web app deployment -> select the new version -> Deploy.

4. Confirm the React app still points at the same deployment URL through `VITE_GOOGLE_APPS_SCRIPT_URL`.

## DevTools Verification

1. Open Chrome DevTools -> Network.
2. Filter by `script.google.com`.
3. Visit each public page: home, news, announcements, departments/programs, blog, contact, search, and a content detail page.
4. For each public route, open the request URL in a new tab and append `debugPerformance=1`.
5. Refresh the debug URL twice.
6. Confirm first response can show `cacheMiss: true`.
7. Confirm second response should show `cacheHit: true` for cacheable routes.
8. Confirm `cacheWrite.success: true` and `cacheWrite.skipped: false`.
9. If `cacheWrite.reason` is `payload-too-large`, note `payloadBytes` and the affected `resource`.
10. Confirm normal page requests without `debugPerformance=1` do not include `debugPerformance` in the JSON response.

## What This Does Not Replace

- It does not replace `pnpm quality`.
- It does not remove the need to deploy the latest Apps Script version.
- It does not make production builds depend on debug metadata.
- It does not change CMS schema, auth, admin writes, Apps Script write routes, or public UI behavior.
