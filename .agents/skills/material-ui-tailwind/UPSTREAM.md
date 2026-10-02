# Upstream provenance

This directory vendors the official Material UI `material-ui-tailwind` agent skill for repository-local, reviewable use.

- Source repository: `mui/material-ui`
- Source path: `skills/material-ui-tailwind`
- Pinned upstream commit: `0cb3c247c59d960e15216ebc4c2e12538b750804`
- Skill version: `1.0.0`
- Target Material UI range: `>=9.0.0 <10.0.0`
- Vendored on: `2026-10-02`

The five upstream files (`AGENTS.md`, `README.md`, `SKILL.md`, `metadata.json`, and `reference.md`) are kept unmodified from the pinned snapshot. `UPSTREAM.md` is RCAT-owned provenance metadata and is not part of the upstream skill.

Those five upstream files are listed explicitly in `.prettierignore`. The repository formatter must not rewrite third-party agent instructions because doing so would break blob-level provenance and make upstream review harder. RCAT-owned files in this directory remain subject to the normal repository formatting rules.

Do not automatically synchronize this directory from upstream `master`. Agent skills are executable guidance for coding agents, so upstream changes must be reviewed as instruction-supply-chain changes. Update the pinned commit and vendored files together in a normal pull request after reviewing the upstream diff and compatibility with the repository's current Material UI major version and local design-system policy.
