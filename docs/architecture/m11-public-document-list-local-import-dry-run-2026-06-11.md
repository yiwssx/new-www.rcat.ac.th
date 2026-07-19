# M11 Public Document List Local Import Dry Run - 2026-06-11

> Historical record — checkpoint 2026-06-11 at commit `25af27acf876b1262579e72594672287d3e90e1e`. Measurements and runtime statements below are preserved as historical evidence, not current state. Current source of truth: [M20 cleanup runtime ownership](./m20-cleanup-runtime-ownership.md).

Status: local import dry-run only. No D1 writes, production import, deployment, or cutover is executed.

## Purpose

M11 adds a local-only dry-run CLI for `public-document-list` import preparation. It validates redacted import data, transforms source-like records into the future D1 row shape, creates a `PublicDocumentListSnapshot`, and checks ordering plus public field safety before any future approved import pipeline work.

This checkpoint does not fetch Apps Script, Sheets, Drive, Cloudflare, Vercel, or any remote service. Apps Script remains the production source of truth and the default frontend provider.

## CLI Command

Run the default redacted fixture dry-run:

```sh
pnpm worker:public-documents:import:dry-run
```

Print JSON summary only:

```sh
pnpm worker:public-documents:import:dry-run -- --json
```

Read another local fake/redacted JSON file:

```sh
pnpm worker:public-documents:import:dry-run -- --input <path>
```

## Input Safety

The default input is `cloudflare/public-api/test/fixtures/public-documents.import-source.redacted.json`.

Input rules:

- Redacted and fake records only.
- No production data.
- No real file storage URLs.
- No D1 ids.
- No account ids, secrets, or tokens.
- Local filesystem read only.
- No network calls.
- No production commands.

## Output Safety

The dry-run prints a summary only:

- Input path relative to the repository root.
- Source record count.
- Transformed row count.
- Public item count.
- Excluded draft/inactive count.
- Validation error count.
- First 3 public item ids only.
- Generated timestamp.

It does not print full records or full file URLs. It also prints:

- `No D1 writes were run.`
- `No production commands were run.`
- `No network calls were made.`

## Validation Scope

The dry-run validates:

- Source record shape and unknown fields.
- D1 row shape after transformation.
- Public snapshot contract keys.
- Public snapshot field leakage.
- Pinned/order/published/updated sorting.
- Redacted fixture safety.
- Draft and inactive exclusion from public output.

The public snapshot must expose only `items` and `generatedAt` at the top level. Public items must expose only camelCase public document fields and must not expose `status` or snake_case D1 fields.

## M11.1 Dry-Run Parity Guard

M11.1 keeps the CLI local-only and adds parity tests so the dry-run cannot quietly drift away from the canonical TypeScript import module.

The canonical module remains source of transformation and validation expectations. The parity tests compare CLI output to `cloudflare/public-api/src/import/publicDocumentsImport.ts` using the same fake fixture and a fixed generated timestamp.

Parity coverage includes:

- Sorting: pinned first, then order ascending, then published timestamp descending, then updated timestamp descending.
- Counts: source records, transformed rows, public items, excluded draft/inactive rows, and first public item ids.
- Snapshot contract keys and public item keys.
- Invalid source record behavior.
- Invalid D1 row behavior.
- Safe summary and JSON leakage checks.
- Local-only CLI source checks.

This guard reduces future drift risk between the `.mjs` dry-run CLI and the TypeScript import module without running D1 writes, network calls, production import, deployment, or production cutover.

## No-Go Conditions

Any condition below blocks future import work:

- Real production data in input.
- Real Google Drive URL.
- Production school domain URL.
- D1 id-looking value.
- Unknown source or D1 row fields.
- Invalid status.
- Unsafe fileName.
- Unsafe mediaId.
- Invalid dates.
- Invalid ordering.
- Snake_case or internal field leakage.
- Any write, network, deploy, or remote command in CLI.

## Production Safety Confirmation

M11 does not:

- Write D1.
- Run production import.
- Run production migration.
- Run production seed.
- Deploy production Worker.
- Set production Vercel environment variables.
- Cut over production.
- Fetch Apps Script, Sheets, or Drive data.
- Change Apps Script.
- Change `src/services/googleApi.ts`.
- Change UI, routes, cache keys, or cache TTL.

Cloudflare remains explicit env-only and scoped to `public-document-list`.
