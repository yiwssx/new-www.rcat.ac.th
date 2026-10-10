# Organization Chart — Phases 8–9 acceptance and release gate

Updated: 2026-10-11 Asia/Bangkok. **Feature branch only; do not merge or deploy as part of this checkpoint.**

## Public behavior
- Publish a synthetic root division, work, department and child unit, each with Thai slug. Public `/organization/:slug` must show only published ancestor chains, positions and enabled assignments.
- Use one synthetic person in multiple units and positions. Disabled duties and inactive people must disappear; private email/phone must never appear in public API responses.
- Scheduled units must remain hidden before `publishAt`, become visible at `publishAt` with published ancestors, and expire after `unpublishAt`.
- Existing Menu editor offers published Organization slugs; links use `/organization/:slug`. Unpublished units must be removed from user-managed menus separately; the editor does not silently delete links.
- Search shows Organization matches separately, not as `/content/:slug` generic items. Sitemap loads published slugs from `GET /api/public/organization` and never includes draft ancestors or orphan units.

## Automated test gate
- `pnpm install --frozen-lockfile --strict-peer-dependencies`
- `pnpm format:check`, `pnpm lint:strict`, `pnpm test:unit`, `pnpm test:integration`, `pnpm build`, `pnpm worker:typecheck`, `pnpm worker:deploy:dry`.
- `pnpm test:functional`: Chromium Playwright/axe audit on synthetic Thai Organization pages at 390px and 1280px; check WCAG A/AA, semantic headings, breadcrumbs, focus, no horizontal overflow and unpublished 404.
- GitHub `quality` must be SUCCESS at the **exact** feature branch commit. Automated axe checks do not substitute manual real-device/screen-reader tests.

## Backup / restore gate
- Admin D1 counts and JSON export must include `organization_units`, `personnel`, `organization_positions`, `organization_assignments`, and their parent `contents` / `media_assets`.
- `missing` for an Organization table after expected migration is a release blocker. Do not interpret missing as zero rows.
- Portable Merge restore: MFA protected, primary-key UPSERT, no auth/session tables, parent-before-child Organization order, then personnel, positions, assignments.
- Web-admin JSON Merge is limited to 4 MiB and commits batches; it is **not an atomic full-database disaster restore**. Use the approved D1 Time Travel/SQL export procedure for production incidents. Only rehearse a full restore in an explicitly authorized isolated database. Keep files containing personnel contacts private.

## Protected release preparation
1. Rehearse migration `0020_organization_content_foundation.sql` on isolated non-production D1; verify FK, hierarchy-cycle and occupant-capacity guards.
2. Verify actual preview menus, Thai URL, search, sitemap, mobile/keyboard/zoom, contrast and published/private fields using synthetic records.
3. Record exact-head green CI, reviewed migrations, rollback/Time Travel bookmark plan, correct protected D1 identity and real-data population plan.
4. Keep Phases 10–11 blocked until the complete feature receives review/merge approval and separate protected production authorization.
