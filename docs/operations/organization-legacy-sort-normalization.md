# Organization Chart: one-time legacy sort-order normalization

**Operation type:** guarded, operator-run D1 data repair. This is **not** a Worker release, D1 schema migration, or GitHub Actions workflow.

## Scope

The first stored `sort_order = 0` within a sibling group is valid. This operation only changes rows in groups with _duplicate_ stored ranks:

- `organization_units`: same `parent_content_id` (including root units).
- `organization_positions`: same `unit_content_id`, `group_label`, and `group_sort_order`.
- `organization_assignments`: same `position_id`.

Ties are resolved using the existing deterministic read order: rank, then unit title/ID or position/assignment ID. Duplicate groups are compacted to `0, 1, 2, ...`. Distinct-order groups, including groups with intentional gaps, remain untouched. Only `sort_order`, `revision`, and `updated_at` change on the three Organization tables. Affected **unit** rows also require synchronized `contents.revision`, `contents.updated_at`, and `contents.updated_by` changes so Admin editing remains valid. No personnel profile, role assignment relationship, publication status, workflow, or Worker deployment is modified.

## Safety requirements

1. Use an authorized workstation and the existing approved Cloudflare production credentials; never place credentials or production D1 UUIDs in the repository or logs.
2. Verify the **physical** D1 resource against the protected production UUID using the repository's existing production-preflight guard. The checked-in Wrangler config has an intentional placeholder and **must not** be used directly for remote writes.
3. Take a D1 Time Travel checkpoint and private full SQL export before the operation. Keep those files away from public CI artifacts; the SQL backup may contain personal data.
4. Pause Organization Admin edits while auditing and applying the normalization. Review the proposed changes and make sure they are only duplicate-order siblings.
5. Confirm all Organization unit/content revision pairs already match before any write. A pre-existing mismatch is a blocker. Confirm the preview is nonempty and appropriate before applying. A zero-row preview means **nothing needs changing**; do not run the apply step merely to eliminate every displayed database zero.
6. Run the apply file once and rerun the read-only preview. The postflight must show zero remaining changes. Check representative unit, position and duty order in Admin.
7. If there is a mismatch, stop; use the protected incident/Time Travel recovery plan. Do not try an arbitrary repeat or run against another database.

## Operator commands (Linux/macOS shell)

These commands do **not** alter or dispatch a GitHub Actions workflow. They require existing approved production permissions and should run from the repository root:

```bash
pnpm install --frozen-lockfile --strict-peer-dependencies

# Supply these securely using the established protected production environment.
test -n "${CLOUDFLARE_API_TOKEN:-}"
test -n "${RCAT_PRODUCTION_D1_DATABASE_ID:-}"

OPS_DIR="$(mktemp -d)"
chmod 700 "$OPS_DIR"
export RCAT_D1_OPS_CONFIG="$OPS_DIR/wrangler.production.toml"
D1_NAME="rcat-public-api-preview" # Existing promoted production physical name.

pnpm wrangler d1 list --json > "$OPS_DIR/d1-list.json"
node cloudflare/public-api/scripts/worker-production-preflight.mjs \
  --database-list "$OPS_DIR/d1-list.json" --verify-identity-only

node --input-type=module <<'NODE'
import { readFileSync, writeFileSync } from "node:fs";
import { createProductionWranglerConfig } from "./cloudflare/public-api/scripts/productionDeployGuard.mjs";
const source = readFileSync("cloudflare/public-api/wrangler.toml", "utf8");
const contents = createProductionWranglerConfig(source, process.env.RCAT_PRODUCTION_D1_DATABASE_ID);
writeFileSync(process.env.RCAT_D1_OPS_CONFIG, contents, { mode: 0o600 });
NODE

# Mandatory private recovery material; do not upload as public CI artifacts.
pnpm wrangler d1 time-travel info "$D1_NAME" --json \
  --env production --config "$RCAT_D1_OPS_CONFIG" > "$OPS_DIR/time-travel.json"
pnpm wrangler d1 export "$D1_NAME" --remote \
  --env production --config "$RCAT_D1_OPS_CONFIG" \
  --output "$OPS_DIR/before-normalization.sql"
test -s "$OPS_DIR/before-normalization.sql"

# READ ONLY. Unit/content revision parity must be clean before any write.
pnpm wrangler d1 execute "$D1_NAME" --remote \\
  --env production --config "$RCAT_D1_OPS_CONFIG" \\
  --command "SELECT COUNT(*) AS mismatched_revisions FROM organization_units AS u JOIN contents AS c ON c.id = u.content_id WHERE u.revision <> c.revision;" --json > "$OPS_DIR/revision-parity.json"

# READ ONLY. Review counts and every affected ID before proceeding.
pnpm wrangler d1 execute "$D1_NAME" --remote \
  --env production --config "$RCAT_D1_OPS_CONFIG" \
  --command "$(cat scripts/organization/legacy-order-preview.sql)" \
  --json > "$OPS_DIR/preview.json"
```

**Stop here** to inspect `"$OPS_DIR/preview.json"` and obtain the protected operation approval. Only then run the following _manual write_ against the exact same verified D1 while editing is paused:

```bash
pnpm wrangler d1 execute "$D1_NAME" --remote \
  --env production --config "$RCAT_D1_OPS_CONFIG" \
  --file scripts/organization/legacy-order-apply.sql

# READ ONLY verification: results must contain zero proposed changes.
pnpm wrangler d1 execute "$D1_NAME" --remote \
  --env production --config "$RCAT_D1_OPS_CONFIG" \
  --command "$(cat scripts/organization/legacy-order-preview.sql)" \
  --json > "$OPS_DIR/after.json"
```

Keep the restricted audit/backup files for the authorized retention period, then securely dispose of the temporary configuration containing the private D1 identifier. Reopen normal edits only after confirming the live order and the empty postflight preview.

## Validation

`cloudflare/public-api/test/organizationLegacyOrderNormalization.test.ts` runs the preview and apply SQL against an in-memory database containing the real Organization schema and revision triggers. It checks affected groups, untouched distinct groups, retained personnel data, constraints, and idempotence.

Do **not** mark the work complete solely because this runbook or its PR merged. Completion requires verified production execution and a clean postflight preview.
