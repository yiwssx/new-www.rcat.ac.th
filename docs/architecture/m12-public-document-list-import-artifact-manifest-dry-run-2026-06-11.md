# M12 Public Document List Import Artifact Manifest Dry-Run

> Historical record — checkpoint 2026-06-11 at commit `609faabe1ef57923869593a6e23ebf792757bc7a`. Measurements and runtime statements below are preserved as historical evidence, not current state. Current source of truth: [M20 cleanup runtime ownership](./m20-cleanup-runtime-ownership.md).

Status: local import artifact manifest dry-run only. No D1 writes, production import, deployment, or cutover is executed.

## Purpose

M12 creates safe audit evidence from the redacted local `public-document-list` import dry-run before any future separately approved production import work.

The manifest is evidence preparation only. Apps Script remains the production source of truth, the default frontend provider remains Apps Script, and Cloudflare remains explicit environment-only for the existing `public-document-list` path.

## Manifest Command

Run the default local-only manifest dry-run:

```bash
pnpm worker:public-documents:import:manifest
```

Optional JSON output:

```bash
pnpm worker:public-documents:import:manifest -- --json
```

Optional deterministic timestamp:

```bash
pnpm worker:public-documents:import:manifest -- --generated-at <ISO>
```

Optional local input path:

```bash
pnpm worker:public-documents:import:manifest -- --input <path>
```

## Manifest Contents

The manifest records:

- `manifestVersion`
- `checkpoint`
- `scope`
- input path
- input SHA-256 checksum
- dry-run counts
- first public item IDs
- generated timestamp
- validation/check status
- safety flags
- validation issue indexes and messages

It does not include raw input contents, full records, full file URLs, or the public snapshot item payload.

## Input Safety

The default input is the redacted/fake fixture at `cloudflare/public-api/test/fixtures/public-documents.import-source.redacted.json`.

Input safety expectations:

- redacted/fake fixture only by default
- no production data
- no real Google file-storage URLs
- no D1 identifiers
- no secrets or tokens
- local filesystem read only
- no network calls
- no shell or remote command execution

The manifest computes SHA-256 from the raw local input content but never includes that content in output.

## Output Safety

The output is a manifest summary only.

It must not print:

- full records
- full file URLs
- secrets
- tokens
- production URLs
- Apps Script endpoint URLs
- Google file-storage URLs
- D1 identifiers

## Validation Scope

M12 validation covers:

- source shape validation
- D1 row validation
- public snapshot contract validation
- sorting validation
- field leakage validation
- checksum evidence
- fake fixture safety validation

The manifest dry-run reuses the M11 local dry-run path, so transformation and validator behavior remains aligned with the canonical import module.

## No-Go Conditions

Any condition below blocks the manifest:

- real production data in input
- Google file-storage URL
- school production domain URL
- D1 identifier-looking value
- unknown fields
- invalid status
- unsafe `fileName`
- unsafe `mediaId`
- invalid dates
- invalid ordering
- snake_case or internal field leakage in public output
- any write, network, shell, or remote command primitive in the CLI

## Production Safety Confirmation

M12 does not perform:

- D1 writes
- production import
- production migration
- production seed
- production Worker deploy
- production Vercel environment changes
- production cutover
- Apps Script, Sheets, or Drive fetches
- Apps Script changes
- `src/services/googleApi.ts` changes
- UI, route, cache key, or cache TTL changes

## Relationship To M13

M12 prepares manifest evidence only.

M13 may use a separately approved, redacted, controlled production import run if production migration governance approves it later. M12 does not authorize M13, does not run production import, and does not approve production cutover.
