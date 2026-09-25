#!/usr/bin/env bash

set -euo pipefail

TARGET_BRANCH="${1:?target branch is required}"
TARGET_SHA="${2:?target SHA is required}"
: "${GH_TOKEN:?GH_TOKEN is required}"
: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"

workflow_runs_endpoint="repos/$GITHUB_REPOSITORY/actions/workflows/ci.yml/runs"
workflow_url="https://github.com/$GITHUB_REPOSITORY/actions/workflows/ci.yml"

publish_quality_status() {
  local state="$1"
  local description="$2"
  local target_url="$3"

  gh api --method POST "repos/$GITHUB_REPOSITORY/statuses/$TARGET_SHA" \
    -f state="$state" \
    -f context="quality" \
    -f description="$description" \
    -f target_url="$target_url" >/dev/null
}

latest_dispatch_run_id() {
  gh api --method GET "$workflow_runs_endpoint" \
    -f event=workflow_dispatch \
    -f branch="$TARGET_BRANCH" \
    -F per_page=20 \
    --jq ".workflow_runs[] | select(.head_sha == \"$TARGET_SHA\") | .id" \
    | head -n 1
}

ci_run_id="$(latest_dispatch_run_id)"
publish_quality_status \
  "pending" \
  "Canonical CI is queued for the updated branch head" \
  "$workflow_url"

if [ -n "$ci_run_id" ]; then
  echo "Reusing existing canonical CI run $ci_run_id for $TARGET_SHA."
else
  gh workflow run ci.yml --ref "$TARGET_BRANCH"

  for attempt in $(seq 1 60); do
    ci_run_id="$(latest_dispatch_run_id)"
    if [ -n "$ci_run_id" ]; then
      break
    fi
    sleep 2
  done
fi

if [ -z "$ci_run_id" ]; then
  publish_quality_status \
    "failure" \
    "Canonical CI dispatch could not be resolved" \
    "$workflow_url"
  echo "Unable to locate dispatched CI run for $TARGET_SHA."
  exit 1
fi

ci_url="https://github.com/$GITHUB_REPOSITORY/actions/runs/$ci_run_id"
publish_quality_status \
  "pending" \
  "Canonical CI is validating the updated branch head" \
  "$ci_url"

ci_status=""
ci_conclusion=""
for attempt in $(seq 1 180); do
  ci_status="$(gh run view "$ci_run_id" --json status --jq '.status')"
  if [ "$ci_status" = "completed" ]; then
    ci_conclusion="$(gh run view "$ci_run_id" --json conclusion --jq '.conclusion')"
    break
  fi
  sleep 10
done

if [ "$ci_status" != "completed" ]; then
  quality_state="failure"
  quality_description="Canonical CI did not complete within the validation window"
elif [ "$ci_conclusion" = "success" ]; then
  quality_state="success"
  quality_description="Canonical CI passed on the updated branch head"
else
  quality_state="failure"
  quality_description="Canonical CI concluded: ${ci_conclusion:-unknown}"
fi

publish_quality_status "$quality_state" "$quality_description" "$ci_url"

{
  echo "## Required quality status"
  echo "Validated commit: \`$TARGET_SHA\`"
  echo "CI run: $ci_url"
  echo "Result: \`$quality_state\`"
} >> "$GITHUB_STEP_SUMMARY"

test "$quality_state" = "success"
