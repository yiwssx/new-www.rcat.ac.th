# D1 Recovery Drill

Updated: 2026-08-15.

This drill verifies that the current operator path can resolve Cloudflare D1 metadata and Time Travel information without exercising a destructive production restore.

## Safety Boundary

The GitHub Actions workflow `.github/workflows/d1-recovery-drill.yml` is intentionally limited to the database name `rcat-public-api-preview` and contains no `d1 time-travel restore` command. It must never be changed into a production restore workflow.

The workflow may run only from `master` after explicit non-production acknowledgement. It uses the protected GitHub `production` environment solely as the existing credential boundary for `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`; it does not receive `RCAT_PRODUCTION_D1_DATABASE_ID`, target the production database, deploy a Worker, apply a migration, or perform a restore. The environment reviewer and protected-branch rules therefore remain an additional credential-access gate rather than evidence that the drill itself is a production deployment.

The committed preview binding intentionally retains `database_id = "preview-placeholder"`. The drill does not pass the preview Wrangler config/environment to its read-only D1 lookup commands. Instead it first confirms that exactly one account-scoped D1 database named `rcat-public-api-preview` exists, then resolves metadata and Time Travel information by that exact database name. This keeps the real preview database ID outside source control and prevents the committed placeholder from being interpreted as a Cloudflare resource ID.

Wrangler `4.121.0` intentionally removes the `version` field from `d1 info` output because legacy alpha databases have been removed. Therefore the drill does not infer Time Travel readiness from `d1 info.version`. The authoritative readiness gate is successful execution of `wrangler d1 time-travel info rcat-public-api-preview --json` together with a non-empty bookmark. Wrangler itself rejects unsupported alpha databases before retrieving a bookmark.

A production restore remains a manual incident action governed by `docs/operations/admin-backup.md`. Production restore must require an explicit operator decision, a captured pre-restore bookmark, an approved target, and post-restore validation.

## Running The Drill

Run **D1 Recovery Drill** manually from GitHub Actions on `master`, explicitly acknowledge that the drill is non-production and read-only, then approve the protected `production` environment when GitHub requests the existing environment review.

The workflow:

1. installs the repository's pinned Node/pnpm dependencies;
2. verifies the protected Cloudflare account/token credentials are present;
3. scans itself for destructive restore commands;
4. lists account-scoped D1 resources and confirms exactly one database is named `rcat-public-api-preview`;
5. resolves metadata for `rcat-public-api-preview` by exact database name without consuming the committed preview `database_id` placeholder;
6. confirms the metadata still names exactly `rcat-public-api-preview` and rejects unexpected production references;
7. invokes Wrangler's read-only Time Travel info command for `rcat-public-api-preview`;
8. requires a non-empty current bookmark as the readiness proof and rejects unexpected production references;
9. writes a summary confirming that no restore or production D1 write was performed.

The workflow needs Cloudflare credentials capable of listing D1 databases and reading preview D1 metadata/Time Travel information. Missing credentials, missing preview access, a missing/duplicate preview database name, failure to retrieve a Time Travel bookmark, or Wrangler command incompatibility is a drill failure and should be recorded as an operational access gap, not bypassed by switching the target to production or exposing the protected credentials as repository-wide secrets.

## Evidence To Record

For every quarterly drill, record outside source control when it contains account-specific information:

- drill date/time;
- operator;
- workflow run URL;
- whether the exact preview database name resolved uniquely;
- whether preview metadata resolved;
- whether Time Travel returned a current bookmark;
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

If preview Time Travel cannot be resolved, fix credentials, account-scoped preview resource resolution, Wrangler command drift, or preview D1 availability before the next high-risk production migration/import. Do not use production as a substitute test target merely to make the drill pass.
