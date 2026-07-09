# Facebook Page Content Import

Local-only tooling exports posts from the RCAT Facebook Page through Meta Graph API and converts the raw export into a Cloudflare D1 SQL import file for the `contents` table.

## Safety

- Do not scrape Facebook HTML. Use Meta Graph API only.
- Do not commit access tokens, raw exports, generated SQL, or generated reports.
- Do not run production import automatically.
- Back up the target D1 database before a production import.
- The Facebook API may not return every historical post. Results depend on Page permissions, token type, app access, and Meta API availability.
- This tooling does not change schema, add D1 migrations, deploy Workers, deploy Vercel, or deploy Apps Script.

## Meta Page Access Token

1. Create or use a Meta app in Meta for Developers.
2. Add Facebook Login or the product flow required by your Meta app setup.
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

This writes:

```text
imports/facebook-posts-2023-2026.raw.json
```

The raw export contains Facebook post text and URLs, so keep it local and uncommitted.

## Transform To SQL

```bash
pnpm facebook:transform:sql
```

This writes:

```text
imports/facebook-news-2023-2026.sql
imports/facebook-news-2023-2026.part-001.sql
imports/facebook-news-2023-2026.part-002.sql
imports/facebook-news-2023-2026.manifest.json
imports/facebook-news-2023-2026.report.csv
```

The SQL uses one `INSERT OR IGNORE` statement per post so repeated imports avoid duplicate rows without creating an oversized D1 remote import statement. It intentionally omits explicit transaction statements and writes batch part files plus a manifest. Review the CSV report before importing.

## Preview Import

```bash
pnpm facebook:import:preview:part1
```

This imports the first generated SQL part into the preview D1 database only. Continue manually with later `.part-NNN.sql` files after reviewing the manifest and report.

## Production Backup

Before production import, create and store a D1 backup/export using the current Cloudflare operator process. Confirm the backup can be located before running the import.

## Production Import

Run this manually only after reviewing the SQL, report CSV, and production backup.

```powershell
pnpm wrangler d1 execute rcat-public-api-production `
  --remote `
  --env production `
  --config cloudflare/public-api/wrangler.toml `
  --file .\imports\facebook-news-2023-2026.part-001.sql
```

## Troubleshooting

- Missing token: set `META_PAGE_ACCESS_TOKEN` in the current shell. The script never reads a hardcoded token.
- Missing Page ID: set `META_PAGE_ID=100063746585360`.
- Permission error: inspect the printed Meta API error payload, confirm Page access, token permissions, app mode/review status, and `META_GRAPH_VERSION`.
- Incomplete history: adjust permissions or token/app access and rerun the export. Meta may still limit historical availability.
