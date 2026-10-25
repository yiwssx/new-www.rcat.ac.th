#!/usr/bin/env bash
# One-click bounded security preflight. Runs source checks inside the existing offline sandbox.
set -Eeuo pipefail

profile="${1:-quick}"
case "$profile" in
  quick|standard) ;;
  *) printf '%s\n' "Invalid audit profile" >&2; exit 2 ;;
esac

ref="$(git rev-parse HEAD)"
[[ "$ref" =~ ^[0-9a-f]{40}$ ]] || { echo "A pinned checkout is required" >&2; exit 2; }

args=(
  --ref "$ref"
  --entry scripts/security-audit/audit-controls.cjs
  --include server/adminProxy/handlers.mjs
  --include server/cmsAuth/handlers.mjs
  --include cloudflare/public-api/src/auth/adminAccess.ts
  --include cloudflare/public-api/src/auth/adminRoutePolicy.ts
)
if [[ "$profile" == standard ]]; then
  args+=(
    --include cloudflare/public-api/src/auth/adminCapabilities.ts
    --include cloudflare/public-api/src/auth/adminStepUp.ts
    --include cloudflare/public-api/src/auth/cmsSessionService.ts
    --include cloudflare/public-api/src/routes/cmsAuthInternal.ts
  )
fi

bash scripts/security-audit/run-sandbox.sh "${args[@]}" -- "$profile"
