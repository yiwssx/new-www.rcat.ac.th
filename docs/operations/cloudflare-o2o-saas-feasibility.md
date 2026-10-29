# RCAT O2O/SaaS Gateway feasibility and safe owner-side execution

**Date:** 2026-10-29 · **Tracker:** #760 · **Safety:** NO PRODUCTION DNS/ROUTE/NAME-SERVER CHANGES.

## Decision and architecture

Use Cloudflare for SaaS with Orange-to-Orange (O2O) if, and only if, an independently owned **active provider zone**, SaaS feature eligibility, custom hostname + certificate validation, and end-to-end primary-origin proof are established. The original `rcat.ac.th` zone remains authoritative in the external organization account; no registrar transfer, zone takeover, or nameserver change.

Traffic after approved cutover:

1. Browser requests `https://www.rcat.ac.th/`.
2. Authoritative Cloudflare zone retains existing DNS ownership but updates the proxied `www` CNAME to the **future validated SaaS provider target**. The target **is not known yet**. Do not point `www` to a `workers.dev` endpoint.
3. The SaaS provider zone is in our separate Cloudflare account. Its Worker handles custom-hostname requests, forwards healthy traffic to a **verified Vercel project-level alias**, and switches public read-only GET/HEAD to a local Cloudflare Standby Service Binding when Vercel returns 502/503/504 or fails at the network layer.
4. This still calls Vercel for the primary SSR/Admin and does not remove its Fluid CPU consumption while healthy. Only public CSR pages/API GET remain available during Vercel downtime.

Reference: https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/start/getting-started/ and https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/saas-customers/how-it-works/.

## Verified current prerequisites

| Item                                         | Observation (2026-10-29)                                                                               | Decision                                                                                                                  |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Account `rcat-digital`                       | Account `c2536d1093fd8a43002f514754bf02e7`                                                             | Keeps Standby and API                                                                                                     |
| Active SaaS provider zone                    | **Not present**. Only `rcat.ac.th` status `pending` with non-authoritative nameservers `roan`/`serena` | **BLOCKED: obtain a separately owned active domain/zone; never activate the pending .ac.th zone**                         |
| Existing authoritative `rcat.ac.th`          | Managed externally with original nameservers `maria`/`kirk`                                            | No access/no changes allowed                                                                                              |
| SaaS feature                                 | GET fallback-origin on pending zone returned HTTP 401 feature unavailable/permission denied            | **Not verified enabled**. Do not attempt custom-hostname or billing activation on pending zone                            |
| Cloudflare Standby                           | `https://rcat-web-standby.rcat-digital.workers.dev` exists and has local `PUBLIC_API` binding          | Already deployed, do not mutate production API/D1                                                                         |
| Vercel project                               | `new-www.rcat.ac.th` in team `rcat-it-dev-team`                                                        | Keep production SSR                                                                                                       |
| Vercel project alias                         | `new-wwwrcatacth-rcat-it-dev-team.vercel.app` is attached to last known READY production deployment    | Candidate origin ONLY. Must verify HTTP redirects, Host handling, cookies, paths and Vercel Pause behavior BEFORE traffic |
| SSL and Custom Hostname for `www.rcat.ac.th` | Not provisioned in a provider zone                                                                     | **BLOCKED**                                                                                                               |
| Public DNS/CNAME change                      | Not authorized / not performed                                                                         | **BLOCKED**                                                                                                               |

## Implemented code — tests only, no changes to live site

- `cloudflare/web-failover/saas-gateway-worker.mjs` wraps the existing well-tested `gateway-worker.mjs` for SaaS use.
- Vercel-primary requests go to **explicit project alias** (not `www.rcat.ac.th` to avoid an infinite O2O proxy loop).
- Original request method, path, query, cookies and Authorization are preserved to the Vercel alias (required for current Admin/CMS). Forwarded and Host spoofing headers are stripped.
- Public GET/HEAD fallback uses `env.STANDBY.fetch()` **internal Service Binding**, because SaaS Gateway and Standby would both run in our own Cloudflare account; the binding never crosses accounts. Only Accept/path/query are sent on backup.
- Protects against canonical redirect loops returning to the exact same public URL; prevents accidental 200 on loop.
- `cloudflare/web-failover/saas-gateway-wrangler.toml` contains **no route, DNS, zone, custom domain, D1 or assets**; it is a candidate configuration, not an active SaaS setup.
- `cloudflare/web-failover/saas-gateway.node-check.mjs` tests primary 200, status 502/503/504, network failure and recovery, Public API JSON, cookie sanitization, write/auth preservation, redirect loops, and host allowlisting.
- Existing Cloudflare CI checks Wrangler syntax and full Node tests. Do not add a second workflow.

## Production canonical redirect blocker (2026-10-29, manual preflight #40840782026)

GitHub Actions **Cloudflare Emergency Failover Check** run `40840782026` showed **4/4 Vercel project-alias probes returned an unexpected redirect**, whereas all **6/6 Cloudflare Standby probes passed**, as did offline tests and Wrangler dry-run.

**Root cause:** `middleware.ts` intentionally sends all Production `*.vercel.app` traffic to `www.rcat.ac.th` with a permanent 308. The future SaaS Gateway must use the independent Vercel project alias, not `www.rcat.ac.th`, so an unmodified canonical redirect would send Gateway traffic in a loop and produce HTTP 508.

**Narrowly scoped repair:**

- Vercel production middleware keeps canonical redirects for every ordinary browser/robot request and every other `*.vercel.app` host.
- It skips only the *canonical redirect* for HTTPS traffic addressed to the exact project alias `new-wwwrcatacth-rcat-it-dev-team.vercel.app` and carrying `X-RCAT-Origin-Bridge: rcat-origin-v1`.
- The independent `saas-gateway-worker.mjs` and read-only external `origin-readiness.mjs` add that marker to their Vercel requests. Neither sends the marker to Standby. This marker is a **routing hint, NOT a secret, proof of identity, authorization or WAF bypass**. Admin/CMS authentication and API Edge WAF continue normally.
- The explicit marker has to be tested against an actual Vercel Production deployment. It is not proof that Vercel has stopped routing or the Cloudflare for SaaS custom hostname works.
- Canonical SEO and public site security depend on maintaining the normal 308 for all requests **without** the marker. Unit tests verify this, including arbitrary deployment aliases.
- Keep the original failed run as evidence. After deploying corrected Vercel middleware and CI passing, rerun the same *manual* Cloudflare Emergency Failover Check on `main`; it must show **10/10 PASS**. If it still reports a redirect, inspect Vercel alias configuration separately (Vercel may also emit platform redirects).

This change neither configures nor activates Cloudflare SaaS, a DNS record, an active provider zone, nor a Worker Route.

## Independent live origin readiness, without a SaaS zone

**New work (Issue #760):** `cloudflare/web-failover/origin-readiness.mjs` is a **read-only** external probe for the exact existing Vercel project alias and Cloudflare Standby. It does not depend on an active SaaS zone or touch `www.rcat.ac.th`.

Checks include:

- Vercel project-alias HTML homepage and news SSR (HTTP 200, correct content type and SSR marker).
- Vercel read-only `/api/public/home` and `/api/public/shell` JSON.
- Standby health, CSR HTML/noindex, public read APIs, and deliberate HTTP 503 protection of `/admin` and the private auth API.
- Any unexpected redirect from the Vercel project alias is an explicit failure: avoid silently returning users to `www.rcat.ac.th` and a potential O2O loop.
- It does **not** test Admin login/logout, authenticated user sessions, Vercel `Set-Cookie` or the future SaaS hostname. A PASS is **not permission to change DNS**.

To run the check against real services without credentials, use the existing GitHub Actions workflow **Cloudflare Emergency Failover Check → Run workflow** on `main`. The `Live Vercel and standby preflight (read-only; no DNS)` job is enabled **only for manual workflow_dispatch**. It reports concise pass/fail statuses in the job summary, logs no server bodies or auth tokens, and sends GETs only to the hardcoded Vercel/standby HTTPS origins. Any non-200 / redirect / unexpected content / network failure fails closed. Do not confuse this with a Gateway/O2O end-to-end test.

CI on PRs continues to run **deterministic offline tests** only; an external Vercel outage must not falsely turn all unrelated code PRs red.

## Remaining owner-side steps (not safe to execute yet)

1. **Provider zone:** obtain the name and proof of control of a domain **separate from `rcat.ac.th`** and add it to the connected Cloudflare account. Wait until its zone is `active`. Do not buy/register a domain or create an account subscription without the user's explicit choice.
2. **SaaS capability:** check Cloudflare for SaaS is enabled on that active zone and assess included custom hostname quota, billing, and TLS capabilities. Do not infer entitlement from Free plan or from the pending zone.
3. **Originless fallback:** configure the provider-zone fallback origin as documented by Cloudflare (e.g. `fallback.<separate-owned-domain>` as a proxied originless record), configure the SaaS CNAME target e.g. `edge.<separate-owned-domain>` and attach a **limited Worker Route** for approved custom hostnames. These are placeholders **not copy/paste production DNS**.
4. **SSL and custom hostname:** provision `www.rcat.ac.th` as SaaS custom hostname, validate ownership and certificate issuance **without routing production prematurely**. The authorized domain account operator may need a TXT validation record or HTTP token as well as a later CNAME update; do not promise that one DNS record change will always be sufficient. Verify `custom_hostname.status=active` and `ssl.status=active`.
5. **Vercel proxy test:** Validate project alias directly, then via a safely scoped test hostname for SSR canonical, `Set-Cookie` domain/`SameSite`/Secure, Admin Login and logout, redirect Location, HTTPS SNI and preserved Host expectations, `/.well-known/vercel/*`, `/.well-known/acme-challenge/*`, browser assets, and CDN caching. Vercel does not recommend stacking proxies; see https://vercel.com/docs/security/reverse-proxy and https://vercel.com/kb/guide/can-i-use-a-proxy-on-top-of-my-vercel-deployment. **Do not assume custom-hostname proxying is working just because HTTP 200 exists.**
6. **Failover test:** primary returns 503 or network error → public pages and `/api/public/*` read-only work. Protected routes and non-idempotent requests must never retry against standby. Recover to primary; monitor costs. Keep test away from production writes.
7. **Domain owner cutover:** after explicit user and domain operator approvals, operator updates `www` CNAME from its Vercel target to the verified provider SaaS CNAME target. Existing .ac.th zone/nameservers remain unchanged. DNS rollback: restore **the exact original record**, including orange-cloud proxy mode and TTL, recorded in the change request. Verify SSL, www redirects, SSR and admin immediately.

## Activation guardrails

- **Do not attach this candidate to a production route** before the custom hostname, certificate, Vercel primary alias, auth proxy, origin headers, and end-to-end tests all pass.
- Vercel Hobby deployments can still be paused due to quotas. Cloudflare gateway does not prevent Vercel pauses or replace its SSR/CMS; it only makes public read-only content available when primary is unavailable.
- Do not confuse CNAME-to-standby with automatic failover; CNAME is not a health-aware load balancer.
- Standby and the Public API / D1 still share Cloudflare availability. Consider shared Cloudflare outage outside scope.
- Rollback plans must not depend on a bot modifying the external domain operator's zone.

## Current deliverable status

**Code preparation:** PR #764 merged with CI PASS. Subsequent read-only origin preflight is an independent follow-up tracked in Issue #760.

**Actual SaaS/O2O readiness:** BLOCKED (no active independently-owned provider zone; custom hostname/TLS/route absent; Vercel proxy not validated). **No DNS change performed.** Leave Issue #760 open.

This is a feasibility-stage candidate, not permission for production activation.
