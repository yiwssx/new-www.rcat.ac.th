# Performance Governance and Analytics

- Document status: active
- Canonical: true

## Scope

This document defines frontend telemetry boundaries, deterministic static-entry
measurement, and the relationship between build-time evidence and real-user
performance. Public, Auth, and Admin route ownership remains unchanged.

Static JavaScript byte counts are not Vercel Speed Insights thresholds and are
not treated as a substitute for field Web Vitals. The blocking build-time
performance rule is architectural: Public telemetry must remain outside the
synchronous application entry graph, and the deterministic build analysis must
remain valid and reproducible.

## Telemetry ownership

| System                  | Owner and purpose                                       | Route scope                           | Trigger                                                                  | Maximum frequency                                                                                         | Persistence                                                |
| ----------------------- | ------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Google GTM or direct GA | Explicit Public audience page views                     | Genuine Public routes only            | Normalized Public navigation                                             | One explicit `page_view` per normalized pathname; exactly one Google transport owns it                    | Google transport; no new application persistence           |
| Vercel Analytics        | Deployment analytics                                    | Genuine Public routes only            | Public telemetry boundary and SDK navigation tracking                    | One script mount per document; event frequency remains SDK-managed                                        | Vercel service; no new application persistence             |
| Vercel Speed Insights   | Deployment Web Vitals and real-user monitoring          | Genuine Public routes only            | Public telemetry boundary and SDK collection                             | One script mount per document; sampling remains SDK-managed                                               | Vercel service; no new application persistence             |
| First-party Site View   | Public view, daily-view, and anonymous visitor counters | Genuine Public routes only            | First visit to a normalized path                                         | One POST per anonymous visitor and normalized path within 30 minutes                                      | Existing visitor identifier and Cloudflare Worker/D1 data  |
| First-party Presence    | Approximate online visitor state                        | Genuine Public routes only            | Initial visible route, new Public route, heartbeat, or return to visible | At most one POST for the same path per 60-second heartbeat window; a new Public path may send immediately | In-memory coordinator and Cloudflare Worker/D1 data        |
| Visitor-stats GET       | Aggregate counter display                               | Public home counter only when enabled | Stale visible interval, stale focus, or stale reconnect                  | No GET for a fresh snapshot; at most one GET per 60 seconds while visible; five-minute failure backoff    | Shared React Query cache retains the latest valid snapshot |

These systems are not interchangeable. Vercel Speed Insights owns field Web
Vitals evidence; the local static-entry checker does not infer LCP, INP, CLS,
network latency, CDN transfer size, or a Speed Insights score.

## Public, Auth, and Admin boundaries

`src/shared/telemetry/publicTelemetryRoutes.ts` is the shared route policy for
Google, Vercel Analytics, Speed Insights, Site View, and Presence. It strips
query strings, hashes, and trailing slashes before determining scope.

Telemetry is blocked for `/login`, `/activate-account`,
`/reset-password`, `/admin`, and all `/admin/**` paths. Near matches such
as `/administrator` remain Public.

`PublicRouteLayout` dynamically imports the optional `PublicTelemetry`
entry. Its null Suspense fallback and local silent error boundary keep Public
rendering independent of telemetry availability. Root, Auth, and Admin must not
synchronously import or mount Public telemetry.

## Data minimization

Google page views contain only normalized public path, origin plus normalized
path, and the current safe document title. Arbitrary queries, hashes, search
strings, reset or invitation tokens, email addresses, CMS identifiers,
authentication state, and browser-storage values are excluded.

Adding a vendor, identifier, cookie, cross-route identity, detailed URL,
marketing attribution, different retention policy, or consent requirement
requires a separate privacy and legal review.

## Deterministic measurement method

`pnpm perf:check` creates a production Vite build in memory with environment
files disabled, source maps disabled, and no filesystem output. The checker:

1. selects the single `index.html` manifest entry;
2. recursively follows only static `imports`;
3. excludes `dynamicImports`;
4. records every unique JavaScript output in that graph;
5. records UTF-8 raw bytes and independent level-9 gzip bytes;
6. inspects output-chunk module associations for forbidden telemetry sources;
7. fails closed for malformed or incomplete build metadata; and
8. hard-fails when forbidden telemetry is synchronously associated.

The JavaScript file count and byte measurements are evidence for comparison and
investigation. They do not independently fail CI merely because a reviewed
framework update changes bundle topology or byte size.

## Current deterministic reference

The committed reviewed reference is:

| Metric                                       | Reference |
| -------------------------------------------- | --------: |
| Synchronous JavaScript files                 |        14 |
| Synchronous JavaScript raw bytes             |   432,228 |
| Synchronous JavaScript gzip bytes            |   140,575 |
| Forbidden synchronous telemetry associations |         0 |

The first three values are informational comparison anchors. They are not
ceilings and are not proxies for Speed Insights. The forbidden-association
value is a blocking architecture rule.

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
boundary. Any association above fails `pnpm perf:check`.

## Reviewed static baseline

The React 19, Material UI 9, Vite 8, and Rolldown migrations changed static
bundle topology and bytes. Those measurements remain useful for explaining
release-to-release changes, but acceptance is based on architecture correctness,
full functional checks, and field performance evidence rather than treating an
arbitrary static byte delta as a Web Vitals regression.

A material unexplained static increase should still be investigated in review.
If representative production Speed Insights p75 metrics regress, use route and
device evidence to diagnose and correct the runtime behavior.

## CI commands

The active verification path is:

```text
pnpm exec vitest run scripts/public-performance-budget.test.mjs
pnpm build
pnpm perf:check
pnpm test:functional
```

The GitHub Actions Governance job runs `pnpm perf:check`. The command remains
blocking for malformed build evidence and telemetry-boundary violations.

## Reproduction

From the repository root with the pinned Node and pnpm versions:

```bash
pnpm install --frozen-lockfile --strict-peer-dependencies
pnpm exec vitest run scripts/public-performance-budget.test.mjs
pnpm perf:check
pnpm exec playwright test tests/functional/publicTelemetry.spec.ts
```

`pnpm perf:check` prints actual values, reviewed-reference deltas, forbidden
associations, and the architecture result. It leaves no tracked build output.

## Current limitations

- Static byte totals are deterministic local build measurements, not CDN
  transfer measurements.
- The static graph excludes dynamic imports and is not a total application
  bundle report.
- Per-chunk gzip totals do not model every browser cache or compression path.
- Static bytes cannot determine LCP, INP, CLS, network latency, or perceived
  responsiveness.
- Mocked telemetry scripts prove application-owned mount and route boundaries,
  not vendor collection behavior.
- Production performance decisions use representative RUM/Speed Insights
  evidence together with runtime errors and route/device context.
