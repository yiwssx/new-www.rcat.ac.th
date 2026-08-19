# RCAT Public Website and CMS

React/Vite public website and CMS for Roi-Et College of Agriculture and Technology.

Updated: 2026-08-17.

This README describes the current runtime, development conventions, and project-state interpretation after the CMS Session reliability work, Admin Menu hierarchy/URL refactor, Public SSR cutover, Cloudflare-only Public runtime cleanup, and P5H production-governance hardening.

## Current Project State

Current status: post-P5H production governance baseline with ongoing governed dependency maintenance.

P5H closed the current production-hardening sequence covering Worker maintainability, CMS link integrity, request correlation governance, Apps Script release governance, D1 credential-boundary hardening, and production audit/release evidence.

Governed Renovate dependency maintenance is expected to continue after P5H. It is not considered feature, runtime, or stabilization-scope expansion when it follows the repository dependency policy and passes the required CI/governance gates.

Historical M13-M21 milestone documents remain useful as migration and stabilization history, but they do not define the current active project state after P5H. When historical milestone text conflicts with the current runtime, deployment, security, governance, toolchain, or maintenance documentation, the current documents listed below take precedence.

## Current Runtime Ownership

- Public structured reads: Cloudflare Worker + D1.
- Public analytics, site view, content view, visitor presence, and live visitor statistics: Cloudflare Worker + D1.
- Admin structured reads and writes: Cloudflare Worker + D1.
- CMS identity, sessions, RBAC, MFA, CSRF, step-up assurance, session revocation, and user lifecycle: Cloudflare Worker + D1, reached through same-origin Vercel proxies.
- Admin/session proxy: Vercel server-side proxy.
- Media/file bridge: Apps Script behind the authenticated Vercel proxy.
- File storage: Google Drive behind the Apps Script media/file bridge.
- Runtime sitemap: Vercel `/sitemap.xml` -> `/api/sitemap`, backed by live Cloudflare public data.

Public structured data has no runtime provider selector. Cloudflare Worker + D1 is the current Public structured-data and analytics owner.

The authoritative current ownership document is:

`docs/architecture/current-runtime-ownership.md`

### Admin Menu

The Admin Menu editor uses a hierarchical mental model:

- menu items are presented as a tree;
- child menus are displayed beneath their parent;
- users select a parent by readable menu name rather than typing an internal menu ID;
- internal IDs remain implementation details;
- explicit internal paths are preserved;
- the editor must not automatically rewrite `/some-path` to `/content/some-path`;
- `/content/$slug` remains supported, but root permalink `/$slug` is also a valid public content route;
- ordering is performed within sibling groups.

See:

`docs/admin/admin-menu-management.md`

## CMS Session Behavior

CMS Sessions remain server-authoritative.

Current policy:

- idle timeout: 30 minutes;
- absolute lifetime: 8 hours;
- server touch threshold: 5 minutes;
- meaningful recent Admin activity can trigger a throttled session refresh while the page is visible;
- a merely open but unattended tab must not keep a Session alive forever;
- temporary `5xx`/network failures must not be treated as genuine Session expiration;
- a genuine Session-expiration `401` can clear authentication;
- unsaved Content Editor state has recovery protection for true Session expiration.

See:

`docs/cms-auth-session-lifecycle.md`

## UI Test Policy

Do not use the complete repository quality/release suite as the first feedback loop for a small UI fix.

For a focused Admin Menu change, run the focused Menu tests first:

```bash
pnpm exec vitest run src/admin/pages/menuPageModel.test.ts src/admin/pages/MenuPage.test.tsx
```

Then run the production TypeScript/Vite build:

```bash
pnpm build
```

Broader unit, integration, governance, Worker, and functional suites remain important, but they should follow targeted validation rather than block the first edit/test cycle.

See:

`docs/development/ui-testing-policy.md`

## Stack

- React 19 + TypeScript strict mode
- Vite
- Tailwind CSS v4
- MUI
- TanStack Router
- TanStack Query and Table
- Vercel frontend, Public SSR, and same-origin server routes
- Cloudflare Worker and D1
- Apps Script media/file bridge
- Google Drive file storage

## Toolchain

The checked-in toolchain contract is:

- Node `24.x`
- pnpm `10.34.5`

Use the versions declared by `package.json`, `packageManager`, `.node-version` where applicable, and CI. Do not document or reintroduce Node 22 as the current project requirement.

Install:

```bash
pnpm install --frozen-lockfile
```

## Common Commands

Development:

```bash
pnpm dev
```

Focused verification:

```bash
pnpm exec vitest run <affected-test-files>
pnpm build
```

Repository suites:

```bash
pnpm format:check
pnpm lint:strict
pnpm test:unit
pnpm test:integration
pnpm test:functional
pnpm worker:typecheck
```

Governance/release:

```bash
pnpm perf:check
pnpm media:check
pnpm layout:check
pnpm design:check
pnpm quality
pnpm quality:full
pnpm quality:release
```

`quality:release` is a release-scale command. It is intentionally not the default edit-loop command for a small UI change.

## Project Settings

Checked-in non-secret project settings live in:

`src/config/project-settings.json`

Do not store secrets, tokens, production credentials, D1 IDs, Access identifiers, private deployment URLs, Recovery Codes, session tokens, or encryption keys in project settings or documentation.

## Runtime Sitemap

Vercel rewrites `/sitemap.xml` to `/api/sitemap`.

The server function combines the known indexable Public route set with published canonical content records from Cloudflare Worker/D1. Dynamic sitemap content currently comes from News, Announcements (including published Public page items), and Blog. It does not derive routes from the Public menu. Program records remain represented by the indexable `/departments` listing route because there is no canonical Public program-detail route.

The build does not generate a tracked `public/sitemap.xml`.

Relevant verification:

```bash
pnpm test:sitemap
pnpm build
```

## Deployment

General rule:

- React/Vite or `server/*` change -> Vercel.
- Cloudflare Worker runtime/config change -> Cloudflare Worker.
- new D1 migration -> apply migration and deploy compatible Worker as required.
- Apps Script `.gs` media bridge change -> Apps Script.
- docs/tests only -> no runtime deployment.

The Admin Menu hierarchy refactor is a frontend/Admin UI change when only `src/admin/**` and documentation/tests change; it requires Vercel deployment, not a Worker/D1 migration.

See:

`docs/deployment/runtime-deployment-guide.md`

## Documentation

- Icon system: `docs/design/icon-system.md`

Current documents:

- Current project state: `docs/architecture/post-p5h-current-project-state.md`
- Runtime ownership: `docs/architecture/current-runtime-ownership.md`
- Post-P5H maintainability / observability closure context: `docs/operations/p5h-maintainability-observability-2026-08-16.md`
- Production environment convergence: `docs/architecture/production-environment-convergence-2026-08-16.md`
- Runtime deployment: `docs/deployment/runtime-deployment-guide.md`
- Apps Script media bridge deployment: `docs/deployment/apps-script-deployment-checklist.md`
- Dependency status: `docs/maintenance/dependency-current-status.md`
- Admin Menu behavior: `docs/admin/admin-menu-management.md`
- CMS Session lifecycle: `docs/cms-auth-session-lifecycle.md`
- UI test policy: `docs/development/ui-testing-policy.md`
- Public SSR verification: `docs/operations/public-ssr-cutover.md`
- Environment variables: `docs/development/environment-variables.md`
- Historical migration status: `docs/architecture/current-migration-status.md`
- Historical M20 ownership closure: `docs/architecture/m20-cleanup-runtime-ownership.md`
- CMS authentication cutover runbook: `docs/cms-auth-final-cutover.md`

Historical milestone documents preserve the state and evidence of their milestones. For current project state, runtime ownership, Node/pnpm, Session behavior, Menu UX, Public provider ownership, SSR asset behavior, deployment decisions, dependency maintenance, and governance boundaries, use the current documents listed above.
