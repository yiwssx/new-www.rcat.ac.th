# Changelog

All notable changes to `www.rcat.ac.th` are recorded here from the explicit versioning baseline onward.

The project existed before formal semantic versioning. Earlier architecture generations are documented retrospectively in [`docs/PROJECT_HISTORY.md`](docs/PROJECT_HISTORY.md) rather than fabricating a patch-by-patch release history for hundreds of historical commits.

## [Unreleased]

## [3.3.2] - 2026-10-04

### Changed

- Split the Admin Content Editor behind nested lazy boundaries so opening `/admin/content` does not pull the Tiptap/ProseMirror editor runtime into the initial list graph.
- Replaced the broad Tiptap StarterKit dependency with an explicit extension set matching the existing editor feature surface.
- Deferred advanced rich-text capabilities and the media picker until those capabilities are required, while preserving documents that already contain advanced rich-text structures.
- Preload the content-editor shell and rich-text runtime together on create/edit/restore intent to remove the avoidable dialog → editor network waterfall without preloading the editor on the list page itself.

### Performance

- Baseline `ContentEditorDialog`: 499.31 kB raw / 153.24 kB gzip.
- Verified largest first-open editor chunk: 347,795 bytes raw / 105,003 bytes gzip.
- Verified aggregate first-editor-open incremental JavaScript: 126,842 bytes gzip, down 26,398 bytes (17.23%) from the 153,240-byte baseline.
- Table/horizontal-rule advanced runtime and the rich-text media picker remain deferred from the default first-open graph.

### Governance

- Added an Admin editor bundle budget that fails when the largest first-open editor chunk reaches 400,000 raw bytes or aggregate first-open gzip exceeds 138,000 bytes.
- Added dependency-graph isolation checks that fail if Tiptap/ProseMirror enters either the public synchronous graph or the initial `/admin/content` graph.
- Kept the public Web Vitals/performance architecture budget separate from the Admin lazy-chunk regression budget.

### Release verification

- Tasks 1–8 were merged into `integration/v3.3.2-content-editor-performance` through PR #517 at `b5afbdf29c25a7492f58515790a9f47a3dbc1805`; Task 8 Governance CI run `37184894293` passed.
- Task 9 PR #518 was validated by draft PR #519; validation CI run `37186713159` passed aggregate `quality`, #519 was closed without merge, and #518 was merged into the integration branch.
- Final integration PR #520 passed release-candidate CI and merged into `main` at `2ec76e8bd4a58578145f1308641a7b77b4db56b1`.
- Main CI #3255 (run `37187823374`) passed against the exact release commit and the matching Vercel production deployment completed successfully.
- Production Verification #117 (run `37188044774`) passed against the exact release commit.
- Authenticated Admin editor smoke was operator-verified on 2026-10-04 without saving or mutating production content: `/admin/content`, create/edit dialog loading, the rich-text toolbar, advanced capability loading, and media-picker loading all passed.
- Git tag `v3.3.2` points to the exact release commit and GitHub Release `v3.3.2 — Content Editor Performance` is published as a normal release.
- This release required no D1 migration, production Worker deployment, Apps Script deployment, or production data mutation.

## [3.3.1] - 2026-10-03

### Added

- Content Integrity v2 read-only semantic auditing and protected production audit integration.
- Immutable content revision history with atomic write-boundary recording.
- Authenticated Admin revision viewer and guarded revision restore as a new Draft revision.
- Shared CMS URL/link and content-state/date validation contracts.

### Release verification

- Tasks 1–9 were integrated into `main` at `e1c7f0181adff746457e15a6a6d35743f9326763`.
- Protected Worker production preflight and production release completed successfully; production D1 migrations `0018` and `0019` were applied during the approved release sequence.
- Production Verification #106 (run `37125180446`) passed against the exact release commit.
- Git tag `v3.3.1` points to the exact release commit and GitHub Release `v3.3.1 — Content Operations` is published.
- The v3.3.1 production sequence is complete; do not repeat its migrations, Worker deployment, or verification solely to reconcile stale state.

The entries below preserve completed production work that preceded the explicit v3.3.1 Content Operations scope boundary.

### Added

- Completed P6B Security Enforcement, including runtime-aligned WAF/rate-limit/CSP and privacy-preserving auth-anomaly controls.
- Completed P6C Recovery & Reliability, including bounded production reliability checks, D1 Time Travel readiness, and documented Vercel/Worker/Apps Script rollback boundaries.
- Completed P6D Product/UX Improvements and Admin UX 00-10.
- Completed Reliability Roadmap v2:
  - Phase 0 Development Quality Gate;
  - Phase A deployment-driven read-only production browser QA;
  - Phase B1 protected System Health Dashboard;
  - Phase B2 privacy-safe Runtime Incident Feed;
  - Phase B3 server-owned Health Aggregation for Phase A/P6A/P6B/P6C/deployment/B2 signals;
  - Phase C1 accessibility, C2 synthetic performance, and manual/protected C3 authenticated disposable CMS field verification.
- Added the standalone public `/documents` archive backed by the structured public document-list contract.

### Changed

- Public structured data is Cloudflare-only; the retired `VITE_PUBLIC_API_PROVIDER` runtime selector is no longer part of current configuration.
- Public Search filtering, ordering, total counting, and pagination are Worker/D1-owned rather than a browser-owned snapshot search.
- Public SSR now renders through TanStack Router `renderRouterToStream`; the current Emotion critical-CSS finalizer still buffers the completed body before final Vercel delivery.
- Dynamic canonical `/content/:slug` SSR responses use `Cache-Control: no-store` and bypass shared Vercel CDN caching so current publish/delete state is observed.
- Current project-state, runtime/deployment, launch/readiness/smoke, feature, and historical-snapshot documentation was reconciled on 2026-09-11 so historical Phase B/M20/M21/SSR integration language cannot be mistaken for current status.
- Phase A's automatic Vercel gate now rejects `Canceled by Ignored Build Step`/`Ignored Build Step` statuses and successful statuses without a deployment `target_url`, preventing skipped builds from being reported as ready matching deployments before browser smoke.
- Production environment retirement was operator-verified on 2026-09-11: live Vercel uses server-only `COMPLAINT_API_URI`, retired `VITE_COMPLAINT_API_URI` is absent, and the CMS-auth observation/legacy-only environment retirement follow-ups are complete across the applicable Vercel/Cloudflare environments.
- Current Worker, recovery, import, environment, and AI guidance now targets the canonical in-place production Worker/D1 identity and no longer presents retired Preview or `rcat-public-api-production` operations as current instructions.
- Reconciled current runtime contracts again on 2026-09-16 so the production smoke/runbook expectations match the deployed CMS authorization bootstrap and Facebook Post/Reel rendering paths.

### Fixed

- CMS authorization bootstrap now validates `/api/cms-auth/session` before requesting Admin capabilities. An unauthenticated Login/Admin bootstrap stops on the Session `401` instead of issuing an anonymous `/api/admin/capabilities` request; authenticated Login/MFA/session restoration still loads capabilities after Session validation.
- Facebook embed behavior is isolated by content kind: supported regular Posts use the responsive `facebook.com/plugins/post.php` iframe path, while direct and explicitly confirmed legacy Reels use the Meta SDK/XFBML video path. The regular-post iframe builder now fails closed for Reels so later call sites cannot accidentally route Reels back through `post.php`.
- Mobile Facebook embedding CSP now includes the Meta frame/script/connect origins required by the live Post/Reel paths, while unsupported share/watch URL shapes remain fallback-only and source links remain preserved.

### Maintenance

- Governed dependency maintenance continues under the existing Renovate, release-age, freshness, security-audit, and CI/governance policies.
- Historical migration, closure, cutover, and dated audit documents remain preserved as evidence; current source-of-truth documents take precedence when historical wording differs from the live architecture or project state.
- Added `docs/architecture/current-contract-reconciliation-2026-09-16.md` to record the verified Session-before-capabilities and Facebook Post/Reel invariants without rewriting dated historical release evidence.

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
