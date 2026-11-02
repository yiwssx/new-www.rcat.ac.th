# Institutional DNS integrity — cross-project workstream

Status: **ACTIVE / P0** · Incident [#786](https://github.com/yiwssx/new-www.rcat.ac.th/issues/786)
Related www SaaS/O2O workstream: [#760](https://github.com/yiwssx/new-www.rcat.ac.th/issues/760)

## Scope and non-negotiable constraints

This is **not RMS-only**. The objective is to protect **all DNS records/subdomains in the active institutional zone**, including apex, website, email, all applications and new hostnames, plus the separate SaaS provider zone. Do **not** touch the authoritative nameservers, production www CNAME, SaaS gateway, RMS/PDF/IoT/Radio origin, firewall or Apache while diagnosing the AnyFlip problem.

Confirmed owner configuration:

- Authoritative rcat.ac.th NS = kirk/maria, domain-owner account. Domain owner only changed www CNAME to edge.rcat.dpdns.org (Proxied) for O2O, and subsequently added AnyFlip A = 202.29.239.145 DNS-only. These facts are accepted and must not be repeatedly questioned.
- Provider rcat.dpdns.org uses roan/serena in another account, with exact SaaS custom hostname www.rcat.ac.th; there is no provider wildcard.
- Older DNS-only names remain pointed to 202.29.239.145; AnyFlip unexpectedly returns Cloudflare anycast IP. Cloudflare IP equality with www alone cannot prove a shared origin or Gateway.
- Root DNS TTL expiry re-queries authority; it does not replace an origin. ICMP TTL=64 is unrelated.

## Monitoring architecture — two distinct coverage levels

### Public baseline (enabled without owner credentials)

Run: node scripts/check-critical-dns.mjs
Baseline file: scripts/dns-monitor.json

Validates independent public resolvers for **all names/types confirmed so far**:

- Authoritative NS + root A presence, Google Workspace MX, SPF TXT
- www A presence
- rms/pdf/iot/radio A exact 202.29.239.145 and absence of AAAA
- anyflip A expected 202.29.239.145 and absence of AAAA (KNOWN incident #786 warning until fixed; enable RCAT_ANYFLIP_DNS_STRICT=true afterwards)
- provider NS plus edge and fallback A presence

The root Vercel addresses and proxied www/provider IPs are deliberately not pinned to fixed IP values, because they can rotate. No checks mutate configuration. New names can be registered in this baseline, but **public DNS cannot enumerate all zone records**, so this level is intentionally labeled PARTIAL. The baseline covers DNS integrity, not full HTTP/TLS/functional health.

### Full authoritative zone inventory (requires read-only owner account)

Run: node scripts/check-authoritative-zone-inventory.mjs

The authoritative Cloudflare **owner's ACTIVE rcat.ac.th Zone ID** and scoped DNS:Read token must be supplied. The **pending duplicate rcat.ac.th zone in the provider account must never be used**; the provider zone is independent and not authoritative for institutional records.

To export a complete approved baseline on a trusted machine without changing DNS:

    export RCAT_AUTH_DNS_ZONE_ID='<real-active-rcat.ac.th-zone-id>'
    export RCAT_AUTH_DNS_READ_TOKEN='<scoped-owner-account-dns-read-token>'
    node scripts/check-authoritative-zone-inventory.mjs capture /tmp/rcat-authoritative-zone-snapshot.json

Review the entire active zone, validate the expected change set, and store the approved snapshot as config/authoritative-zone-dns-baseline.json (never store the API token). The snapshot includes the hostname, type, whether proxied, TTL for DNS-only records, priority, and **SHA-256 of the record content** rather than plain-text contents. Each subsequent run fetches **every page of records** and fails if an existing record changed, a record disappeared or any new record appeared.

When these are provisioned in GitHub:

- secret RCAT_AUTH_DNS_READ_TOKEN
- variable RCAT_AUTH_DNS_ZONE_ID
- approved baseline file config/authoritative-zone-dns-baseline.json

...the existing Production Verification workflow will enforce full-zone drift detection on its existing 6-hour cadence. If credentials are missing it emits an explicit COVERAGE INCOMPLETE warning rather than claiming to have audited the whole zone. If token is supplied without an approved snapshot the full-zone job fails closed. An approved baseline change must be committed through a reviewed PR after intentional DNS changes.

## Current repository changes (2026-11-02)

- Website/central DNS PR: [#787](https://github.com/yiwssx/new-www.rcat.ac.th/pull/787), branch `fix/dns-o2o-anyflip-rms-guard-20261102`; includes the existing six-hour workflow, a publicly verified subset and an optional exhaustive ACTIVE-zone inventory.
- AnyFlip diagnostic PR: [yiwssx/anyflip-downloader#63](https://github.com/yiwssx/anyflip-downloader/pull/63), same branch name; read-only diagnostic script and incident runbook.
- Offline unit tests: 11 passing on implementation code. The CI initially failed because native `node:test` files were discovered by Vitest; they have now been renamed to `.node-check.mjs` and run only via `node --test` in the existing workflow. Recheck PR CI before merge.
- Vercel's status API separately reports account deployment blocked for PR #787; this is NOT evidence of a DNS regression and no deployment is requested by the changes.
- **Coverage gate:** until access to the REAL authoritative owner account and an approved snapshot is available, public DNS checks must remain explicitly partial; full-zone monitoring cannot be claimed complete.

## Implementation checkpoints

- [x] Inventory publicly verified institutional apex, application, mail, and provider records; label incomplete scope explicitly.
- [x] Add cross-project DNS drift tests and a read-only public baseline checker.
- [x] Implement full authoritative DNS record enumeration with digest-based drift comparison.
- [x] Integrate checks into the existing Production Verification 6-hour cadence; no parallel scheduler.
- [ ] Obtain access to actual domain-owner Active Zone via scoped Cloudflare DNS:Read credential; connected provider account alone cannot audit it.
- [ ] Capture and approve real full-zone snapshot, then turn on full inventory enforcement.
- [ ] Diagnose and resolve AnyFlip-only DNS/public path without changing institutional records.
- [ ] Verify AnyFlip public HTTPS /healthz and all existing institutional DNS/HTTP paths; only then enable strict AnyFlip DNS check.
- [ ] Record CI results / merge / operator validation in both repos and close Incident #786.

## Release/rollback criteria

Changes in this workstream are diagnostics and CI only. No live DNS changes are made. A failed public DNS drift check may indicate data divergence or independent resolver outage; confirm authoritative answers before a DNS correction. Never use account-level 'enforce DNS-only', turn off all proxy records, or change the .ac.th nameservers as a workaround.
