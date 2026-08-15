# Request Correlation

Updated: 2026-08-15.

RCAT uses an operational request ID to correlate failures across the Vercel server boundary and the Cloudflare Worker without turning request tracing into an authentication or user-identity mechanism.

## Header

The correlation header is:

`X-RCAT-Request-ID`

Request IDs are UUID-shaped opaque operational values. They are not credentials, session identifiers, CSRF tokens, audit actors, or authorization inputs.

## Current Ownership

### Vercel Admin proxy

- The Vercel Admin proxy creates a fresh server-owned request ID at the beginning of every request.
- A browser-provided `X-RCAT-Request-ID` is not trusted or reused by the Vercel entry point.
- The same ID is returned on the Vercel response and forwarded to the private Worker request.
- Worker responses therefore carry the same ID for the Admin proxy path.

### CMS authentication entry point

- The CMS auth dispatcher creates a fresh server-owned request ID before route selection.
- The ID is present even for rejected/unknown CMS auth routes, which makes support correlation possible for 4xx outcomes.
- The canonical request adapter preserves the same request ID when dispatching to the selected auth handler.
- The dispatcher injects a correlation-aware `fetchImpl` into the selected handler. Existing CMS private headers, cookies, tokens, payloads, rate limits, and MFA/lifecycle logic remain owned by `handlers.mjs`; the wrapper adds only `X-RCAT-Request-ID` to the outgoing Worker request.
- Login, session, logout, lifecycle, password, and MFA Worker calls therefore preserve the same server-owned request ID without rewriting the 48 KB auth handler monolith.

### Cloudflare Worker

- Direct Public Worker requests receive a newly generated Worker request ID.
- Public callers cannot select their own Worker request ID merely by sending the header.
- A valid incoming request ID is reused only on the private `/api/admin/*` and `/api/internal/cms-auth/*` boundaries when the supplied CMS proxy secret exactly matches the configured Worker proxy secret.
- Every Worker response receives `X-RCAT-Request-ID`, including generic top-level 500 responses.

## Privacy-Safe Logging

Operational correlation logs are deliberately narrow. They may contain:

- request ID;
- component and finite event name;
- HTTP method;
- pathname without query string;
- HTTP status when relevant;
- JavaScript error class/name.

They must not contain:

- request or response bodies;
- cookies or session tokens;
- CSRF/MFA/recovery/invitation/password-reset tokens;
- proxy secrets or authorization headers;
- raw query strings;
- email addresses, usernames, IP addresses, or user agents merely for correlation;
- exception messages or stack traces when those may include upstream/private data.

The Admin proxy logs only unexpected upstream request/response failures under this contract. The Worker logs only uncaught top-level exceptions under this contract.

## Support Workflow

When a user reports an Admin/CMS error, capture the `X-RCAT-Request-ID` response header together with the approximate time and affected page. Search Vercel/Worker operational logs by request ID first. Do not ask users to provide session cookies, tokens, request bodies, or screenshots containing credentials when the request ID is sufficient.

## Maintainability Next Step

CMS request correlation is now end-to-end without requiring a whole-file rewrite of `server/cmsAuth/handlers.mjs`. The next maintainability phase can therefore split that file by business responsibility rather than by observability pressure. Prefer extracting shared protocol/upstream primitives first, then login/session, lifecycle, password, and MFA handlers in small behavior-preserving PRs with the existing authentication regression suite kept intact.
