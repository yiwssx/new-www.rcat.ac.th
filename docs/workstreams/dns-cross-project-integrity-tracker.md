# RCAT SaaS/O2O and institutional service isolation — cross-project tracker

**Status: ACTIVE / P0 — monitoring merged, AnyFlip public access not recovered.**
Incident: [#786](https://github.com/yiwssx/new-www.rcat.ac.th/issues/786) · SaaS/O2O: [#760](https://github.com/yiwssx/new-www.rcat.ac.th/issues/760).

## Scope and operator decision (2026-11-02)

This workstream now covers **our controllable projects only**: the `www` SaaS/O2O Gateway, AnyFlip application and reverse-proxy diagnostics, and read-only public DNS/HTTP/TLS checks of registered RCAT services. **Do not pursue, request access to, edit, compare snapshots from, or make closure dependent on the institutional domain-holder's DNS zone/account.**

Accepted infrastructure facts remain unchanged. The owner made the agreed `www` CNAME change; AnyFlip was created later with the same intended direct-to-RMS A record configuration as older applications. We will not repeatedly request reconfirmation. The appearance of Cloudflare anycast IPs for AnyFlip is a confirmed symptom, **not proof the `www` SaaS Gateway serves that hostname**.

Protect production: no changes to DNS/NS, Vercel application, institutional reverse proxies, RMS, PDF, IoT, Radio, firewall, or TLS certificates without a separate scoped plan.

## Architecture and monitoring

- `scripts/dns-monitor.json`: explicitly registered public-service baseline for `rcat.ac.th` apex, `www`, Google Workspace MX/SPF, `rms`, `pdf`, `iot`, `radio`, `anyflip`, provider NS, edge and fallback.
- `scripts/check-critical-dns.mjs`: external read-only verification from independent DNS-over-HTTPS resolvers. No credentials, provider account changes, or full-zone enumeration. **New subdomains must be added explicitly**; public DNS cannot enumerate all possible names.
- `cloudflare/web-failover/saas-gateway.node-check.mjs`: fail-closed test for sibling institutional hostnames. Their requests must return HTTP 503 without calling the Vercel primary or standby.
- Existing `Production Verification` six-hour cadence runs the public-service DNS guard and Node tests; no duplicate scheduled workflow.
- `anyflip-downloader/scripts/diagnose-public-dns.sh` (merged): compare public name routing and directly addressed RMS origin using host-preserving `curl --resolve`. It is read-only.

The previously proposed owner-zone API audit and baseline are **deliberately removed from this project**, not deferred or blocked.

## Current verified state

- [x] [new-www PR #787](https://github.com/yiwssx/new-www.rcat.ac.th/pull/787) merged into `main` (commit `8d5dcd65343204ada3d2d7d928eb2f713c0e26dc`).
- [x] [AnyFlip PR #63](https://github.com/yiwssx/anyflip-downloader/pull/63) merged into `main` (commit `6548b6b5d8cfb6cd133a87fd377cd04e9e27fabf`).
- [x] [CI #4985](https://github.com/yiwssx/new-www.rcat.ac.th/actions/runs/41459412694) succeeded in all required lanes, including E2E, unit, integration and quality.
- [x] External DNS checks passed for listed services except `anyflip` A/AAAA drift.
- [x] Subsequent external HTTPS probe showed `www` responding but AnyFlip still hanging after TLS. Do not report it as repaired.
- [x] Owner-zone API/snapshot dependency removed; fail-closed gateway sibling-host tests expanded (this PR).
- [ ] Review and merge this PR after CI passes.
- [ ] Verify live gateway routes and custom-hostname inventory in **our own** SaaS provider account.
- [ ] Complete AnyFlip public-path restoration through the reachable application and reverse-proxy infrastructure, with operator-controlled access only.
- [ ] Confirm health from an authorized external vantage point; verify `www`, RMS and other applications remain unaffected; close Incident #786.

## Acceptance and rollback

No DNS/NS or host routing mutations are performed by these changes. The incident closes when AnyFlip's public HTTPS/health endpoint works, existing institutional applications remain healthy, and the `www` SaaS Gateway remains scoped to `www`. All actions must be read-only until a scoped intervention is justified. Vercel deployment status is independent from these monitoring/code tests.
