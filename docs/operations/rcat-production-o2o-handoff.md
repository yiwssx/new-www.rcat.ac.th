# RCAT production automatic failover — provider-side handoff

**Owner decision 2026-10-30 / Tracker #760:** stop repeated staging experiments; implement **Cloudflare for SaaS Orange-to-Orange (O2O)** in the RCAT provider account. Domain operator only edits **one authoritative DNS record**. This is NOT a request to move nameservers or install a Worker in the domain owner's account.

## Exact architecture and ownership

1. Public canonical website: `https://www.rcat.ac.th/` (authoritative Cloudflare account with kirk/maria nameservers).
2. RCAT Cloudflare SaaS provider zone: **`rcat.dpdns.org`** (active, separate account), account `c2536d1093fd8a43002f514754bf02e7`, zone `cf0c16c764f5e0c295e3a3a2ad55b855`.
3. Provider's orange-clouded CNAME target: **`edge.rcat.dpdns.org`** -> `fallback.rcat.dpdns.org`; fallback is ACTIVE. Provider Route **`edge.rcat.dpdns.org/*`** invokes Worker **`rcat-saas-gateway`**. For an O2O customer's *proxied* CNAME, Cloudflare matches the CNAME target's Worker Route: https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/configuration/hostname-routing/
4. Provider owns SaaS Custom Hostname **`www.rcat.ac.th`** (exact, no wildcard), its SSL/TLS certificate, Gateway Worker and **same-account** Standby Service Binding `STANDBY` -> `rcat-web-standby`. No SaaS gateway Worker is required in the authoritative owner's Cloudflare account.
5. Vercel primary remains `https://new-wwwrcatacth-rcat-it-dev-team.vercel.app` (a *project alias*, never fetch `www.rcat.ac.th` from the Gateway or recursion occurs). The bridge header `X-RCAT-Origin-Bridge: rcat-origin-v1` prevents canonical redirect loops. Do not treat it as authentication.
6. Automatic fallover **only** for public GET/HEAD on primary HTTP 502/503/504 or network failure/timeout; recover automatically on healthy primary. On fallback, forward only path/query and Accept; strip all client identity, cookies, Authorization, CSRF, Set-Cookie and redirects. Admin/API writes never fail over, remain Vercel-dependent; no request body replay. Read-only public CSR page/Cloudflare public API may be available while Vercel is paused.
7. Keep current Vercel project, public API worker, image worker, D1 and other Cloudflare Access policies unchanged. Do NOT activate the separate, duplicate Pending `rcat.ac.th` zone.

## What RCAT provider team prepares (before owner DNS action)

- Preserve ACTIVE `rcat.dpdns.org`, active fallback origin, `edge` Proxied CNAME, and stand-alone read-only Standby.
- Deploy `rcat-saas-gateway` from `cloudflare/web-failover/saas-gateway-worker.mjs` and `saas-gateway-wrangler.toml`, with exact pinned `PUBLIC_HOSTNAME=www.rcat.ac.th`, Vercel project alias and `STANDBY` Service Binding. The Wrangler file must never create or edit DNS or production `www`.
- Create an exact Worker-scoped Cloudflare Access bypass for this public SaaS Gateway *only*, while preserving `All Workers` and Standby protections; the workers.dev public paths must remain denied by hostname guard. Deploy independently first, then set provider Zone route `edge.rcat.dpdns.org/*`, verifying no existing route is replaced.
- Register exact SaaS Custom Hostname `www.rcat.ac.th` (non-wildcard, minimum TLS 1.2, automatic HTTP DV). On O2O, **TXT/HTTP hostname pre-validation is unsupported**; status `pending` and SSL `pending_validation` before the owner's CNAME change is **expected, not a successful cutover**.
- Record Custom Hostname ID, Route ID, Worker deployment, Provider status and a rollback reference on Issue #760. Do not claim production is live before the authoritative owner changes CNAME.

## Exactly one DNS change by authoritative domain operator

**Preconditions:** confirm the owner's authoritative DNS zone uses the existing kirk/maria Cloudflare nameservers. Save the full current `www` DNS record (type, target, proxy status, TTL) before replacing it. Confirm the owner has approved a change window, understands O2O certificate activation can briefly interrupt HTTPS, and has the rollback record ready.

```text
Zone: rcat.ac.th (authoritative owner's account ONLY)
Type: CNAME
Name: www
Target: edge.rcat.dpdns.org
Proxy status: Proxied (orange cloud)
TTL: Auto
```

Do **NOT** change apex `rcat.ac.th`, nameservers, MX, TXT/SPF/DMARC, any Admin/API domain, or any other record. Do not create `failover-test`. The owner's responsibility is the www DNS record, checking/adding the apex edge redirect below if absent, and any authoritative CAA/DNSSEC correction needed for certificate issuance. The owner does not manage Gateway Worker, Cloudflare for SaaS, or the Provider SSL.

## Apex redirect required for protection of both website addresses

The current apex `rcat.ac.th` redirect is assigned in Vercel. If Vercel is paused, visitors to the apex can still see the pause page **even when www Failover is working**. The authoritative Cloudflare operator must **check existing edge redirect rules**, and if no suitable rule exists, create one Cloudflare **Single Redirect** (no Worker, no apex DNS or Nameserver change):

- Match expression: `(http.host eq "rcat.ac.th")`
- Dynamic target expression: `concat("https://www.rcat.ac.th", http.request.uri.path)`
- HTTP status: `301` (permanent); **Preserve query string: Enabled**
- Scope: the apex hostname only; never redirect `www` back to the apex.
- Precondition: existing apex DNS is Proxied (orange cloud), so the edge redirect runs without relying on Vercel.
- If an equivalent Cloudflare edge redirect already exists, **do not create a duplicate**.

This redirect is part of the minimal **domain-operator configuration**, not a new staging test. Official reference: https://developers.cloudflare.com/fundamentals/manage-domains/redirect-domain/

## Go-live acceptance — one controlled production activation, no intentional Vercel outage

- Immediately after DNS switch, provider checks Cloudflare SaaS Custom Hostname has **status=active AND ssl.status=active**, and the certificate covers `www.rcat.ac.th`. Do **not** mark success while SSL is Pending.
- Verify public homepage, /news, real public API, hashed static assets, HTTP redirect to canonical site, no proxy loop, correct caching and cookies, existing Admin login/session path and POST calls through healthy Vercel. Do NOT use live production writes as a drill, expose credentials in CI, or intentionally pause Vercel.
- Existing offline regression tests have covered 502/503/504, network failure, failback, Admin exclusions, sanitized backup requests. **These do not replace live hostname/TLS/cookie verification.** A successful normal-path go-live does not prove that every future outage will fail over; use production monitoring.
- Because Cloudflare for SaaS O2O cannot hostname pre-validate before cutover, issuance can require post-change validation and may cause a temporary TLS interruption. A no-downtime promise is **not** technically justified. Source: https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/domain-support/hostname-validation/pre-validation/

## Immediate rollback

1. **Domain operator** restores the previously saved exact `www` DNS record, incl. target and Proxied state. This returns normal traffic to Vercel; do not change apex or Nameservers.
2. **RCAT provider** leaves existing Standby, API and Images untouched; disable/delete only newly created SaaS provider Route `edge.rcat.dpdns.org/*` if it causes trouble while diagnosing; custom hostname/cert cleanup is separate and must not block DNS rollback.
3. Verify primary website and Admin session, document the rollback and do not retry automatically. Issue #760 remains open until real deployment acceptance and rollback capability are recorded.

## Explicit no-go

Do not ask the domain operator to change DNS until Gateway Worker is deployed, its internal `STANDBY` binding exists, Provider Route and Custom Hostname are created and billing/limits are reviewed. Do not claim hostname/TLS active before owner DNS change. Avoid additional A/B, synthetic outage or test CNAME rounds. Do not merge historical PR #775 (canceled failover entirely); that PR is closed and superseded.
