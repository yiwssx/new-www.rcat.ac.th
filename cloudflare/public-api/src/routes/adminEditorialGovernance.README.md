# Admin editorial governance invariants

- Draft and Review are the only states mutated by the editorial workflow endpoint.
- Published and Scheduled content must use the existing publication flow first.
- Every state mutation is optimistic-revision guarded.
- Trash restore requires the canonical delete revision snapshot and rejects active slug collisions.
- Restored content always returns as Draft.
- Mutations are written to the existing admin audit log and pass through the standard public-cache invalidation finalizer.
