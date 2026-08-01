# CMS Session Lifecycle

Updated: 2026-08-01.

This document describes current CMS Session behavior after the active-editor reliability fix. It supplements `docs/cms-auth-final-cutover.md`.

## Server-Authoritative Policy

- idle lifetime: 30 minutes;
- absolute lifetime: 8 hours;
- server touch threshold: 5 minutes.

The browser cannot extend absolute lifetime or declare a Session valid. Every keepalive is validated by the backend.

## Original Failure Mode

An Admin could log in, open Content Editor, type locally for more than 30 minutes without authenticated backend traffic, then press Save/Publish and receive `401 CMS session is invalid or expired`.

From the operator's perspective the user was active; from the server's perspective no request touched the Session.

## Activity-Aware Keepalive

While authenticated, visible, and recently active, the frontend may periodically refresh/validate the Session using the existing CMS Session path.

The cadence is aligned with backend touch policy rather than firing per keypress/click. Activity events update lightweight local refs/state; they do not send a request per event.

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

## Unsaved Content Recovery

Because genuine Session expiration can unmount protected Admin UI, Content Editor protects unsaved content with draft recovery behavior.

Recovery storage must never contain passwords, Session tokens, CSRF tokens, MFA secrets, or Recovery Codes.

## Security Properties Preserved

The reliability fix does not remove idle timeout, absolute timeout, CSRF, RBAC, MFA, step-up authentication, Session revocation, Session-version enforcement, or server-side user-status checks.

## Testing

Focused tests should cover recent activity refresh, inactivity, hidden-document behavior, one refresh in flight, stale refresh safety, genuine Session `401`, temporary `5xx`/network failure, and unsaved draft recovery.

Use fake timers only where behavior is genuinely time-dependent and restore real timers after each test.

## Deployment

Deployment depends on the diff:

- frontend auth/session code -> Vercel;
- Vercel Admin proxy -> Vercel;
- Worker source/config -> Cloudflare Worker;
- new migration -> D1 migration.
