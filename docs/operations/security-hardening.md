# Security Hardening Notes

M21 adds baseline response headers for the Vercel frontend/admin app and the Cloudflare Worker API.

## Vercel Frontend Headers

Configured in `vercel.json` for all routes:

- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Frame-Options: DENY`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`

HSTS preload is intentionally not enabled.

## Worker Headers

Applied centrally to Worker responses after the existing CORS wrapper:

- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: no-referrer`
- `X-Frame-Options: DENY`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()`
- `Cross-Origin-Resource-Policy: same-site`

Existing CORS behavior is preserved.

## CSP Status

Strict CSP is deferred. The current site includes third-party and embedded media surfaces, so CSP should be introduced after an inventory of required `script-src`, `style-src`, `img-src`, `frame-src`, and reporting endpoints.

Recommended follow-up: start with `Content-Security-Policy-Report-Only` in preview, review reports, then move to enforcement after false positives are resolved.

## Current Dependency And Auth Boundary

- `pnpm audit` is clean after patching the ESLint/minimatch `brace-expansion` path and the plugin-react/React-Hooks `@babel/core` path.
- Deprecated transitives remain documented in `docs/development/current-warning-inventory.md`; neither is application runtime code.
- `bcryptjs@2.4.3` remains server-side authentication code and is not reachable from the browser build. A bcrypt major update is deferred because it requires explicit authentication compatibility testing.
- Real D1 IDs, Access AUD values, credentials, and private deployment values must remain outside tracked files. Repository guard tests intentionally fail when such values appear in tracked Wrangler configuration.

## Cloudflare Recommendations

- Keep the CMS Session boundary enforced for every admin entry point.
- Add rate limits for admin proxy and Worker admin API paths.
- Add WAF rules for obvious scanner traffic against `/api/admin/*`.
- Alert on repeated 401/403 responses for admin backup and write endpoints.
- Keep D1 backup files outside public storage and source control.
