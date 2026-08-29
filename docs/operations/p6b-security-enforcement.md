# P6B Security Enforcement

Status: implementation candidate; production activation gates pending.

Requested scope: CSP cleanup/enforcement + Admin/API rate limits + WAF + auth anomaly alerts.

## CSP

P6B moves the global policy toward enforcement without using `unsafe-eval`. Public SSR receives a per-request cryptographic nonce which is passed to TanStack Router SSR script rendering. The first deployment remains Report-Only and is validated against representative production routes by the `P6B CSP Production Smoke` workflow before the final enforcement switch.

The candidate policy explicitly classifies the third-party surfaces observed in earlier production evidence: Google Tag Manager, Facebook, YouTube/YouTube No-Cookie, Google forms/frames, and Google Drive frames. The CSP report collector remains `/api/csp-report`.

## Admin/API rate limits and WAF

`P6B Production Security` reconciles two zone-level Cloudflare controls using the protected production Cloudflare token:

- a WAF custom rule that blocks direct access to internal/admin origin-only API namespaces on `www.rcat.ac.th`;
- one Free-plan-compatible rate limiting rule for `/api/cms-auth/*` and `/api/admin-proxy`, counted by client IP in a 10-second period.

The rule count and expression intentionally fit the Cloudflare Free rate-limiting entitlement. Existing application-level CMS authentication limiters remain as defense in depth.

The reconciliation script only creates or updates rules with exact `RCAT P6B:` descriptions. It does not replace unrelated zone rulesets or rules.

## Auth anomaly alerts

The same protected workflow queries Cloudflare `firewallEventsAdaptive` with the dedicated read-only analytics token. It does not request client IP or user-agent fields. Sensitive auth/admin edge security events are classified as:

- 0 events in lookback: healthy;
- 1-9: info;
- 10-29: warning;
- 30 or more: critical.

Warning/critical severity fails the GitHub Actions guard, using the repository's existing Actions notification path. The workflow currently inherits the `production` Environment reviewer requirement, so scheduled checks remain approval-gated until observability/security monitoring is moved to a dedicated read-only Environment.

## Activation gates

P6B is closed only when all are true:

1. repository CI is green;
2. candidate CSP is deployed and the production browser smoke reports no representative violations;
3. CSP is switched from Report-Only to enforcing and a second production smoke succeeds;
4. Cloudflare WAF custom rule and sensitive API rate-limit rule reconcile and verify successfully;
5. auth anomaly query succeeds with protected identifiers omitted from logs;
6. project-state documentation records P6B closure and permits P6C to begin.
