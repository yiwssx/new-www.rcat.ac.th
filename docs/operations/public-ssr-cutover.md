# Public SSR Production Cutover Runbook

Updated: 2026-08-04.

Use this checklist when the completed SSR integration is explicitly promoted to `master`. Merging Phase 7 into `refactor/ssr-readiness` alone does not change production.

## Preconditions

- Vercel production environment has `PUBLIC_API_PROVIDER=cloudflare` and a valid `CLOUDFLARE_PUBLIC_API_URL` (the existing `VITE_*` aliases are also supported).
- Production Cloudflare Public API / D1 reads are healthy.
- Phase 7 focused and release-scale repository gates pass.
- No temporary Phase validation workflow is present in the final production diff.
- `/sitemap.xml` and existing CMS/Auth proxy rewrites remain ahead of the Public SSR catch-all.

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

For successful indexable Public pages, browser cache should require revalidation and Vercel CDN cache should use 5-minute freshness plus 24-hour stale-while-revalidate. Permanent legacy redirects use the longer redirect CDN policy.

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
- `/assets/rcat-client.css` and `/assets/rcat-client.js` hydration assets.

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

Repeat a successful Public GET after a short interval and inspect Vercel cache/debug headers available on the deployment. Confirm that the response is eligible for Vercel CDN caching and that Search/errors are not.

Do not use browser `max-age` to hold Public HTML stale: browsers should revalidate, while shared Vercel caching provides the SSR cache layer.

## Preview quota note

During Phase 7 implementation, a temporary `preview-*` deployment request was rejected because the Vercel account hit the Free-plan build-rate limit (`upgradeToPro=build-rate-limit`). This is a Vercel quota condition, not a successful or failed application smoke test. A live crawler smoke must therefore be repeated on a deploy that Vercel actually builds.

## Rollback

If production SSR has a material routing, hydration, SEO, or availability failure:

1. roll back the Vercel deployment to the last known-good `master` deployment, or revert the SSR cutover commit/configuration;
2. restore the previous SPA catch-all behavior so Vite `index.html` is the Public application entry;
3. confirm Admin/Auth and Public pages are reachable again;
4. leave Cloudflare Worker, D1, and Apps Script unchanged unless an independent issue exists there.

Phase 7 introduces no D1 migration and no Worker/Apps Script runtime change, so the normal SSR rollback boundary is Vercel/frontend only.

## Completion criteria

Production SSR/SEO is considered fully cut over only when:

- Vercel deploy succeeds;
- representative Public routes return semantic initial HTML;
- published/missing/legacy/upstream statuses are `200/404/301/503` as designed;
- canonical/OG/Twitter/JSON-LD are present server-side;
- Search/Admin indexing rules are correct;
- sitemap/robots are correct;
- browser hydration has no material mismatch/FOUC;
- cache behavior matches the documented policy;
- Admin/CMS Session/MFA/CSRF behavior remains unchanged.
