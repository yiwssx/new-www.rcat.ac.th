# Security Hardening Notes

M21 adds baseline response headers for the Vercel frontend/admin app and the Cloudflare Worker API. The August 2026 hardening pass adds a report-only CSP baseline and separates public analytics write origins from intentionally open public-read CORS.

## Vercel Frontend Headers

Configured in `vercel.json` for all routes:

- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Frame-Options: DENY`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `Content-Security-Policy-Report-Only` with the current application/media boundary

HSTS preload is intentionally not enabled.

## CSP Rollout

CSP is now present in report-only mode rather than being enforced immediately. The baseline intentionally models the current runtime without risking a production outage:

- `default-src 'self'`
- `base-uri 'self'`
- `object-src 'none'`
- `frame-ancestors 'none'`
- `form-action 'self'`
- `script-src 'self'`
- `style-src 'self' 'unsafe-inline'` while Emotion/MUI inline styles remain part of the current rendering contract
- `img-src 'self' data: blob: https:` while external CMS/media image hosts are inventoried
- `font-src 'self' data:`
- `connect-src 'self' https://*.workers.dev https://*.rcat.ac.th` for same-origin Vercel telemetry/proxies and the Cloudflare public API
- `frame-src https://www.facebook.com` for the approved Facebook post/Reel plugin
- `media-src 'self' blob: https:`
- `worker-src 'self' blob:`
- `manifest-src 'self'`

The next CSP step is evidence-driven enforcement: review browser/report-only violations on representative Public, auth, Admin, media, complaint, Facebook embed, and SSR routes; narrow broad `https:` media allowances where practical; then replace the report-only header with `Content-Security-Policy` only after false positives are resolved. Do not add `unsafe-eval` merely to silence a report.

## Worker Headers

Applied centrally to Worker responses after the CORS wrapper:

- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: no-referrer`
- `X-Frame-Options: DENY`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()`
- `Cross-Origin-Resource-Policy: same-site`

## Worker CORS And Public Analytics Origins

Public structured reads and public analytics writes now have separate cross-origin policies:

- Public GET/read routes retain the existing open fallback (`Access-Control-Allow-Origin: *`) when `PUBLIC_API_ALLOWED_ORIGINS` is not configured. This preserves intentional public-read interoperability.
- Public-read preflight retains the existing compatibility advertisement `GET, POST, OPTIONS`; the router still rejects unsupported actual POST routes with `405 Method Not Allowed`.
- `/api/public/site-view`, `/api/public/presence`, and `/api/public/content-view` use `PUBLIC_ANALYTICS_ALLOWED_ORIGINS` and advertise only `POST, OPTIONS`.
- Browser-origin analytics requests fail closed when the analytics allowlist is missing or does not contain the normalized request origin.
- The Worker also rejects an actual analytics POST carrying an untrusted `Origin` before the write reaches D1.
- Requests without an `Origin` remain available to non-browser/server-to-server tooling and continue to be governed by the existing D1-backed public analytics rate limits.
- Production tracks `https://www.rcat.ac.th` as the approved analytics browser origin. Preview/local environments must declare their own explicit analytics origin when browser telemetry is intentionally exercised.
- Admin CORS remains credentialed and fail-closed through `ADMIN_WRITE_ALLOWED_ORIGINS`.

`PUBLIC_ANALYTICS_ALLOWED_ORIGINS` is not a secret. It is a deployment policy value and should contain only trusted browser origins, comma-separated when more than one is required.

## Current Dependency And Auth Boundary

- Current full-tree and production audit results are recorded in
  `docs/maintenance/dependency-current-status.md`.
- Deprecated transitives remain documented in `docs/development/current-warning-inventory.md`; neither is application runtime code.
- The completed `bcryptjs` migration retains server-side authentication
  ownership and browser-bundle isolation. Hash/compare, legacy verification,
  lockout, disabled-user, session, MFA, recovery, and fail-closed algorithm
  behavior remain guarded by authentication tests.
- Real D1 IDs, Access AUD values, credentials, and private deployment values must remain outside tracked files. Repository guard tests intentionally fail when such values appear in tracked Wrangler configuration.

## Cloudflare Recommendations

- Keep the CMS Session boundary enforced for every admin entry point.
- Keep public analytics rate limits in addition to the browser-origin guard; CORS/origin checks are not a substitute for abuse controls.
- Add rate limits for admin proxy and Worker admin API paths.
- Add WAF rules for obvious scanner traffic against `/api/admin/*`.
- Alert on repeated 401/403 responses for admin backup and write endpoints.
- Keep D1 backup files outside public storage and source control.
