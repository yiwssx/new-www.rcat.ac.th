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
- Propagating this ID from the current monolithic `server/cmsAuth/handlers.mjs` private-header builder to every Worker auth call is intentionally deferred to the handler modularization phase. The 48 KB auth handler is already a maintainability hotspot; correlation does not justify a large whole-file rewrite that could destabilize login, session, MFA, recovery, and lifecycle behavior.

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

## Next Step

When `server/cmsAuth/handlers.mjs` is split into focused modules, move private Worker-header construction into a shared CMS upstream client and propagate the dispatcher-owned request ID there. Add tests that prove login/session/MFA/lifecycle requests preserve the same ID across Vercel and Worker before calling CMS correlation end-to-end complete.
