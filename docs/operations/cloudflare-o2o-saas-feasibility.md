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

## Provider SaaS Zone activated and isolated Gateway Candidate release (2026-10-29)

- **Provider zone:** `rcat.dpdns.org` in our connected account is **ACTIVE** on Free Website; it is separate from the institution-owned authoritative `rcat.ac.th`. Never swap the institution's Nameservers with the pending duplicate Zone.
- **SaaS allocation:** API `/custom_hostnames/quota` reports `allocated=50000, used=0, hard_cap=100000`; quota is **not a promise of 50,000 free hostnames**. Verify billing before accepting live traffic.
- **Provider DNS:** `fallback.rcat.dpdns.org` is the existing Proxied originless `AAAA 100::` record. `edge.rcat.dpdns.org` is the existing Proxied CNAME pointing to it. No DNS modifications were required.
- **SaaS fallback origin:** `fallback.rcat.dpdns.org` set via Cloudflare API on Zone `rcat.dpdns.org`, then GET independently verified `status=active`.
- **Custom Hostname/SSL:** none created; `www.rcat.ac.th` is NOT a Custom Hostname on the SaaS provider. O2O pre-validation must NOT be assumed safe; see Cloudflare documentation on O2O validation limitations.
- **Isolated candidate release:** `.github/workflows/cloudflare-saas-gateway-preview.yml` is a dedicated, scoped GitHub Action on reviewed `main` that deploys only `rcat-saas-gateway-candidate` to `workers.dev` via the already-tested `saas-gateway-wrangler.toml`. It shares the existing `cloudflare-web-standby` secret environment but does NOT run the public Standby release pipeline. It validates config scope, Node tests and Wrangler dry-run before upload.
- **Mandatory post-deploy smoke:** `/_rcat/saas-health` must return 200 with `configured:true,status:not-routed`; ordinary `/news` MUST return 503 with `X-RCAT-Gateway: wrong-hostname`. These prove Service Binding/config and fail-closed host restrictions, **NOT** live primary↔backup routing.
- **No cutover authorization:** neither the isolated deployment nor a successful preview permits `*/*`, production `www.rcat.ac.th` Custom Hostname, or changes to the authoritative `www` CNAME. Next, establish an approved O2O Hostname+TLS/cutover plan and prove SSR, public GET fallback, admin sessions, and rollback with real HTTPS before cutover.

## Verified current prerequisites

| Item                                         | Observation (2026-10-29)                                                                            | Decision                                                                                                                  |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Account `rcat-digital`                       | Account `c2536d1093fd8a43002f514754bf02e7`                                                          | Keeps Standby and API                                                                                                     |
| Active SaaS provider zone                    | **ACTIVE**: `rcat.dpdns.org` in own account, Free Website zone                                      | Provider zone/DNS verified. The separate `rcat.ac.th` duplicate zone remains Pending.                                     |
| Existing authoritative `rcat.ac.th`          | Managed externally with original nameservers `maria`/`kirk`                                         | No access/no changes allowed                                                                                              |
| SaaS feature                                 | Enabled: quota API reports `allocated=50000, used=0`; fallback origin `active`                      | Zone preconditions met; validate actual billing before production traffic.                                                |
| Cloudflare Standby                           | `https://rcat-web-standby.rcat-digital.workers.dev` exists and has local `PUBLIC_API` binding       | Already deployed, do not mutate production API/D1                                                                         |
| Vercel project                               | `new-www.rcat.ac.th` in team `rcat-it-dev-team`                                                     | Keep production SSR                                                                                                       |
| Vercel project alias                         | `new-wwwrcatacth-rcat-it-dev-team.vercel.app` is attached to last known READY production deployment | Candidate origin ONLY. Must verify HTTP redirects, Host handling, cookies, paths and Vercel Pause behavior BEFORE traffic |
| SSL and Custom Hostname for `www.rcat.ac.th` | Not provisioned in `rcat.dpdns.org`                                                                 | **BLOCKED until safe O2O/SSL validation and owner authorization.**                                                        |
| Public DNS/CNAME change                      | Not authorized / not performed                                                                      | **BLOCKED**                                                                                                               |

## Implemented code — tests only, no changes to live site

- `cloudflare/web-failover/saas-gateway-worker.mjs` wraps the existing well-tested `gateway-worker.mjs` for SaaS use.
- Vercel-primary requests go to **explicit project alias** (not `www.rcat.ac.th` to avoid an infinite O2O proxy loop).
- Original request method, path, query, cookies and Authorization are preserved to the Vercel alias (required for current Admin/CMS). Forwarded and Host spoofing headers are stripped.
- Public GET/HEAD fallback uses `env.STANDBY.fetch()` **internal Service Binding**, because SaaS Gateway and Standby would both run in our own Cloudflare account; the binding never crosses accounts. Only Accept/path/query are sent on backup.
- Protects against canonical redirect loops returning to the exact same public URL; prevents accidental 200 on loop.
- `cloudflare/web-failover/saas-gateway-wrangler.toml` contains **no route, DNS, zone, custom domain, D1 or assets**; it is a candidate configuration, not an active SaaS setup.
- `cloudflare/web-failover/saas-gateway.node-check.mjs` tests primary 200, status 502/503/504, network failure and recovery, Public API JSON, cookie sanitization, write/auth preservation, redirect loops, and host allowlisting.
- Existing Cloudflare CI checks Wrangler syntax and full Node tests. Do not add a second workflow.

## Standby browser-hydration readiness guard (2026-10-29)

After PR #768 corrected the stale PublicHome schema check, the post-merge `Emergency Cloudflare Web Standby` workflow run `40846248331` passed **health, CSR document, hashed JS, Public Home/Shell JSON, CORS, blocked Admin/Auth/sitemap, OPTIONS preflight**, but failed in the **Playwright browser hydration assertion** for `/` or `/news`.

The original browser smoke waited only for `#root.textContent.length > 120` and immediately searched for the college name; an intermediate loading/navigation shell can already exceed 120 characters before the public page finishes hydrating. Direct independent Cloudflare Browser Rendering of the existing Standby `/news` with `networkidle2` returned fully rendered visible content including `วิทยาลัยเกษตรและเทคโนโลยีร้อยเอ็ด`, college navigation and news. This supports a **test timing race**, not evidence of a broken live public page.

The smoke now waits up to 25 seconds for **both** substantial **visible `#root.innerText`** and real RCAT site text to exist, then reasserts `innerText` and still fails on browser page errors. It must **not** use `textContent` for the predicate, because the page embeds schema.org JSON-LD containing the college name inside hidden `<script>` tags; those can satisfy a `textContent` check without any visible hydrated content. It does not bypass the content check, length guard, network constraints or Admin protections. Require the post-merge **full Standby browser smoke to PASS** before this failure can be marked resolved.

## Standby post-deploy smoke regression — run 40845089770 (2026-10-29)

The newly merged live origin preflight (run `40845089798`) **PASS 8/8**: two Vercel SSR, Standby health/CSR, two Standby-backed Public APIs and two Admin/Auth protection checks. That only verifies origin readiness, not the full browser hydration smoke or SaaS/O2O cutover.

**Separate issue found:** the automatically triggered `Emergency Cloudflare Web Standby` workflow run `40845089770` successfully deployed the Workers.dev Standby, verified health, CSR HTML and its hashed JS asset, but its post-deploy script `cloudflare/web-failover/standby-smoke.mjs` failed with `/api/public/home missing menu`. This is a **stale test assumption**, not evidence that a menu is missing from the correct endpoint: the `PublicHomeSnapshotContract` no longer contains `menu`; `menu` is a required field in the distinct `PublicShellSnapshotContract` served by `/api/public/shell`.

The fix uses `cloudflare/web-failover/public-api-contract.mjs` as a shared strict validator in both the full Standby post-deploy browser smoke and live origin preflight. It checks the actual homepage feed arrays/visitorStats on `/api/public/home` and menu/settings on `/api/public/shell`, plus a valid `generatedAt` on both. Offline tests explicitly assert that a home payload **without** `menu` is valid but a shell payload without menu is invalid. It retains read-only HTTP GET, CORS and Admin/Auth protections. Do **not** paper over the failure with a generic 200-only check.

After merging, verify the isolated Standby deploy workflow has all checks **PASS**, and verify the live origin preflight remains **8/8 PASS**. This fix does not alter DNS, CMS, D1, Vercel project settings or the user's Cloudflare SaaS subscription.

## Production canonical redirect blocker (2026-10-29, manual preflight #40840782026)

GitHub Actions **Cloudflare Emergency Failover Check** run `40840782026` showed **4/4 Vercel project-alias probes returned an unexpected redirect**, whereas all **6/6 Cloudflare Standby probes passed**, as did offline tests and Wrangler dry-run.

**Independent preflight contract correction:** The original probe also incorrectly asked Vercel to serve `/api/public/home` and `/api/public/shell`. Those routes belong to Cloudflare Public API and are intentionally **not** same-origin Vercel endpoints (see `docs/operations/phase-c-deep-field-verification.md` and `docs/architecture/current-runtime-ownership.md`). The corrected preflight requires 2 Vercel SSR checks and the already-present 6 Cloudflare Standby safety/read checks; it does not mask or ignore a failing endpoint.

**Root cause:** `middleware.ts` intentionally sends all Production `*.vercel.app` traffic to `www.rcat.ac.th` with a permanent 308. The future SaaS Gateway must use the independent Vercel project alias, not `www.rcat.ac.th`, so an unmodified canonical redirect would send Gateway traffic in a loop and produce HTTP 508.

**Narrowly scoped repair:**

- Vercel production middleware keeps canonical redirects for every ordinary browser/robot request and every other `*.vercel.app` host.
- It skips only the _canonical redirect_ for HTTPS traffic addressed to the exact project alias `new-wwwrcatacth-rcat-it-dev-team.vercel.app` and carrying `X-RCAT-Origin-Bridge: rcat-origin-v1`.
- The independent `saas-gateway-worker.mjs` and read-only external `origin-readiness.mjs` add that marker to their Vercel requests. Neither sends the marker to Standby. This marker is a **routing hint, NOT a secret, proof of identity, authorization or WAF bypass**. Admin/CMS authentication and API Edge WAF continue normally.
- The explicit marker has to be tested against an actual Vercel Production deployment. It is not proof that Vercel has stopped routing or the Cloudflare for SaaS custom hostname works.
- Canonical SEO and public site security depend on maintaining the normal 308 for all requests **without** the marker. Unit tests verify this, including arbitrary deployment aliases.
- Keep the original failed run as evidence. After deploying corrected Vercel middleware and CI passing, rerun the same _manual_ Cloudflare Emergency Failover Check on `main`; it must show **8/8 PASS** (2 Vercel SSR origin checks and 6 Standby/Cloudflare Public API or safety checks). If it still reports a redirect, inspect Vercel alias configuration separately (Vercel may also emit platform redirects).

This change neither configures nor activates Cloudflare SaaS, a DNS record, an active provider zone, nor a Worker Route.

## Independent live origin readiness, without a SaaS zone

**New work (Issue #760):** `cloudflare/web-failover/origin-readiness.mjs` is a **read-only** external probe for the exact existing Vercel project alias and Cloudflare Standby. It does not depend on an active SaaS zone or touch `www.rcat.ac.th`.

Checks include:

- Vercel project-alias HTML homepage and news SSR (HTTP 200, correct content type and SSR marker).
- **No Vercel `/api/public/*` probes:** Vercel does not implement these as same-origin API endpoints. Both browser and SSR use the Cloudflare Public API origin (`VITE_CLOUDFLARE_PUBLIC_API_URL` / `CLOUDFLARE_PUBLIC_API_URL`). Testing them at the Vercel alias would incorrectly reject a healthy deployment.
- Standby health, CSR HTML/noindex, public read APIs, and deliberate HTTP 503 protection of `/admin` and the private auth API.
- Any unexpected redirect from the Vercel project alias is an explicit failure: avoid silently returning users to `www.rcat.ac.th` and a potential O2O loop.
- It does **not** test Admin login/logout, authenticated user sessions, Vercel `Set-Cookie` or the future SaaS hostname. A PASS is **not permission to change DNS**.

To run the check against real services without credentials, use the existing GitHub Actions workflow **Cloudflare Emergency Failover Check → Run workflow** on `main`. The `Live Vercel and standby preflight (read-only; no DNS)` job is enabled for explicit **manual workflow_dispatch** and narrowly scoped **post-merge main pushes of the readiness script**. It also runs automatically on a `main` push that changes the origin-readiness script itself (not on unrelated pushes). It reports concise pass/fail statuses in the job summary, logs no server bodies or auth tokens, and sends GETs only to the hardcoded Vercel/standby HTTPS origins. Any non-200 / redirect / unexpected content / network failure fails closed. Do not confuse this with a Gateway/O2O end-to-end test.

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
