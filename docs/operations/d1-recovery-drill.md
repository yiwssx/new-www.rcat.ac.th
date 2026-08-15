# D1 Recovery Drill

Updated: 2026-08-15.

This drill verifies that the current operator path can resolve Cloudflare D1 metadata and Time Travel information without exercising a destructive production restore.

## Safety Boundary

The GitHub Actions workflow `.github/workflows/d1-recovery-drill.yml` is intentionally limited to the database name `rcat-public-api-preview` and contains no `d1 time-travel restore` command. It must never be changed into a production restore workflow.

The workflow may run only from `master` after explicit non-production acknowledgement. It uses the protected GitHub `production` environment solely as the existing credential boundary for `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`; it does not receive `RCAT_PRODUCTION_D1_DATABASE_ID`, target the production database, deploy a Worker, apply a migration, or perform a restore. The environment reviewer and protected-branch rules therefore remain an additional credential-access gate rather than evidence that the drill itself is a production deployment.

A production restore remains a manual incident action governed by `docs/operations/admin-backup.md`. Production restore must require an explicit operator decision, a captured pre-restore bookmark, an approved target, and post-restore validation.

## Running The Drill

Run **D1 Recovery Drill** manually from GitHub Actions on `master`, explicitly acknowledge that the drill is non-production and read-only, then approve the protected `production` environment when GitHub requests the existing environment review.

The workflow:

1. installs the repository's pinned Node/pnpm dependencies;
2. verifies the protected Cloudflare account/token credentials are present;
3. scans itself for destructive restore commands;
4. resolves metadata for `rcat-public-api-preview`;
5. confirms the preview database uses the D1 production storage backend required for Time Travel;
6. resolves the preview database's current Time Travel metadata/bookmark;
7. rejects output that unexpectedly references `rcat-public-api-production`;
8. writes a summary confirming that no restore or production D1 write was performed.

The workflow needs Cloudflare credentials capable of reading preview D1 metadata. Missing credentials or missing preview access is a drill failure and should be recorded as an operational access gap, not bypassed by switching the target to production or exposing the protected credentials as repository-wide secrets.

## Evidence To Record

For every quarterly drill, record outside source control when it contains account-specific information:

- drill date/time;
- operator;
- workflow run URL;
- whether preview metadata resolved;
- whether Time Travel metadata resolved;
- credential/access blockers;
- command drift or Wrangler incompatibility;
- elapsed time from drill start to successful readiness confirmation;
- follow-up action and owner for every blocker.

Do not commit real database IDs, bookmarks, Cloudflare account IDs, tokens, or sensitive backup contents.

## RPO/RTO Interpretation

The existing production recovery objectives remain working engineering targets:

- RPO: target the last known good minute when the incident is inside D1 Time Travel retention;
- RTO: restore decision, execution, and read-only validation within 60 minutes after a D1 recovery incident is declared.

This read-only preview drill validates operator/tooling readiness but does **not** prove the destructive restore duration. Record its elapsed time as a readiness signal, not as a production restore benchmark.

## Escalation

If preview Time Travel cannot be resolved, fix credentials, Wrangler command drift, or preview D1 availability before the next high-risk production migration/import. Do not use production as a substitute test target merely to make the drill pass.
