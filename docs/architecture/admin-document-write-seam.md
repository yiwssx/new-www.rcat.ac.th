# Admin Documents D1 seam — Wave A/B Code Alignment P05

Status: **IMPLEMENTATION PROPOSED — REQUIRES PR-HEAD CI**

## Before

`cloudflare/public-api/src/routes/adminWrite.ts` directly prepared SQL for Document list/get/create/update/delete/publish/unpublish alongside request parsing, authorization, optimistic revision, and response mapping. The generic `getFirst`/`getAll`/`run` helpers were shared with unrelated route domains.

## After

`cloudflare/public-api/src/db/adminDocumentsWriteRepository.ts` owns:

- Document list/read (including explicit deleted-row visibility)
- Insert/update with positional D1 bindings
- Soft delete and publication state SQL, retaining `revision = revision + 1` and the exact expected-revision predicate

`adminWrite.ts` retains:

- authentication, role/capability, origin, CSRF and step-up requirements in the existing route boundary
- request/field normalization, Document domain policy, and unchanged JSON response shapes
- `assertMutationChanged`, mapping a zero-row update to HTTP 409 rather than a false success
- audit actor identity, timestamps and public cache invalidation under existing request flow

No D1 schema, migration, SQL predicate, route, API response, or production identity change is intended.

## Verification/deletion rationale

The old Document route SQL helper functions are deleted from `adminWrite.ts` to establish one authoritative location for their queries, not wrapped with duplicate data-access facades. Existing Worker/Admin API integration tests continue to exercise route authorization and revision behavior. Focused `adminDocumentsWriteRepository.test.ts` checks field binding, deleted-row visibility, and optimistic revision predicates; full Worker typecheck and required CI remain acceptance gates.

This does not authorize an unrelated Content or Home Section extraction. Subsequent domain seams require separate evidence and narrowly scoped PRs.
