# D1 Recovery Drill

Updated: 2026-08-15.

This drill verifies that the current operator path can resolve Cloudflare D1 metadata and Time Travel information without exercising a destructive production restore.

## Safety Boundary

The GitHub Actions workflow `.github/workflows/d1-recovery-drill.yml` is intentionally limited to the database name `rcat-public-api-preview` and contains no `d1 time-travel restore` command. It must never be changed into a production restore workflow.

A production restore remains a manual incident action governed by `docs/operations/admin-backup.md`. Production restore must require an explicit operator decision, a captured pre-restore bookmark, an approved target, and post-restore validation.

## Running The Drill

Run **D1 Recovery Drill** manually from GitHub Actions and explicitly acknowledge that the drill is non-production and read-only.

The workflow:

1. installs the repository's pinned Node/pnpm dependencies;
2. scans itself for destructive restore commands;
3. resolves metadata for `rcat-public-api-preview`;
4. resolves the preview database's current Time Travel metadata/bookmark;
5. rejects output that unexpectedly references `rcat-public-api-production`;
6. writes a summary confirming that no restore or production D1 write was performed.

The workflow needs Cloudflare credentials capable of reading preview D1 metadata. Missing credentials or missing preview access is a drill failure and should be recorded as an operational access gap, not bypassed by switching the target to production.

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
