# Performance Governance and Analytics

## Scope

This record covers frontend telemetry ownership, Public-route request behavior, and the synchronous Vite entry graph. The starting source was master commit `1d628a2796f0ef011385edde0c439ddcc735b35c`. The correction was measured from the working tree on `perf/performance-governance-analytics` before its final commit.

The change does not alter Cloudflare Worker routes, D1 schemas, migrations, visitor hashing, CMS authentication, the Vercel CMS proxy, or public content APIs.

## Telemetry ownership

| System                  | Purpose and metric owner                                | Route scope                           | Trigger                                                                  | Maximum frequency                                                                                                | Data sent                                                                                  | Persistence                                                               |
| ----------------------- | ------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| Google GTM or direct GA | Public audience page views                              | Genuine Public routes only            | Normalized Public navigation                                             | One explicit `page_view` per normalized pathname; exactly one transport owns it                                  | Pathname, origin plus pathname, and a non-query-derived current title                      | Google transport; no additional browser persistence was added             |
| Vercel Analytics        | Public deployment analytics                             | Genuine Public routes only            | Public telemetry boundary and SDK automatic navigation tracking          | One script mount per document; event behavior remains governed by the SDK                                        | SDK-managed deployment/page-view fields plus a sanitized Public URL                        | Vercel service; no application persistence was added                      |
| Vercel Speed Insights   | Public deployment Web Vitals/RUM                        | Genuine Public routes only            | Public telemetry boundary and SDK RUM collection                         | One script mount per document; metric sampling remains governed by the SDK                                       | SDK-collected Web Vital/RUM fields plus sanitized Public URL and normalized route          | Vercel service; no application persistence was added                      |
| First-party Site View   | Public view, daily-view, and anonymous visitor counters | Genuine Public routes only            | First visit to a normalized path                                         | One POST per anonymous visitor and normalized path in 30 minutes                                                 | Anonymous visitor ID, pathname, timestamp, safe non-search title, and referrer origin only | Existing local visitor ID/throttle plus the unchanged first-party backend |
| First-party Presence    | Approximate online visitor state                        | Genuine Public routes only            | Initial visible route, new Public route, heartbeat, or return to visible | At most one POST for the same path per 60-second heartbeat window; a new Public path may send immediately        | Anonymous visitor ID and normalized pathname                                               | In-memory client coordinator plus the unchanged first-party backend       |
| Visitor-stats GET       | Refresh the public counter UI                           | Public home counter only when enabled | Stale visible interval, stale focus, or stale reconnect                  | No immediate GET for a fresh snapshot; at most one GET per 60 seconds while visible; five-minute failure backoff | No browser telemetry payload; reads existing aggregate counters                            | Shared React Query cache; the latest valid snapshot remains rendered      |

These systems are not interchangeable. Google owns the explicit Public audience page view, Vercel Analytics owns deployment analytics, Speed Insights owns deployment RUM, Site View owns the first-party counters, Presence owns approximate online state, and visitor-stats GET only refreshes the displayed aggregates.

`VITE_PUBLIC_ANALYTICS_STRATEGY=both` remains accepted only as a deprecated alias for the canonical GTM transport. It no longer initializes GTM and direct gtag together. Direct `gtag` mode still sets `send_page_view: false` before emitting the single explicit page view.

## Route and failure boundary

`src/shared/telemetry/publicTelemetryRoutes.ts` is the single route policy used by Google, Vercel Analytics, Speed Insights, Site View, and Presence. It strips query strings, hashes, and trailing slashes before deciding scope.

The policy blocks:

- `/login`
- `/activate-account`
- `/reset-password`
- `/admin` and every `/admin/**` path

Near matches such as `/administrator` remain Public. Normal Public pages and permalinks remain allowed.

`PublicRouteLayout` dynamically imports one optional `PublicTelemetry` entry. A null Suspense fallback and a local silent error boundary keep rendering independent of telemetry availability. `RootRouteLayout` does not import or mount telemetry. Consequently, Auth and Admin routes do not request the optional module or vendor scripts.

## Data minimization

Google page views contain only:

- `page_path`: normalized pathname
- `page_location`: current origin plus normalized pathname
- `page_title`: current document title, except that the query-derived `/search` title is omitted

Arbitrary queries, hashes, search strings, reset or invitation tokens, email addresses, CMS identifiers, authentication state, and browser-storage values are not included. Vercel `beforeSend` hooks reject non-Public events and replace event URLs with the origin plus normalized pathname. First-party Site View retains its anonymous visitor ID and 120-character safe title limit, omits query-derived search titles, and keeps referrers origin-only.

No analytics consent banner was added because this task does not establish a repository consent policy. A privacy or legal review is required before adding another vendor, new identifiers or cookies, cross-route identity, more detailed URLs, marketing attribution, materially different retention, or a consent requirement. This record does not claim GDPR, PDPA, cookie-law, or other legal compliance.

## Measurement method

The baseline was built from `1d628a2796f0ef011385edde0c439ddcc735b35c` in a temporary detached worktree. Both sources used Node `24.18.0`, pnpm `10.34.5`, the frozen repository lockfile, and Vite `6.4.3`.

For synchronous bytes:

1. Run a production Vite build in memory with environment files disabled and source maps off.
2. Select the single `index.html` manifest entry.
3. Recursively follow only manifest `imports`; never follow `dynamicImports`.
4. Count unique JavaScript outputs and sum their UTF-8 bytes.
5. Gzip each output independently with Node `zlib.gzipSync` at level 9.
6. Inspect Rollup module associations for forbidden telemetry sources.

A separate manifest/source-map build was used only to verify module and dynamic-entry associations. The corrected build has one dedicated `PublicTelemetry` dynamic entry: 10,690 raw bytes and 3,802 gzip bytes in that audit build. Its shared imports are not presented as production transfer savings because Public page chunks may load some of them concurrently.

Request counts use deterministic Playwright interception. Google, Vercel, and every Public telemetry API are mocked; no production service is contacted. Playwright Clock advances heartbeat and polling time without waiting real minutes.

## Build result

| Synchronous `index.html` graph       |  Starting master | Corrected |            Delta |
| ------------------------------------ | ---------------: | --------: | ---------------: |
| JavaScript files                     |                1 |         1 |                0 |
| Raw JavaScript bytes                 |          389,608 |   375,507 | -14,101 (-3.62%) |
| Gzip JavaScript bytes                |          128,011 |   123,506 |  -4,505 (-3.52%) |
| Telemetry source/vendor associations | 6 groups present |      None |          Removed |

The starting static entry associated all of the following with its single index chunk:

- `@vercel/analytics`
- `@vercel/speed-insights`
- `src/shared/components/VercelInsights.tsx`
- `src/shared/components/PublicAnalytics.tsx`
- `src/shared/utils/publicAnalytics.ts`
- `src/features/site-view/**`

The corrected static entry associates none of them. They remain reachable through the dynamic Public telemetry entry.

## Request result

The visible-60-second cumulative scenario is: initial home load, an immediate focus plus visibility burst, then one heartbeat interval. “Hidden 60 seconds” reports only requests added while hidden.

| Deterministic scenario                                     | Starting master | Corrected |
| ---------------------------------------------------------- | --------------: | --------: |
| Initial home Site View POST                                |               1 |         1 |
| Initial home Presence POST                                 |               2 |         1 |
| Initial home visitor-stats GET                             |               1 |         0 |
| Focus plus visibility burst: additional Presence           |               2 |         0 |
| Visible 60 seconds: cumulative Presence                    |               5 |         2 |
| Visible 60 seconds: cumulative visitor-stats GET           |               4 |         1 |
| Hidden 60 seconds: additional Presence                     |               0 |         0 |
| Hidden 60 seconds: additional visitor-stats GET            |               0 |         0 |
| Return visible: additional Presence                        |               2 |         1 |
| Initial Public lazy telemetry module request               |               0 |         1 |
| Initial GTM script request                                 |               1 |         1 |
| Initial direct gtag script request                         |               0 |         0 |
| Initial Google explicit page view                          |               1 |         1 |
| Initial Public Vercel Analytics script request             |               1 |         1 |
| Initial Public Vercel Speed Insights script request        |               1 |         1 |
| Deprecated `both`: Google scripts                          |               2 |         1 |
| Deprecated `both`: explicit Google page views              |               1 |         1 |
| Auth/Admin sequence: first-party telemetry requests        |               0 |         0 |
| Auth/Admin sequence: Vercel Analytics script requests      |               2 |         0 |
| Auth/Admin sequence: Vercel Speed Insights script requests |               2 |         0 |
| Auth/Admin sequence: all measured telemetry requests       |               4 |         0 |

The corrected same-document `/` → `/news` → repeated `/news?token=…#…` → `/content/functional-public-content` scenario records exactly three Site Views, three Presence requests, and three Google page views. The query/hash-only repetition adds none. The home snapshot remains fresh throughout that short scenario, so visitor-stats adds no GET.

Public rendering also succeeds when the dynamic telemetry module is deliberately failed. Login, activation, password reset, and Admin tests assert zero Google scripts or page views, zero Vercel scripts or queues, zero Site View, Presence, or visitor-stats requests, and zero requests for `PublicTelemetry.tsx`.

## Committed budget and CI gate

`pnpm perf:check` enforces fixed ceilings:

| Metric                                       | Corrected actual | Fixed limit |       Headroom |
| -------------------------------------------- | ---------------: | ----------: | -------------: |
| Synchronous JavaScript files                 |                1 |           1 |              0 |
| Raw JavaScript bytes                         |          375,507 |     388,000 | 12,493 (3.33%) |
| Gzip JavaScript bytes                        |          123,506 |     127,000 |  3,494 (2.83%) |
| Forbidden synchronous telemetry associations |                0 |           0 |   None allowed |

The byte headroom is intentionally below the usual 5–10% range. A 5% ceiling would exceed the starting baseline. These limits remain below starting master by 1,608 raw bytes and 1,011 gzip bytes, so restoring the prior synchronous telemetry graph fails the gate. The check is dependency-free beyond repository-local Vite, runs entirely in memory, disables environment files, prints actual/limit/difference, and leaves no build output.

The GitHub Actions quality job runs `pnpm perf:check` immediately after the normal production build. The package `quality` chain includes the same gate.

## Reproduction

Baseline worktree:

```bash
git worktree add --detach <temporary-path> 1d628a2796f0ef011385edde0c439ddcc735b35c
cd <temporary-path>
pnpm install --frozen-lockfile
pnpm build
pnpm exec vite build --manifest --sourcemap --outDir .tmp/perf-baseline-dist
```

Corrected repository:

```bash
pnpm build
pnpm perf:check
pnpm exec playwright test tests/functional/publicTelemetry.spec.ts
pnpm exec playwright test tests/functional/cms-auth.spec.ts --grep "Public analytics and site-view tracking"
```

Temporary worktrees, manifests, source maps, Playwright reports, screenshots, and build output are removed after measurements.

## Limits

- These are local deterministic build estimates, not CDN transfer measurements.
- The static graph deliberately excludes dynamic imports and is not a total application bundle report.
- The dedicated telemetry chunk size is an emitted-build value, not a claim about cached or observed network transfer.
- Mocked scripts prove mount and route boundaries; they do not execute vendor collection logic. Unit tests cover the application-owned sanitizers.
- The request scenarios measure client behavior under the committed fixture, not production latency, vendor availability, Web Vitals, or real-user traffic.
- No Lighthouse, production network, Core Web Vitals score, deployment, privacy-compliance, or legal-compliance claim is made.
