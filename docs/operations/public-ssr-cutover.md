# Public SSR production cutover

This runbook covers verification and rollback for the Vercel Public SSR runtime. It does not change Worker/D1 ownership or Admin/Auth boundaries.

## Scope

The Vercel SSR adapter owns Public page rendering for supported Public routes. Cloudflare Worker remains the Public/CMS API owner and D1 remains the data source.

The browser receives semantic HTML from Vercel, then hydrates the same React application. Admin/Auth/API routes are outside this Public SSR catch-all.

## Preconditions

- production deploy is built from the intended `master` SHA;
- Vercel Production environment has the canonical Cloudflare Public API URL configured;
- Cloudflare Worker and D1 are healthy independently;
- no production rollback or migration incident is active.

## Deployment verification

Confirm the Vercel deployment is an actual production build for the intended SHA. A GitHub status whose description says `Canceled by Ignored Build Step` is not a production release and must not be accepted as equivalent to a READY deployment.

Check representative routes from the production hostname, not only the Vercel preview hostname.

```bash
curl -i https://www.rcat.ac.th/
curl -i https://www.rcat.ac.th/news
curl -i https://www.rcat.ac.th/content/<published-slug>
curl -i https://www.rcat.ac.th/search?q=test
curl -i https://www.rcat.ac.th/content/<missing-slug>
```

Expected semantic HTML includes:

- `<!DOCTYPE html>`, `<html>`, `<head>`, and `<body>`;
- `data-rcat-ssr="true"` on the HTML element;
- meaningful page content / heading before JavaScript;
- canonical metadata and appropriate Open Graph/Twitter metadata;
- the client entry and stylesheet selected from the Vite manifest.

## HTTP semantics checks

Expected:

- normal Public page / published content: `200`;
- missing content: `404`, `Cache-Control: no-store`, response-level noindex;
- legacy published slug: `301` with `Location: /content/<slug>`;
- Search: `200`, `Cache-Control: no-store`, `X-Robots-Tag: noindex, follow`;
- Public upstream failure: `503`, `Retry-After: 300`, `Cache-Control: no-store`.

Do not accept soft-404 HTML with status `200` for a missing or unpublished content item.

## Hydration checks

Use a production browser run after the SSR response checks. Confirm:

- no hydration mismatch is emitted in the browser console;
- the initial server-rendered content remains stable through hydration;
- navigation to a second Public route works client-side;
- lazy route chunks and the manifest-selected client assets load successfully;
- there is no material flash of unstyled content.

## SEO/indexing checks

- `/robots.txt` advertises the production sitemap and blocks Admin/Auth/API surfaces as intended.
- `/sitemap.xml` returns `200`, canonical Public URLs only, no Search, no legacy `/$slug` duplicates, no drafts.
- `/search` is crawlable enough to expose its noindex directive but is not present in sitemap.
- Missing content is a real HTTP `404`, not a soft 404.
- Legacy content URL is a real HTTP `301`, not a JavaScript redirect.

## Vercel cache checks

Repeat successful stable Public index/list GETs after a short interval and inspect Vercel cache/debug headers available on the deployment. Confirm those responses remain eligible for Vercel CDN caching with the current 2-minute freshness / 1-hour stale-while-revalidate policy.

Canonical dynamic content detail responses at `/content/:slug` are intentionally `Cache-Control: no-store` and must not emit `Vercel-CDN-Cache-Control`. This prevents a published page from remaining publicly visible from shared cache after CMS unpublish/delete. Search and error responses are also not cached.

Do not use browser `max-age` to hold Public HTML stale: browsers should revalidate, while shared Vercel caching is limited to stable Public SSR surfaces.

## Preview quota note

During the original SSR implementation, a temporary `preview-*` deployment request was rejected because the Vercel account hit the Free-plan build-rate limit (`upgradeToPro=build-rate-limit`). That historical quota condition was not a successful or failed application smoke test. Any current SSR change still requires verification on a deployment Vercel actually builds.

## Rollback

If production SSR has a material routing, hydration, SEO, or availability failure:

1. roll back the Vercel deployment to the last known-good `master` deployment, or revert the SSR change/configuration;
2. restore the previous known-good routing behavior;
3. confirm Admin/Auth and Public pages are reachable again;
4. leave Cloudflare Worker, D1, and Apps Script unchanged unless an independent issue exists there.

A frontend/SSR-only rollback must not mutate D1 or Worker state unless the incident independently requires it.

## Completion criteria

Production SSR is considered healthy only when:

- Vercel deploy succeeds;
- representative Public routes return semantic initial HTML;
- published/missing/legacy/upstream statuses are `200/404/301/503` as designed;
- canonical/OG/Twitter/JSON-LD are present server-side;
- Search/Admin indexing rules are correct;
- sitemap/robots are correct;
- browser hydration has no material mismatch/FOUC;
- stable Public surfaces follow the documented CDN policy while `/content/:slug` remains no-store;
- manifest-selected hashed client assets load successfully;
- Admin/CMS Session/MFA/CSRF behavior remains unchanged.
