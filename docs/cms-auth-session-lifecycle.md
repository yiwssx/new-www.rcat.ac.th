# CMS Session Lifecycle

Updated: 2026-09-16.

This document describes current CMS Session behavior after the active-editor reliability fix and the Session-first authorization-bootstrap correction. It supplements `docs/cms-auth-final-cutover.md`.

## Server-Authoritative Policy

- idle lifetime: 30 minutes;
- absolute lifetime: 8 hours;
- server touch threshold: 5 minutes.

The browser cannot extend absolute lifetime or declare a Session valid. Every keepalive is validated by the backend.

## Authorization Bootstrap Ordering

Frontend authorization state is read sequentially. The Session is authoritative and must be confirmed before Admin capabilities are requested.

1. Read `/api/cms-auth/session`.
2. Only after that read succeeds, request `/api/admin/capabilities` through the same-origin Admin proxy.
3. If the Session read returns `401`, stop immediately and do not request capabilities.
4. Bounded `401` retry or confirmation paths preserve the same Session-first ordering.
5. Authorization-read retries apply only to idempotent reads; mutations are never replayed by this mechanism.

Therefore a fresh unauthenticated `/login` may show the expected Session `401`, but it must not produce an anonymous capability request. An unauthenticated `/admin` navigation follows the same rule before redirecting to Login. After password or MFA authentication succeeds, the frontend refreshes the Session first and then loads the authenticated user's capabilities before committing authenticated Admin state.

## Original Failure Mode

An Admin could log in, open Content Editor, type locally for more than 30 minutes without authenticated backend traffic, then press Save/Publish and receive `401 CMS session is invalid or expired`.

From the operator's perspective the user was active; from the server's perspective no request touched the Session.

## Activity-Aware Keepalive

While authenticated, visible, and recently active, the frontend may periodically refresh/validate the Session using the existing CMS Session path.

The cadence is aligned with backend touch policy rather than firing per keypress/click. Activity events update lightweight local refs/state; they do not send a request per event.

A successful keepalive follows the same authorization ordering: Session validation succeeds before capabilities are refreshed.

## Idle and Absolute Expiration

A tab that is open but untouched must not keep a Session alive indefinitely. If meaningful activity stops, heartbeat behavior stops and backend idle expiry remains effective.

Continuous activity does not create an infinite Session; absolute expiry remains server-enforced.

## Visibility and Concurrency

Hidden/background tabs must not continuously poll only to preserve authentication.

Refreshes are deduplicated. Keepalive must not create parallel request storms, BroadcastChannel loops, stale-response races, or repeated auth-cache resets.

## Failure Classification

A trusted genuine Session-expiration `401` may clear auth state.

Network failure, `500`, `502`, `503`, or temporary Vercel/Worker outages must not automatically be treated as Session expiration.

## Admin Proxy 401 Handling

The Admin proxy must not label every upstream `401` as `CMS session is invalid or expired`. Known non-Session authentication failures keep a finite non-Session contract, and arbitrary private upstream detail must not leak.

A proxy-side authorization `401` that requires frontend confirmation may trigger one bounded idempotent authorization re-read. That confirmation still reads the Session first and reaches capabilities only if the Session read succeeds.

## Unsaved Content Recovery

Because genuine Session expiration can unmount protected Admin UI, Content Editor protects unsaved content with draft recovery behavior.

Recovery storage must never contain passwords, Session tokens, CSRF tokens, MFA secrets, or Recovery Codes.

## Security Properties Preserved

The reliability fix and Session-first capability gate do not remove idle timeout, absolute timeout, CSRF, RBAC, MFA, step-up authentication, Session revocation, Session-version enforcement, or server-side user-status checks.

Capabilities remain authorization data derived after authenticated Session validation; they are not an authentication probe and must not be fetched anonymously during frontend bootstrap.

## Testing

Focused tests should cover recent activity refresh, inactivity, hidden-document behavior, one refresh in flight, stale refresh safety, genuine Session `401`, temporary `5xx`/network failure, unsaved draft recovery, and Session-before-capabilities ordering.

The regression contract should explicitly verify:

- unauthenticated `/login`: Session read occurs and capability request count remains zero;
- unauthenticated `/admin`: redirect to Login occurs without an anonymous capability request;
- authenticated Login/session restoration: capabilities load only after a successful Session read.

Use fake timers only where behavior is genuinely time-dependent and restore real timers after each test.

## Deployment

Deployment depends on the diff:

- frontend auth/session code -> Vercel;
- Vercel Admin proxy -> Vercel;
- Worker source/config -> Cloudflare Worker;
- new migration -> D1 migration.
