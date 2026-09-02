# P6B Security Enforcement

Status: closed on 2026-08-29.

Requested scope: CSP cleanup/enforcement + Admin/API rate limits + WAF + auth anomaly alerts.

## Runtime ownership correction

Production browser traffic terminates at Vercel. Vercel owns the public SSR/frontend and same-origin CMS/Admin proxies. The Cloudflare Production Worker owns structured Admin/Auth API execution and D1 owns authoritative state.

P6B therefore does **not** manage a zone-level Cloudflare WAF for `www.rcat.ac.th`. The earlier zone reconciliation candidate was retired after production evidence showed that the browser-facing WAF boundary belongs to Vercel, while Cloudflare is the backend Worker/D1 boundary.

## CSP

CSP is enforcing in production with a per-request cryptographic nonce for public SSR. The policy does not use `unsafe-eval`. Representative production browser smoke covers public SSR/navigation, complaint, Facebook content, login, Admin, and Admin media surfaces.

The CSP report collector remains `/api/csp-report`, and rollback ownership/readiness evidence remains governed by `config/csp-enforcement-readiness.json`.

## Vercel edge WAF

Root `middleware.ts` runs as Vercel Routing Middleware on `/api/:path*` and applies `server/security/edgeWafPolicy.ts` before same-origin API functions.

The policy:

- denies direct browser access to `/api/internal/*`;
- rejects cross-site requests to `/api/cms-auth/*` and `/api/admin-proxy`;
- rejects TRACE/CONNECT on sensitive API surfaces;
- rejects oversized CMS Auth/Admin proxy request bodies before function execution;
- emits the non-sensitive marker `X-RCAT-Edge-WAF: p6b-vercel-v1` for production verification.

`scripts/p6b-edge-waf-production-smoke.mjs` verifies both a safe denied internal probe and same-origin forwarding without requiring production credentials. The scheduled production WAF smoke runs every six hours at minute 47.

## Admin/API rate limits

The authoritative Cloudflare Worker uses two Cloudflare Rate Limiting bindings:

- `CMS_AUTH_RATE_LIMITER`: 30 requests per 60 seconds per trusted client-IP key;
- `ADMIN_API_RATE_LIMITER`: 120 requests per 60 seconds per trusted client-IP key.

Rate limiting runs only after the Worker has accepted the Vercel proxy trust boundary: CMS Auth first validates the shared proxy secret, while Admin API first validates the CMS proxy/session metadata. Client IP is then hashed with SHA-256 before it is used as a rate-limit key. Raw client IP is not persisted by this guard.

Production fails closed when a required sensitive-route rate-limit binding or trusted proxy client metadata is unavailable. A limit breach returns HTTP 429 with `Retry-After`.

## Auth anomaly detection and diagnostic

As of 2026-09-02, the D1-backed auth anomaly query is no longer part of the scheduled six-hour production security run. Scheduled polling was removed so the monitoring workflow does not consume D1 reads merely to discover that no authentication anomaly occurred.

The protected `Auth Anomaly Diagnostic` remains available through `workflow_dispatch` for explicit investigation. When started manually, it queries only aggregate counts derived from:

- `admin_credentials.failed_login_count` and recent `updated_at` state;
- `admin_mfa_challenges.failed_attempt_count` in the lookback window.

The diagnostic query does not select username, email, IP address, user-agent, session token, MFA secret, or credential material. It remains behind the protected GitHub `production` Environment reviewer requirement.

Default diagnostic severity for the 135-minute lookback remains:

- healthy: no failed auth/MFA state;
- info: 1-9 failed auth/MFA state and no locked account;
- warning: 10-29 failed states or at least one locked account;
- critical: 30+ failed states or three or more locked accounts.

Password failures also emit a structured Worker security log when the existing failed-login counter reaches the lockout threshold. The signal is derived from the existing `UPDATE ... RETURNING failed_login_count, locked_until` result, so no additional D1 query is introduced for that event signal. The structured event contains severity, event name, component, failure count, lock state, and timestamp; it does not include username, email, IP, password, credential hash, session token, or MFA secret.

MFA aggregate investigation remains available through the manual diagnostic. No scheduled D1 MFA polling is performed.

## Closure evidence

P6B was explicitly reopened for completion and closed after the runtime-aligned production gates passed.

- PR #164 introduced the P6B security baseline and candidate CSP; merge SHA `08b72d85a99b14ae54774b4312471dd9859d5121`.
- Candidate CSP production smoke run `33261803140` passed the representative surfaces.
- PR #165 switched CSP to enforcement; merge SHA `8d9d042043e2703a4282bccbd5d8203910e4b538`.
- Enforcing CSP production smoke run `33262928370` passed.
- PR #167 aligned P6B with actual Vercel/Worker runtime ownership; merge SHA `b04aae856d56f3249de9b2089e9d965b27abc399`.
- Master CI run `33270467362` passed all lanes and the aggregate `quality` gate.
- Vercel production deployment for `b04aae856d56f3249de9b2089e9d965b27abc399` reached READY and the edge WAF production smoke passed.
- P6B Production Security run `33271055270` passed both the Vercel edge WAF smoke and the protected D1 auth anomaly query.
- The auth anomaly result was healthy: `0` failed auth/MFA attempt states and `0` locked accounts in the 135-minute lookback.
- Worker Production Release run `33271266147` deployed the same master SHA to production.
- That release reported `CMS_AUTH_RATE_LIMITER (30 requests/60s)` and `ADMIN_API_RATE_LIMITER (120 requests/60s)` as active Worker bindings and completed successfully.
- PR #203 reduced scheduled monitoring cadence to six hours, removed scheduled D1 auth polling, and added the no-extra-query password failure threshold log signal.

All six original activation gates remain satisfied. P6B stays closed; the 2026-09-02 changes are maintenance of the established production security baseline.

## Next phase

P6C Recovery & Reliability is historical and completed. Future security or product changes should use a new maintenance/feature scope rather than reopening P6B solely for routine guard maintenance.
