# Public SSR Production Cutover Runbook

Updated: 2026-08-13.

Use this checklist when Public SSR changes are explicitly promoted to `master`. A non-master branch or draft PR does not change production.

## Preconditions

- Vercel production environment has a valid server-side `CLOUDFLARE_PUBLIC_API_URL` (the public `VITE_CLOUDFLARE_PUBLIC_API_URL` alias remains an accepted compatibility fallback).
- Production Cloudflare Public API / D1 reads are healthy.
- Focused and release-scale repository gates pass.
- No temporary validation workflow is present in the final production diff.
- `/sitemap.xml` and existing CMS/Auth proxy rewrites remain ahead of the Public SSR catch-all.

The Public structured-data runtime is Cloudflare-only. Do not restore `PUBLIC_API_PROVIDER` or `VITE_PUBLIC_API_PROVIDER` as a runtime selector.

## Expected routing after deployment

- Public pages such as `/`, `/news`, `/announcements`, `/departments`, `/documents`, `/calendar`, `/contact`, `/search`, `/content/$slug`, and legacy `/$slug` are handled by the Public SSR Function.
- `/login`, `/activate-account`, `/reset-password`, `/admin`, and `/admin/**` remain CSR through `csr.html`.
- `/api/**`, `/sitemap.xml`, static assets, `robots.txt`, and other explicit Vercel routes keep their own routing behavior.

## Immediate HTTP checks

Run against the deployed production origin:

```bash
curl -sS -D - -o /dev/null https://www.rcat.ac.th/
curl -sS -D - -o /dev/null 'https://www.rcat.ac.th/news?page=2'
curl -sS -D - -o /dev/null 'https://www.rcat.ac.th/search?q=test'
curl -sS -D - -o /dev/null https://www.rcat.ac.th/content/<published-slug>
curl -sS -D - -o /dev/null https://www.rcat.ac.th/content/<missing-slug>
curl -sS -D - -o /dev/null https://www.rcat.ac.th/<published-slug>
curl -sS -I https://www.rcat.ac.th/content/<published-slug>
```

Expected:

- normal Public page / published content: `200`;
- missing content: `404`, `Cache-Control: no-store`, response-level noindex;
- legacy published slug: `301` with `Location: /content/<slug>`;
- Search: `200`, `Cache-Control: no-store`, `X-Robots-Tag: noindex, follow`;
- HEAD: same status/headers as GET but no body;
- Public upstream outage: `503`, `Retry-After: 300`, `Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow`.

For successful indexable Public pages, browsers should revalidate and the Vercel CDN should use 2-minute freshness plus 1-hour stale-while-revalidate. Permanent legacy redirects use the longer redirect CDN policy.

## No-JavaScript / crawler HTML checks

Fetch source without executing JavaScript:

```bash
curl -sS https://www.rcat.ac.th/ > /tmp/rcat-home.html
curl -sS https://www.rcat.ac.th/content/<published-slug> > /tmp/rcat-detail.html
```

Verify the initial HTML includes:

- `<!DOCTYPE html>`, `<html>`, `<head>`, and `<body>`;
- `data-rcat-ssr="true"` on the HTML element;
- meaningful page content / heading before JavaScript;
- route-specific `<title>` and description;
- canonical URL;
- Open Graph and Twitter metadata;
- `application/ld+json` structured data;
- Emotion `data-emotion` critical styles in the head;
- one client entry `<script>` marked with `data-rcat-client-entry` whose `/assets/...` filename is content-hashed;
- one or more stylesheet links marked with `data-rcat-client-stylesheet` whose `/assets/...` filenames are content-hashed.

Do not expect fixed `/assets/rcat-client.js` or `/assets/rcat-client.css` names. The production build selects assets from the Vite manifest and fails closed if the manifest-selected client entry/styles are unavailable.

A published content page must expose its article body in initial HTML. If semantic content only appears after JavaScript, treat the cutover as failed.

## Browser hydration checks

Open representative Public pages and inspect the console:

- no React hydration mismatch warnings;
- no Emotion class-name mismatch;
- no flash caused by missing critical MUI styles;
- route navigation works after hydration;
- Public queries do not immediately refetch solely because dehydrated state was lost;
- carousel/Intro Gate/event labels retain deterministic first paint behavior.

Then verify Admin/Auth separately:

- `/login` loads through CSR;
- `/admin` authentication/session/MFA/CSRF behavior is unchanged;
- Admin is not server-rendered Public content and remains `noindex,nofollow`.

## SEO/indexing checks

- `/robots.txt` advertises the production sitemap and blocks Admin/Auth/API surfaces as intended.
- `/sitemap.xml` returns `200`, canonical Public URLs only, no Search, no legacy `/$slug` duplicates, no drafts.
- `/search` is crawlable enough to expose its noindex directive but is not present in sitemap.
- Missing content is a real HTTP `404`, not a soft 404.
- Legacy content URL is a real HTTP `301`, not a JavaScript redirect.

## Vercel cache checks

Repeat a successful Public GET after a short interval and inspect Vercel cache/debug headers available on the deployment. Confirm that the response is eligible for Vercel CDN caching with the current 2-minute freshness / 1-hour stale-while-revalidate policy and that Search/errors are not cached.

Do not use browser `max-age` to hold Public HTML stale: browsers should revalidate, while shared Vercel caching provides the SSR cache layer.

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
- cache behavior matches the documented policy;
- manifest-selected hashed client assets load successfully;
- Admin/CMS Session/MFA/CSRF behavior remains unchanged.
