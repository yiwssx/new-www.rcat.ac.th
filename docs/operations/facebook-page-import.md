# Facebook Page Content Import

Updated: 2026-09-11.

Local-only tooling exports posts from the RCAT Facebook Page through Meta Graph API and converts the raw export into Cloudflare D1 SQL for the `contents` table.

The current Cloudflare model has local development plus one canonical remote production role. There is no persistent remote Preview environment. The canonical production D1 retains the historical physical name `rcat-public-api-preview` and is selected through `--env production`; the old empty `rcat-public-api-production` resource was deleted and must not be targeted.

## Safety

- Do not scrape Facebook HTML. Use Meta Graph API only.
- Do not commit access tokens, raw exports, generated SQL, generated reports, private identifiers, or production backup artifacts.
- Do not run production import automatically.
- Back up the canonical production D1 before any approved production import.
- The Facebook API may not return every historical post. Results depend on Page permissions, token type, app access, and Meta API availability.
- This tooling does not change schema, add D1 migrations, deploy Workers, deploy Vercel, or deploy Apps Script.
- Do not revive the retired `--env preview` import path. Use local D1 for rehearsal and explicit protected production operations only when approved.

## Meta Page Access Token

1. Create or use a Meta app in Meta for Developers.
2. Add Facebook Login or the product flow required by the Meta app setup.
3. Grant the app Page access for the RCAT Facebook Page.
4. Generate a Page access token with permissions that allow reading Page posts, such as `pages_read_engagement` and any additional permission Meta requires for the Page/app review state.
5. Prefer a short-lived local shell token while testing. If a long-lived token is used, store it only in a local secret manager or uncommitted environment file.
6. Set `META_GRAPH_VERSION` explicitly when Meta releases or sunsets Graph API versions. The script currently defaults to `v25.0` if the variable is omitted.

## Environment Variables

PowerShell:

```powershell
$env:META_PAGE_ACCESS_TOKEN = "<page-access-token>"
$env:META_PAGE_ID = "100063746585360"
$env:META_GRAPH_VERSION = "v25.0"
```

macOS/Linux shell:

```bash
export META_PAGE_ACCESS_TOKEN="<page-access-token>"
export META_PAGE_ID="100063746585360"
export META_GRAPH_VERSION="v25.0"
```

## Export Posts

```bash
pnpm facebook:export:posts
```

The default export uses 30-day chunks, `limit=25`, and minimal Graph API fields:

```text
id,message,story,created_time,permalink_url,full_picture,status_type
```

For a smaller smoke export:

```bash
pnpm facebook:export:posts:small
```

To include attachment metadata, run the exporter directly with `--include-attachments`.

The default full export writes:

```text
imports/facebook-posts-2023-2026.raw.json
```

The raw export contains Facebook post text and URLs, so keep it local and uncommitted.

## Transform To SQL

```bash
pnpm facebook:transform:sql
```

This writes the generated SQL, numbered batch parts, manifest, and report under `imports/`.

The transform stores each Facebook post as CMS news metadata with `template = "facebook-embed"` and `canonical_url` set to the Facebook permalink. `body_snapshot` is only a minimal fallback that points back to Facebook; it does not copy the full post text or attachment JSON into article body content.

The SQL uses one `INSERT OR IGNORE` statement per post so repeated imports avoid duplicate rows without creating an oversized D1 remote import statement. It intentionally omits explicit transaction statements and writes batch part files plus a manifest. Review the generated report before any import.

## Local Rehearsal

There is no current `facebook:import:preview:*` package script and no current remote `[env.preview]` configuration. Rehearse only against local D1.

1. Apply current local migrations:

```bash
pnpm worker:d1:migrate:local
```

2. Import one reviewed generated part into the local database:

```bash
pnpm wrangler d1 execute rcat-public-api-local \
  --local \
  --config cloudflare/public-api/wrangler.toml \
  --file ./imports/facebook-news-2023-2026.part-001.sql
```

3. Inspect only the imported `facebook-import` rows locally before considering production approval.

Do not use the physical production resource name for rehearsal. The fact that production is physically named `rcat-public-api-preview` does not make it a Preview or test target.

## Production Backup

Before an approved production import, create and store a D1 backup/export using `docs/operations/admin-backup.md` and the current protected production process. Confirm the backup can be located before running the import.

## Production Import

Production import is a deliberate mutating operator action. Run it only after the generated SQL/report have been reviewed, the backup/recovery path is ready, and the operation is explicitly approved.

The canonical production D1 physical name is `rcat-public-api-preview` under `env.production`:

```powershell
pnpm wrangler d1 execute rcat-public-api-preview `
  --remote `
  --env production `
  --config cloudflare/public-api/wrangler.toml `
  --file .\imports\facebook-news-2023-2026.part-001.sql
```

Continue with later `.part-NNN.sql` files only in numeric order and only while the approved import remains healthy. Do not delete production `facebook-import` rows merely to rerun an import; production cleanup requires a separate explicit decision.

## Troubleshooting

- Missing token: set `META_PAGE_ACCESS_TOKEN` in the current shell. The script never reads a hardcoded token.
- Missing Page ID: set the intended `META_PAGE_ID` locally.
- Permission error: inspect the Meta API error payload, confirm Page access, token permissions, app mode/review status, and `META_GRAPH_VERSION`.
- Incomplete history: adjust permissions or token/app access and rerun the export. Meta may still limit historical availability.
- Preview command/documentation found in historical material: do not execute it against current infrastructure. The persistent Preview environment was retired; current remote D1 operations use the canonical production identity only.
