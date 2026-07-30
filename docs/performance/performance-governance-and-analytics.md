# Performance Governance and Analytics

- Document status: active
- Canonical: true

## Scope

This document defines the current frontend telemetry boundaries and the
deterministic performance budget for the static Vite entry graph. The controls
apply to Public, Auth, and Admin routes without changing Cloudflare Worker
routes, D1 schemas, CMS authentication, the Vercel admin proxy, or public
content APIs.

## Telemetry ownership

| System                  | Owner and purpose                                       | Route scope                           | Trigger                                                                  | Maximum frequency                                                                                         | Persistence                                                |
| ----------------------- | ------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Google GTM or direct GA | Explicit Public audience page views                     | Genuine Public routes only            | Normalized Public navigation                                             | One explicit `page_view` per normalized pathname; exactly one Google transport owns it                    | Google transport; no new application persistence           |
| Vercel Analytics        | Deployment analytics                                    | Genuine Public routes only            | Public telemetry boundary and SDK navigation tracking                    | One script mount per document; event frequency remains SDK-managed                                        | Vercel service; no new application persistence             |
| Vercel Speed Insights   | Deployment Web Vitals and real-user monitoring          | Genuine Public routes only            | Public telemetry boundary and SDK collection                             | One script mount per document; sampling remains SDK-managed                                               | Vercel service; no new application persistence             |
| First-party Site View   | Public view, daily-view, and anonymous visitor counters | Genuine Public routes only            | First visit to a normalized path                                         | One POST per anonymous visitor and normalized path within 30 minutes                                      | Existing visitor identifier and Cloudflare Worker/D1 data  |
| First-party Presence    | Approximate online visitor state                        | Genuine Public routes only            | Initial visible route, new Public route, heartbeat, or return to visible | At most one POST for the same path per 60-second heartbeat window; a new Public path may send immediately | In-memory coordinator and Cloudflare Worker/D1 data        |
| Visitor-stats GET       | Aggregate counter display                               | Public home counter only when enabled | Stale visible interval, stale focus, or stale reconnect                  | No GET for a fresh snapshot; at most one GET per 60 seconds while visible; five-minute failure backoff    | Shared React Query cache retains the latest valid snapshot |

These systems are not interchangeable. Google owns the explicit audience page
view, Vercel owns deployment analytics and RUM, Site View owns first-party
counters, Presence owns approximate online state, and visitor-stats GET only
refreshes displayed aggregates.

`VITE_PUBLIC_ANALYTICS_STRATEGY=both` remains a deprecated alias for the
canonical GTM transport; it does not initialize GTM and direct `gtag` together.
Direct `gtag` mode sets `send_page_view: false` before the single explicit page
view.

## Public, Auth, and Admin boundaries

`src/shared/telemetry/publicTelemetryRoutes.ts` is the shared route policy for
Google, Vercel Analytics, Speed Insights, Site View, and Presence. It strips
query strings, hashes, and trailing slashes before determining scope.

Telemetry is blocked for:

- `/login`
- `/activate-account`
- `/reset-password`
- `/admin` and all `/admin/**` paths

Near matches such as `/administrator` remain Public. Public pages and
permalinks remain allowed.

`PublicRouteLayout` dynamically imports the optional `PublicTelemetry` entry.
Its null Suspense fallback and local silent error boundary keep Public
rendering independent of telemetry availability. `RootRouteLayout`, Auth, and
Admin do not synchronously import or mount Public telemetry. Functional tests
verify that Auth and Admin navigation requests no Google or Vercel scripts, no
first-party telemetry endpoints, and no Public telemetry chunk.

## Data minimization

Google page views contain only:

- `page_path`: normalized pathname;
- `page_location`: current origin plus normalized pathname; and
- `page_title`: current document title, except for the query-derived search
  title.

Arbitrary queries, hashes, search strings, reset or invitation tokens, email
addresses, CMS identifiers, authentication state, and browser-storage values
are excluded. Vercel `beforeSend` hooks reject non-Public events and replace
event URLs with the origin plus normalized pathname. First-party Site View uses
an anonymous visitor identifier, a safe title limited to 120 characters, and
an origin-only referrer.

Adding a vendor, identifier, cookie, cross-route identity, detailed URL,
marketing attribution, different retention policy, or consent requirement
requires a separate privacy and legal review. These engineering controls do not
claim legal compliance.

## Deterministic measurement method

`pnpm perf:check` creates a production Vite build in memory with environment
files disabled, source maps disabled, and no filesystem output. The checker:

1. selects the single `index.html` manifest entry;
2. recursively follows only static `imports`;
3. excludes `dynamicImports`;
4. counts every unique JavaScript output in the static graph;
5. sums the UTF-8 byte length of those outputs;
6. gzips each output independently with Node zlib level 9 and sums the result;
   and
7. inspects output-chunk module associations for forbidden telemetry sources.

The checker fails closed for a missing or malformed manifest, a missing static
import, a missing output chunk, missing module associations, duplicate output
files, exceeded limits, or forbidden telemetry ownership.

Vite 8 uses Rolldown and emits shared modules across multiple chunks. The
measurement therefore follows the full recursive static manifest graph rather
than assuming a single entry chunk.

## Current performance budget

The fixed constants in `scripts/public-performance-budget.mjs` are:

| Metric                                       |   Limit |
| -------------------------------------------- | ------: |
| Synchronous JavaScript files                 |      14 |
| Synchronous JavaScript raw bytes             | 460,000 |
| Synchronous JavaScript gzip bytes            | 148,000 |
| Forbidden synchronous telemetry associations |       0 |

The last reviewed Vite 8 static graph measured 14 JavaScript files, 432,228 raw
bytes, and 140,575 gzip bytes. These measurements are evidence for the current
limits, not additional limits.

## Forbidden synchronous telemetry associations

The static `index.html` graph must not associate any module path containing:

- `/node_modules/@vercel/analytics/`
- `/node_modules/@vercel/speed-insights/`
- `/src/shared/telemetry/PublicTelemetry.tsx`
- `/src/shared/components/VercelInsights.tsx`
- `/src/shared/components/PublicAnalytics.tsx`
- `/src/shared/utils/publicAnalytics.ts`
- `/src/features/site-view/`

Telemetry may remain reachable only through the dynamic Public telemetry
boundary. Any association above fails the performance gate even when byte
limits pass.

## Accepted reviewed performance rebaseline

React 19 and Material UI 9 increased the reviewed synchronous JavaScript bytes
relative to the prior framework baseline. Vite 8 and Rolldown then changed the
reviewed static topology from one JavaScript output to fourteen while retaining
lazy telemetry isolation. These changes are an accepted reviewed performance
rebaseline.

The byte ceilings were not increased for the Vite 8 topology change, and the
file-count ceiling is exact. A fifteenth static JavaScript file, byte-budget
excess, or forbidden association fails CI. This rebaseline does not
characterize the migration as regression-free.

## CI commands

The active verification path is:

```text
pnpm exec vitest run scripts/public-performance-budget.test.mjs
pnpm build
pnpm perf:check
pnpm test:functional
```

The GitHub Actions quality job runs the normal build before `pnpm perf:check`.
The package `quality` chain also includes the performance gate. Budget tests
lock the Vite 8 file-count ceiling and fail-closed manifest behavior.

## Reproduction

From the repository root with the pinned Node and pnpm versions:

```bash
pnpm install --frozen-lockfile --strict-peer-dependencies
pnpm exec vitest run scripts/public-performance-budget.test.mjs
pnpm perf:check
pnpm exec playwright test tests/functional/publicTelemetry.spec.ts
```

`pnpm perf:check` prints actual values, limits, differences, forbidden
associations, and an overall result. It leaves no tracked build output.
Playwright intercepts telemetry traffic in deterministic fixtures; it does not
contact production services.

## Current limitations

- The byte totals are deterministic local build estimates, not CDN transfer
  measurements.
- The static graph excludes dynamic imports and is not a total application
  bundle report.
- Per-chunk gzip totals do not model every browser cache or compression path.
- Mocked scripts prove application-owned mount and route boundaries but do not
  execute vendor collection logic.
- Fixture request counts do not measure production latency, vendor
  availability, Web Vitals, or real-user traffic.
- The checks make no Lighthouse score, deployment, privacy-compliance, or
  legal-compliance claim.
