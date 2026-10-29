> **RETIRED — 2026-10-30.** The project owner canceled all SaaS/O2O tests and cutover plans. This document is retained only as a historical record. Do not perform the DNS, SSL, route, simulation, or deployment instructions below. The institutional website remains on Vercel.

# RCAT O2O Staging execution — Issue #760

Project owner authorized test-host-only staging on 2026-10-29. **Production www.rcat.ac.th is NOT approved for cutover.**

## Domain ownership and absolute boundaries

- The live authoritative rcat.ac.th Cloudflare zone uses kirk.ns.cloudflare.com and maria.ns.cloudflare.com in an external account. The linked rcat.ac.th zone is Pending and must NOT be activated or substituted.
- The connected Cloudflare SaaS provider zone rcat.dpdns.org is Active; its fallback.rcat.dpdns.org origin is Active, and edge.rcat.dpdns.org is an existing proxied CNAME.
- **Only** failover-test.rcat.ac.th may be routed to the staging Gateway. The independent rcat-saas-gateway-staging Worker is not the production SaaS Candidate or the existing Public Standby Worker.
- The staging Worker rejects www and all workers.dev public routes (HTTP 503). Its staging-health on workers.dev may return HTTP 200 with configured=true, status=not-routed. All normal staging responses are no-store, noindex.
- The staging Wrangler config creates no DNS, route, custom hostname, SSL or D1 binding.

## Before touching test DNS

1. Contact the operator of the existing authoritative rcat.ac.th Cloudflare account (kirk/maria). The linked pending-zone credentials CANNOT edit its real records.
2. Obtain and save the old value/TTL of failover-test.rcat.ac.th. Stop if it currently serves a production service.
3. Confirm provider-zone hostname quota, certificate entitlement and any charges before registering anything that incurs fees.
4. Deploy the independent staging Worker to workers.dev from reviewed main. Confirm staging-health configured=true, not-routed and GET /news HTTP 503, X-RCAT-Staging=wrong-hostname. Keep the global All Workers Access app enabled, granting an exception only to this staging Worker if necessary.
5. Record current provider-zone Worker Routes and SaaS Custom Hostnames before any mutations.

## Proposed staging-only O2O changes, in order

1. Create only the SaaS Custom Hostname **failover-test.rcat.ac.th** in provider zone rcat.dpdns.org with standard DV SSL. Track ownership validation and SSL status. TXT/HTTP pre-validation does NOT work for an O2O customer on another Cloudflare zone; plan real-time verification.
2. Add only the narrow provider zone Worker Route `edge.rcat.dpdns.org/*` to rcat-saas-gateway-staging after verifying the provider target has no existing live consumers. Do NOT create a wildcard `*/*` route.
3. The **authoritative external DNS operator**, not the linked Pending zone, creates the following sole test record:
   - Type: CNAME
   - Name: failover-test (FQDN failover-test.rcat.ac.th)
   - Value: edge.rcat.dpdns.org
   - Proxy: Proxied (orange-cloud)
   - TTL: Automatic
4. **Go only if** SaaS Custom Hostname status=active AND ssl.status=active, correct HTTPS certificate/SNI for test host and staging-health responds with status=staging-only. Otherwise rollback test record and route.
5. Check live staging GET / and /news SSR marker, assets, public APIs and redirect loops. Send X-RCAT-Staging-Simulate: 503 (then network) to staging GET /news and public API, verifying X-RCAT-Failover, read-only Standby, sanitized identity, zero Set-Cookie. Remove fault header and verify automatic return to Vercel primary.
6. Test Admin and auth GET failures and POST/PUT no-replay without writing CMS data. Full login/logout cookie parity requires an approved disposable test account; do not log credentials. Test canonical, cookies, SameSite and Secure attributes and cross-host redirects.

## Rollback

- External owner restores the previous test-only DNS record (or removes the new CNAME), never changing www.
- Remove only the provider Route edge.rcat.dpdns.org/* if it was created solely for this staging test; restore any pre-existing route.
- Remove only the new failover-test.rcat.ac.th Custom Hostname after preserving validation logs.
- Preserve Standby, primary Vercel, institutional nameservers, global Access, Public API and D1 unchanged.

**Important:** Workers.dev smoke PASS or offline simulation PASS does NOT prove an active O2O hostname. Issue #760 remains open until actual HTTPS/SSL and failover/rollback on the staging hostname are verified. Production cutover requires its own authorization.
