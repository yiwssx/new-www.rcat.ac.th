# www.rcat.ac.th Product History

This document is the curated product history of `www.rcat.ac.th`.

It summarizes architectural generations and release boundaries without rewriting Git commit history. Historical migration documents and the full Git graph remain the engineering and audit record; this document is the product-level interpretation of that record.

## Versioning Policy

`www.rcat.ac.th` uses semantic version numbers with an architecture-aware major version policy.

- **MAJOR**: a new production architecture generation or a deliberately breaking platform boundary.
- **MINOR**: a significant production capability, stabilization baseline, security/recovery hardening sequence, or platform convergence within the same architecture generation.
- **PATCH**: backward-compatible fixes, dependency maintenance, documentation corrections, and narrowly scoped operational changes.

The historical versions below were reconstructed from repository evidence. They identify meaningful product boundaries; they do not pretend that every historical commit had a package version assigned at the time.

From `v3.3.0` forward, `package.json`, Git release tags, and release notes are intended to move together.

## Version 1 — Apps Script Generation

### v1.0.0

**Date:** 2026-05-23  
**Anchor commit:** `89f52461acc6240f0cf4b7e9d51497978470fe29`

V1 represents the stabilized pre-D1 production generation.

Architecture at this boundary:

- React/Vite public website and CMS frontend.
- Vercel frontend deployment.
- Google Apps Script as the production application backend.
- Spreadsheet-backed structured storage and Google Drive integrations.
- Apps Script public cache and API ownership.
- Public visitor/site-view tracking already present.

The repository's stabilization release report at this commit explicitly describes the combined public website, CMS admin, Google Apps Script backend, spreadsheet storage, visitor tracking, and cache architecture.

Cloudflare/D1 migration had not yet become the application runtime architecture.

## Version 2 — Cloudflare Worker + D1 Generation

### v2.0.0

**Date:** 2026-06-21  
**Anchor commit:** `7038f8bbe2717e523096acf7cd8ef4db1d021f55`

V2 begins when the application entered the D1-backed field-cutover generation rather than merely containing experimental Cloudflare/D1 scaffolding.

Important distinction:

- `3d956c8e54b8ccd1ffdd4fdedd5eed223f5a574f` introduced an isolated Cloudflare Worker skeleton while production still used Apps Script.
- `d04a549f88a4196fe38f8e9e4ffd8bb8490f2601` introduced D1 schema/seed planning while D1 was still not wired into runtime routes.
- `7038f8bbe2717e523096acf7cd8ef4db1d021f55` records the approved preview-backed field cutover with Cloudflare assigned to public/admin structured data and D1 used for field verification.

V2 therefore represents the point at which Cloudflare Worker + D1 became the application data architecture, not the point at which the first D1-related file appeared in the repository.

During the V2 generation, Apps Script remained important for Google Drive/media integration and as part of the migration/rollback path while Cloudflare ownership expanded.

## Version 3 — SSR Production Generation

### v3.0.0

**Date:** 2026-08-04  
**Anchor commit:** `0632c2d0b81afe6a05a2b60d2145a2d1700cd532`

V3 begins with the production promotion of the completed SSR/SEO implementation.

Architecture at this boundary includes:

- server-side rendering for the public website;
- hydration of the React application;
- production SSR/SEO route handling;
- Vercel server runtime ownership for SSR and same-origin proxy surfaces;
- Cloudflare Worker + D1 as the structured application-data backend.

The anchor commit explicitly records that SSR readiness and SSR/SEO implementation phases passed the release gates and were promoted to production.

### v3.1.0 — Post-SSR Stabilization Baseline

**Date:** 2026-08-13  
**Anchor commit:** `27078e687ff8fc2e907a377dbc6a8fe09acfde9b`

This retrospective minor boundary represents the post-SSR stabilization and project-audit remediation period, including SSR asset-injection hardening, provider cleanup, display resilience, regression coverage, and readiness-guard alignment.

It is a product-history milestone, not a claim that the package was already published as `3.1.0` at that date.

### v3.2.0 — Production Hardening and Canonical D1 Convergence

**Date:** 2026-08-16  
**Anchor commit:** `440d7787e561d6310f91464c6a676f73cef0f022`

This retrospective minor boundary represents the production-hardening sequence and convergence of Cloudflare runtime resources on the canonical production model, including production D1 identity, release/audit gates, recovery governance, and removal of obsolete preview-only operational surfaces.

It is a product-history milestone, not a claim that the package was already published as `3.2.0` at that date.

### v3.3.0 — Governed Production Baseline

**Date:** 2026-08-26

`v3.3.0` is the first version in the new explicit product-versioning baseline.

This release establishes:

- permanent product/package identity: `www.rcat.ac.th`;
- explicit proprietary copyright ownership by Roi Et College of Agriculture and Technology;
- `package.json` versioning aligned to the V3 architecture generation;
- source-visible but non-open-source licensing terms;
- curated product history separate from the full engineering Git history;
- continued CI, dependency, security, governance, Worker, SSR, and deployment gates.

The `v3.3.0` Git tag, once created, is the authoritative commit boundary for this release.

## Current Architecture

The current production architecture is broader than a "website template" or a standalone CMS.

`www.rcat.ac.th` currently includes:

- public SSR website and SEO routing;
- CMS/admin application;
- Cloudflare Worker API;
- Cloudflare D1 structured data, analytics, sessions, RBAC, MFA, and administration data;
- Vercel SSR and same-origin server/proxy routes;
- Apps Script media/file bridge;
- Google Drive file storage;
- CI, dependency, security, recovery, and deployment governance.

See `README.md` and `docs/architecture/current-runtime-ownership.md` for current runtime ownership.

## Historical Records

Documents named with M-series, P-series, migration, cutover, preview, replacement, or stabilization terminology are retained when they are historical evidence of work that actually occurred.

Historical language must not be interpreted as the current product identity when it conflicts with current documentation.

The current product name is `www.rcat.ac.th`.

## History Integrity

The repository does **not** rewrite hundreds of historical Git commits merely to make old terminology look current.

Keeping the original commit graph preserves:

- pull-request lineage;
- CI and deployment evidence;
- migration and recovery evidence;
- historical commit links and SHA references;
- forensic and operational traceability.

Product history is curated here; engineering history remains intact in Git.
