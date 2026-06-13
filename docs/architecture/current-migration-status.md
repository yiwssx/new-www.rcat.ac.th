# Current Migration Status

Current milestone: M15.1.

## Summary

M13: Passed externally per operator confirmation. The repository contains an approval-gated production import runner for `public-document-list`.

M14: Passed externally per operator confirmation. The repository contains a direct production Worker smoke gate for `public-document-list`.

M15: Production frontend cutover and rollback gate added. Actual production cutover has not been executed from this repository commit history.

M15.1: Operator-accepted under domain-management constraint. Technical dry-run gate blocked safely because the replacement system cannot use the real production domain while the old live production system remains on that domain. This is accepted as sufficient to proceed to M16 planning. No production mutation occurred.

## M15.1 Dry-Run Result

Dry-run cutover command used:

```bash
pnpm public-documents:cutover -- --cutover
```

Dry-run rollback command used:

```bash
pnpm public-documents:cutover -- --rollback
```

Technical dry-run cutover result: `BLOCKED`, safely.

Technical dry-run rollback result: `BLOCKED`, safely.

Earlier local dry-run attempts were blocked by missing required environment values:

- `RCAT_PROD_FRONTEND_URL`
- `RCAT_PROD_WORKER_URL`

The operator decision update records the deployment reality: available replacement-system endpoints are not the real production frontend domain. A Vercel preview frontend cannot be treated as production by the gate, and preview, staging, dev, test, or sandbox-looking Worker origins must remain blocked.

Operator decision: `ACCEPTED` for planning.

Real production cutover: `NOT EXECUTED`.

Future domain cutover: deferred until the replacement system is complete and the old live system can safely be moved.

No `--execute` command was run.

## Provider Status

Current production frontend provider: Apps Script until approved cutover.

Target provider after approved cutover: Cloudflare public API for `public-document-list` only.

Rollback provider: Apps Script.

## Next Action

Next action: M16 Cloudflare-first backend migration reset.

M16 goal: move the replacement system toward Cloudflare as the primary backend for all application data, while keeping Apps Script only as a Google Drive media-file bridge until final domain cutover.

M15.2 real execute cutover remains deferred until the replacement system is complete, the production domain can be moved safely, explicit operator approval is recorded, and an approved production monitoring window exists.

## Safety

No production secrets, production URLs, D1 ids, tokens, full records, Google Drive URLs, Apps Script URLs, account ids, or Worker URLs are committed.

No production Vercel environment was changed.

No Worker deploy was run.

No D1 write, import, or migration was run.

No Apps Script change was made.

No `src/services/googleApi.ts` change was made.

No UI, route, cache key, or cache TTL change was made.
