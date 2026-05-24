# Commit Convention

Use Conventional Commit messages:

```text
type(scope): subject
```

Examples:

```text
feat(home): add urgent marquee
fix(site-view): prevent duplicate tracking
refactor(types): move visitor stats settings type
chore(commitlint): enforce conventional commits
docs(architecture): add google api ownership audit
```

Common commit types:

```text
feat, fix, refactor, chore, docs, test, build, ci, perf, style, revert
```

Commitlint runs from the Husky `commit-msg` hook and checks each commit message before Git creates the commit.

This keeps the Git history readable and prepares the project for future automated changelog generation.
