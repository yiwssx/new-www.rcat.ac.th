# www.rcat.ac.th

Official web platform of **Roi Et College of Agriculture and Technology** (วิทยาลัยเกษตรและเทคโนโลยีร้อยเอ็ด).

**Current version:** `3.3.0`  
**Production site:** `https://www.rcat.ac.th/`  
**Package identity:** `www.rcat.ac.th`

> **Proprietary software — All Rights Reserved.**  
> This repository is publicly visible, but the software is **not open source**. Public repository visibility does not grant permission to copy, modify, redistribute, sublicense, publish, commercially exploit, or create derivative works from the college-owned software. See [`LICENSE`](LICENSE).

## Product

`www.rcat.ac.th` is the production website platform and content-management system for Roi Et College of Agriculture and Technology.

It is no longer a template, starter, or standalone CMS project. The current system includes the public website, SSR/SEO runtime, CMS/admin application, API/backend services, structured data, authentication/session services, analytics, media integration, deployment controls, and operational governance required by the production site.

## Current Architecture

Runtime ownership is intentionally split by responsibility:

- **Public website:** React + TypeScript with server-side rendering and hydration on Vercel.
- **Public routing and SEO:** SSR-aware TanStack Router routes, runtime metadata, and runtime sitemap handling.
- **Structured public data:** Cloudflare Worker + D1.
- **Public analytics and visitor statistics:** Cloudflare Worker + D1.
- **CMS/admin structured reads and writes:** Cloudflare Worker + D1.
- **CMS identity, sessions, RBAC, MFA, CSRF, step-up assurance, revocation, and user lifecycle:** Cloudflare Worker + D1 through same-origin Vercel proxy routes.
- **Media/file bridge:** Google Apps Script behind authenticated server-side proxy boundaries.
- **File storage:** Google Drive.
- **Frontend/server deployment:** Vercel.
- **API/data runtime:** Cloudflare Worker + D1.

The authoritative runtime ownership document is [`docs/architecture/current-runtime-ownership.md`](docs/architecture/current-runtime-ownership.md).

## Product Generations

The project predates formal semantic versioning. Its history has been reconstructed from explicit architecture and release evidence without rewriting the Git commit graph.

| Version  | Generation                   | Product boundary                                                                    |
| -------- | ---------------------------- | ----------------------------------------------------------------------------------- |
| `v1.0.0` | Apps Script generation       | Stabilized React/Vite + Apps Script production architecture before D1 migration     |
| `v2.0.0` | Cloudflare + D1 generation   | D1-backed application field-cutover generation                                      |
| `v3.0.0` | SSR generation               | SSR/SEO implementation promoted to production                                       |
| `v3.1.0` | Post-SSR stabilization       | SSR and project-audit remediation baseline                                          |
| `v3.2.0` | Production hardening         | Canonical D1 convergence, recovery, release, and audit hardening                    |
| `v3.3.0` | Governed production baseline | Explicit product identity, licensing, versioning, and current production governance |

See [`docs/PROJECT_HISTORY.md`](docs/PROJECT_HISTORY.md) for exact historical anchor commits and rationale. See [`CHANGELOG.md`](CHANGELOG.md) for the release log from the explicit versioning baseline onward.

## Versioning Policy

From `v3.3.0` forward, the project follows semantic versioning with architecture-aware major versions:

- **MAJOR** — new production architecture generation or deliberately breaking platform boundary.
- **MINOR** — significant backward-compatible product capability, stabilization baseline, or production hardening/convergence milestone.
- **PATCH** — backward-compatible fixes, dependency maintenance, documentation corrections, and narrowly scoped operational changes.

`package.json`, release tags, and release notes should move together for future releases.

## Source and Licensing

Copyright © 2026 **Roi Et College of Agriculture and Technology**. All Rights Reserved.

This repository is source-visible for project operation, deployment, review, and engineering collaboration. It is not distributed under an open-source license.

The root package declares:

```json
{
  "name": "www.rcat.ac.th",
  "private": true,
  "version": "3.3.0",
  "license": "UNLICENSED"
}
```

`UNLICENSED` is the package-manager signal that no public software license is granted. The human-readable proprietary terms are in [`LICENSE`](LICENSE).

Third-party packages, fonts, libraries, and assets remain subject to their own license terms. For example, bundled font license files continue to apply independently of the college-owned source-code license.

## Stack

- React 19
- TypeScript strict mode
- Vite
- TanStack Router
- TanStack Query and Table
- MUI
- Tailwind CSS v4
- Vercel SSR and server routes
- Cloudflare Workers
- Cloudflare D1
- Google Apps Script media/file bridge
- Google Drive storage
- Vitest
- Playwright

## Toolchain

The checked-in runtime/toolchain contract is:

- Node `24.x`
- pnpm `10.34.5`

Install dependencies with:

```bash
pnpm install --frozen-lockfile --strict-peer-dependencies
```

Start local frontend development with:

```bash
pnpm dev
```

## Quality and Release Gates

Focused development should start with the tests relevant to the change, followed by broader gates when appropriate.

Core repository gates include:

```bash
pnpm format:check
pnpm lint:strict
pnpm test:unit
pnpm test:integration
pnpm build
pnpm worker:typecheck
pnpm worker:deploy:dry
pnpm test:functional
```

Governance and release checks include:

```bash
pnpm perf:check
pnpm media:check
pnpm layout:check
pnpm design:check
pnpm quality
pnpm quality:full
pnpm quality:release
```

Dependency governance includes:

```bash
pnpm deps:status:check
pnpm deps:check
pnpm deps:latest:check
pnpm deps:docs:audit
```

The GitHub `quality` status is a protected merge gate for the production branch.

## Deployment Model

General deployment ownership:

- React/Vite, SSR, or Vercel server-route change → Vercel deployment.
- Cloudflare Worker runtime/config change → Cloudflare Worker deployment.
- New D1 migration → migration plus compatible Worker release under the repository's production gates.
- Apps Script media/file bridge change → Apps Script deployment.
- Documentation/tests-only change → no runtime deployment is required.

See [`docs/deployment/runtime-deployment-guide.md`](docs/deployment/runtime-deployment-guide.md).

## Security Boundary

Repository visibility must never be treated as a security boundary.

Do not commit:

- secrets or API tokens;
- production credentials;
- Cloudflare account/database secrets;
- private deployment URLs or access credentials;
- session tokens, MFA secrets, or recovery codes;
- encryption/signing keys;
- private operational evidence containing sensitive identifiers.

Checked-in non-secret project settings live in `src/config/project-settings.json`.

Current security and governance controls include CI quality gates, dependency audit/freshness policy, D1 migration sequencing, Worker dry-deploy validation, production data-integrity checks, Apps Script release governance, SSR/CSP readiness checks, and recovery documentation.

## Current Documentation

Primary current-state documents:

- Product history: [`docs/PROJECT_HISTORY.md`](docs/PROJECT_HISTORY.md)
- Changelog: [`CHANGELOG.md`](CHANGELOG.md)
- Runtime ownership: [`docs/architecture/current-runtime-ownership.md`](docs/architecture/current-runtime-ownership.md)
- Current project state: [`docs/architecture/post-p5h-current-project-state.md`](docs/architecture/post-p5h-current-project-state.md)
- Runtime deployment: [`docs/deployment/runtime-deployment-guide.md`](docs/deployment/runtime-deployment-guide.md)
- Dependency status: [`docs/maintenance/dependency-current-status.md`](docs/maintenance/dependency-current-status.md)
- Environment variables: [`docs/development/environment-variables.md`](docs/development/environment-variables.md)
- CMS session lifecycle: [`docs/cms-auth-session-lifecycle.md`](docs/cms-auth-session-lifecycle.md)
- Public SSR verification: [`docs/operations/public-ssr-cutover.md`](docs/operations/public-ssr-cutover.md)
- Apps Script media bridge deployment: [`docs/deployment/apps-script-deployment-checklist.md`](docs/deployment/apps-script-deployment-checklist.md)

## Historical Documentation

M-series, P-series, migration, preview, replacement, cutover, and stabilization documents are retained when they describe historical work that actually occurred. They are engineering/audit evidence and are not automatically rewritten to current terminology.

When historical text conflicts with present runtime ownership, product identity, toolchain, security policy, or release governance, the current documents listed above take precedence.

The full Git history is intentionally preserved. Product history is curated; engineering history remains auditable.

---

Copyright © 2026 Roi Et College of Agriculture and Technology. All Rights Reserved.
