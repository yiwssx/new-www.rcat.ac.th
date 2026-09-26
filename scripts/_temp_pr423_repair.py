from pathlib import Path

path = Path('.github/workflows/production-data-operations.yml')
text = path.read_text()

def replace_once(old: str, new: str, label: str) -> None:
    global text
    if old not in text:
        raise SystemExit(f'{label} target not found')
    text = text.replace(old, new, 1)

replace_once(
    '          if [[ "$schema_status" -ne 0 ]]; then echo "::error::Production fixture schema inspection failed (wrangler exit $schema_status)."; exit "$schema_status"; fi\n',
    '''          if [[ "$schema_status" -ne 0 ]]; then
            echo "::error::Production fixture schema inspection failed (wrangler exit $schema_status)."
            node scripts/sanitize-cloudflare-cli-output.mjs --file "$schema_stderr" --label "wrangler stderr" || true
            node scripts/sanitize-cloudflare-cli-output.mjs --file "$schema_json" --label "wrangler stdout" || true
            exit "$schema_status"
          fi
''',
    'schema diagnostic'
)

replace_once(
    '''          audit_json="$RUNNER_TEMP/production-fixture-audit.json"
          audit_sql="$(cat cloudflare/public-api/sql/production-fixture-audit.sql)"
          pnpm wrangler d1 execute "$PRODUCTION_D1_RESOURCE_NAME" --remote --command="$audit_sql" --json > "$audit_json"
          node scripts/check-production-fixture-audit.mjs --file "$audit_json"
''',
    '''          audit_json="$RUNNER_TEMP/production-fixture-audit.json"
          audit_stderr="$RUNNER_TEMP/production-fixture-audit.stderr"
          audit_sql="$(cat cloudflare/public-api/sql/production-fixture-audit.sql)"
          set +e
          pnpm wrangler d1 execute "$PRODUCTION_D1_RESOURCE_NAME" \\
            --remote \\
            --command="$audit_sql" \\
            --json > "$audit_json" 2> "$audit_stderr"
          audit_status=$?
          set -e

          if [[ "$audit_status" -ne 0 ]]; then
            echo "::error::Production fixture audit query failed before payload validation (wrangler exit $audit_status)."
            node scripts/sanitize-cloudflare-cli-output.mjs --file "$audit_stderr" --label "wrangler stderr" || true
            node scripts/sanitize-cloudflare-cli-output.mjs --file "$audit_json" --label "wrangler stdout" || true
            exit "$audit_status"
          fi

          node scripts/check-production-fixture-audit.mjs --file "$audit_json"
''',
    'fixture audit'
)

replace_once(
    '''          audit_json="$RUNNER_TEMP/production-home-section-fixture-audit.json"
          audit_sql="$(cat cloudflare/public-api/sql/production-home-section-fixture-audit.sql)"
          pnpm wrangler d1 execute "$PRODUCTION_D1_RESOURCE_NAME" --remote --command="$audit_sql" --json > "$audit_json"
          node scripts/check-production-fixture-audit.mjs --file "$audit_json"
''',
    '''          audit_json="$RUNNER_TEMP/production-home-section-fixture-audit.json"
          audit_stderr="$RUNNER_TEMP/production-home-section-fixture-audit.stderr"
          audit_sql="$(cat cloudflare/public-api/sql/production-home-section-fixture-audit.sql)"
          set +e
          pnpm wrangler d1 execute "$PRODUCTION_D1_RESOURCE_NAME" \\
            --remote \\
            --command="$audit_sql" \\
            --json > "$audit_json" 2> "$audit_stderr"
          audit_status=$?
          set -e

          if [[ "$audit_status" -ne 0 ]]; then
            echo "::error::Optional public_home_sections fixture audit failed (wrangler exit $audit_status)."
            node scripts/sanitize-cloudflare-cli-output.mjs --file "$audit_stderr" --label "wrangler stderr" || true
            node scripts/sanitize-cloudflare-cli-output.mjs --file "$audit_json" --label "wrangler stdout" || true
            exit "$audit_status"
          fi

          node scripts/check-production-fixture-audit.mjs --file "$audit_json"
''',
    'home audit'
)

replace_once(
    '''          audit_json="$RUNNER_TEMP/production-fixture-post-audit.json"
          audit_sql="$(cat cloudflare/public-api/sql/production-fixture-audit.sql)"
          pnpm wrangler d1 execute "$PRODUCTION_D1_RESOURCE_NAME" --remote --command="$audit_sql" --json > "$audit_json"
          node scripts/check-production-fixture-audit.mjs --file "$audit_json" --expect-clean
''',
    '''          audit_json="$RUNNER_TEMP/production-fixture-post-audit.json"
          audit_stderr="$RUNNER_TEMP/production-fixture-post-audit.stderr"
          audit_sql="$(cat cloudflare/public-api/sql/production-fixture-audit.sql)"
          set +e
          pnpm wrangler d1 execute "$PRODUCTION_D1_RESOURCE_NAME" \\
            --remote \\
            --command="$audit_sql" \\
            --json > "$audit_json" 2> "$audit_stderr"
          audit_status=$?
          set -e

          if [[ "$audit_status" -ne 0 ]]; then
            echo "::error::Post-cleanup production fixture audit query failed before payload validation (wrangler exit $audit_status)."
            node scripts/sanitize-cloudflare-cli-output.mjs --file "$audit_stderr" --label "wrangler stderr" || true
            node scripts/sanitize-cloudflare-cli-output.mjs --file "$audit_json" --label "wrangler stdout" || true
            exit "$audit_status"
          fi

          node scripts/check-production-fixture-audit.mjs --file "$audit_json" --expect-clean

      - name: Verify optional public_home_sections sentinel is clean
        if: ${{ inputs.operation == 'fixture-cleanup' && env.PUBLIC_HOME_SECTIONS_PRESENT == 'true' }}
        env:
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
        run: |
          audit_json="$RUNNER_TEMP/production-home-section-fixture-post-audit.json"
          audit_stderr="$RUNNER_TEMP/production-home-section-fixture-post-audit.stderr"
          audit_sql="$(cat cloudflare/public-api/sql/production-home-section-fixture-audit.sql)"
          set +e
          pnpm wrangler d1 execute "$PRODUCTION_D1_RESOURCE_NAME" \\
            --remote \\
            --command="$audit_sql" \\
            --json > "$audit_json" 2> "$audit_stderr"
          audit_status=$?
          set -e

          if [[ "$audit_status" -ne 0 ]]; then
            echo "::error::Post-cleanup public_home_sections fixture audit failed (wrangler exit $audit_status)."
            node scripts/sanitize-cloudflare-cli-output.mjs --file "$audit_stderr" --label "wrangler stderr" || true
            node scripts/sanitize-cloudflare-cli-output.mjs --file "$audit_json" --label "wrangler stdout" || true
            exit "$audit_status"
          fi

          node scripts/check-production-fixture-audit.mjs --file "$audit_json" --expect-clean
''',
    'post-clean audit'
)

path.write_text(text)
