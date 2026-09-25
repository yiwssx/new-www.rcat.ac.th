# Required-quality bridge for bot-created branch commits

Repository automation can update a pull-request branch with `GITHUB_TOKEN`. Two current paths do this: dependency snapshot synchronization and automatic formatting corrections. GitHub intentionally does not start another normal `pull_request` workflow from a token-created push, and a `workflow_dispatch` job check does not satisfy a pull request ruleset's required status check.

`dependency-status-sync.yml` and `format-guard.yml` therefore use the shared `scripts/validate-required-quality.sh` bridge after they create a bot commit. The bridge dispatches the canonical `ci.yml` workflow against the exact updated head SHA, waits for that run to finish, and mirrors the canonical CI conclusion through the Commit Status API using the `quality` context. The repository ruleset already requires `quality` from the GitHub Actions integration, so this preserves the existing gate instead of bypassing or weakening it.

The bridge publishes `pending` while canonical CI runs, `success` only when canonical CI concludes successfully, and `failure` for failed, cancelled, unresolved, or timed-out validation. The mechanism covers normal Renovate snapshot commits, the post-merge dependency repair branch safety net, and Format Guard correction commits.
