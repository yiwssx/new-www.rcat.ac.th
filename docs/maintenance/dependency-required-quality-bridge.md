# Dependency required-quality bridge

Dependency snapshot synchronization can update a Renovate or repair branch with `GITHUB_TOKEN`. GitHub intentionally does not start another `pull_request` workflow from that token-created push, and a `workflow_dispatch` job check does not satisfy a pull request ruleset's required status check.

`dependency-status-sync.yml` therefore keeps the generated snapshot committed, dispatches the canonical `ci.yml` workflow against the exact updated head SHA, waits for that run to finish, and mirrors the canonical CI conclusion through the Commit Status API using the `quality` context. The repository ruleset already requires `quality` from the GitHub Actions integration, so this preserves the existing gate instead of bypassing or weakening it.

The bridge publishes `pending` while canonical CI runs, `success` only when canonical CI concludes successfully, and `failure` for failed, cancelled, or timed-out validation. The same mechanism covers normal Renovate snapshot commits and the post-merge repair branch safety net.
