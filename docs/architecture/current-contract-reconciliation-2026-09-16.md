# Current Runtime Contract Reconciliation — 2026-09-16

Status: completed maintenance reconciliation.

This record compares the production code on `master`, the deployed runtime behavior, and current operational documentation. Historical release, migration, and dated evidence documents are intentionally preserved as snapshots; they are not rewritten when their old behavior is clearly scoped to their original date.

The existing project phase/status remains unchanged: this work is a narrowly scoped maintenance correction inside the post-P5H production-governance baseline. It does not open a new P6 or Reliability Roadmap v2 phase.

## Reconciled contracts

### CMS authentication bootstrap

Current frontend authorization bootstrap is sequential:

1. Read `/api/cms-auth/session` first.
2. Request Admin capabilities only after the Session read succeeds.
3. If the Session read returns `401`, stop immediately and do not call `/api/admin/capabilities`.
4. Bounded authorization `401` retry/confirmation paths preserve the same Session-first ordering.
5. Mutations are never replayed by this authorization-read retry logic.

Consequences:

- an unauthenticated `/login` may produce the expected Session `401`, but it must produce zero Admin-capability requests;
- an unauthenticated `/admin` navigation may redirect to Login after the Session probe, but it must not request Admin capabilities first;
- after password or MFA authentication succeeds, the frontend refreshes the Session and then loads capabilities before exposing authenticated Admin state.

This behavior is enforced by `src/context/AuthContext.tsx`, unit regression coverage, and the CMS-auth functional suite.

### Facebook embeds

Current public Facebook rendering has two separate supported paths:

- regular Facebook post permalinks use the responsive `facebook.com/plugins/post.php` iframe path;
- direct Reels and explicitly confirmed legacy Reel imports use the Meta JavaScript SDK/XFBML video path (`.fb-video`).

The regular-post iframe builder is post-only. It returns no plugin URL for a Reel so future call sites cannot accidentally route Reels back through the post iframe contract.

For Reels, the application may inject one `facebook-jssdk` script and `#fb-root`, then call `FB.XFBML.parse` on the Reel host. The Vercel CSP permits the required Meta script/connect/frame origins, including `connect.facebook.net`, `www.facebook.com`, and `m.facebook.com` where applicable.

Unsupported Facebook redirect/content URL shapes such as `/share/p`, `/share/v`, `/share/r`, and `/watch` remain fallback-only. The fallback/source link must preserve a safe Facebook source URL. Regular posts must not be promoted to Reels through probing or ID guessing.

For the explicitly confirmed historical Reel whose stored source is a `/{page}/posts/{id}` permalink, playback uses the isolated Reel player contract while the source CTA retains the original stored permalink.

## Documentation changes

The following current operational documents are reconciled with these contracts:

- `docs/cms-auth-session-lifecycle.md` — records Session-first capability loading;
- `docs/production-smoke-checklist.md` — tests the current post/Reel split and anonymous capability gate;
- `docs/production-smoke-test-report-template.md` — records evidence using the same expectations;
- `CHANGELOG.md` — records the completed production fixes under Unreleased.

`docs/architecture/post-p5h-current-project-state.md` and `docs/architecture/current-runtime-ownership.md` remain compatible with this maintenance correction: their project-phase and provider-ownership statements do not change. This record adds the finer-grained frontend ordering/rendering invariants without reopening those architecture phases.

## Historical documents intentionally left unchanged

Dated release reports and migration/closure snapshots may describe older Facebook fallback behavior, earlier function inventories, earlier migration counts, or previous toolchain states. Those statements remain valid historical evidence when the file clearly identifies its dated/snapshot context.

Current behavior is determined by current code, `docs/architecture/current-runtime-ownership.md`, `docs/architecture/post-p5h-current-project-state.md`, this reconciliation record, and the current operational checklists.
