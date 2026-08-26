# Changelog

All notable changes to `www.rcat.ac.th` are recorded here from the explicit versioning baseline onward.

The project existed before formal semantic versioning. Earlier architecture generations are documented retrospectively in [`docs/PROJECT_HISTORY.md`](docs/PROJECT_HISTORY.md) rather than fabricating a patch-by-patch release history for hundreds of historical commits.

## [3.3.0] - 2026-08-26

### Changed

- Established the permanent product/package identity as `www.rcat.ac.th`.
- Rebased the package version on the actual production architecture generation rather than the original `0.1.0` template-era placeholder.
- Established the curated V1 → V2 → V3 product history.
- Declared the source code proprietary and non-open-source while keeping the repository publicly visible.
- Added explicit copyright ownership for Roi Et College of Agriculture and Technology.
- Kept `private: true` in `package.json` to prevent accidental package publication.
- Kept historical Git commits intact for auditability instead of rewriting hundreds of commit SHAs.

### Architecture baseline

- Public SSR website and CMS/admin application.
- Vercel SSR and same-origin server/proxy routes.
- Cloudflare Worker + D1 structured application data and authentication/session services.
- Apps Script media/file bridge with Google Drive storage.
- CI, dependency, security, governance, recovery, and deployment controls.

## Retrospective architecture milestones

These entries are product-history boundaries reconstructed from repository evidence. They are not a fabricated record of historical npm/package releases.

- **3.2.0** — 2026-08-16 — production hardening and canonical D1 convergence (`440d7787e561d6310f91464c6a676f73cef0f022`).
- **3.1.0** — 2026-08-13 — post-SSR stabilization and project-audit remediation (`27078e687ff8fc2e907a377dbc6a8fe09acfde9b`).
- **3.0.0** — 2026-08-04 — SSR/SEO implementation promoted to production (`0632c2d0b81afe6a05a2b60d2145a2d1700cd532`).
- **2.0.0** — 2026-06-21 — D1-backed field-cutover generation (`7038f8bbe2717e523096acf7cd8ef4db1d021f55`).
- **1.0.0** — 2026-05-23 — stabilized Apps Script-backed production generation (`89f52461acc6240f0cf4b7e9d51497978470fe29`).

For rationale and architecture details, see [`docs/PROJECT_HISTORY.md`](docs/PROJECT_HISTORY.md).
