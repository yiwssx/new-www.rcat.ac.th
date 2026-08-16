# P5H Maintainability / Observability — 2026-08-16

## Scope

P5H closes three production-hardening goals without changing RCAT's runtime ownership model:

1. split a high-risk Worker hotspot by responsibility;
2. preserve and regression-guard the existing end-to-end request correlation contract;
3. validate CMS-managed links at the authenticated write boundary and audit existing production link data read-only.

This phase does not rename/recreate the production Worker or D1, move data, change Vercel API URLs, change authentication policy, deploy Apps Script, create a D1 migration, or perform a production write as part of its audit.

## Worker hotspot split

Before P5H, `cloudflare/public-api/src/routes/adminPagination.ts` owned both bounded paginated/read concerns and the complete individual Menu create/update/delete implementation. This mixed query/pagination responsibilities with revision-aware hierarchy mutations in one large route module.

P5H extracts Menu mutation responsibility into `cloudflare/public-api/src/routes/adminMenuMutations.ts`. The pagination module now delegates Menu POST/PATCH/DELETE to that module and no longer contains Menu INSERT/UPDATE/DELETE SQL. Existing revision checks, parent/child constraints, no-store responses, D1 bindings, and Admin identity ownership remain unchanged.

`scripts/check-p5h-maintainability-observability.mjs` prevents the mutation implementation from drifting back into `adminPagination.ts` and keeps a size ceiling on that hotspot.

This is intentionally a focused extraction rather than a broad rewrite. `adminWrite.ts` and CMS auth remain sensitive security boundaries and are not rewritten merely to reduce file size.

## Request correlation closure

The existing `X-RCAT-Request-ID` design remains authoritative:

- Vercel Admin proxy creates a server-owned request ID and forwards it to the private Worker request.
- CMS auth dispatcher creates a server-owned request ID and forwards it through correlation-aware upstream requests.
- direct public Worker calls receive a Worker-generated ID;
- the Worker accepts an incoming request ID only on `/api/admin/*` and `/api/internal/cms-auth/*` when the exact private CMS proxy secret also matches;
- Worker success responses and uncaught top-level errors carry the request ID.

P5H does not add user identity, session data, tokens, request bodies, raw query strings, email addresses, IP addresses, or user agents to correlation logging. The privacy contract in `docs/operations/request-correlation.md` remains unchanged.

The P5H Governance check now fails if the Admin proxy or CMS auth dispatcher loses server-owned request ID creation/forwarding, if the Worker's private trust boundary widens, or if the Worker stops attaching request IDs to normal and top-level error responses.

## CMS link validation

`cloudflare/public-api/src/adminLinkValidation.ts` is the central deterministic link policy for Admin writes. `adminWrite()` invokes it only after authentication, RBAC, and step-up checks have succeeded and before the mutation handler consumes the original request body. Validation parses `request.clone()`, preserving the existing body and malformed-JSON semantics.

Link classes are deliberately narrow:

- **navigation** — internal `/...` paths except protocol-relative `//...`, local `#...` anchors, and explicit `http`, `https`, `mailto`, or `tel` URLs;
- **resource** — internal `/...` paths or absolute `https` only, matching the public resource-rendering safety policy;
- **canonical** — absolute `http` or `https` only.

All classes reject control characters, whitespace, backslashes, URL user-info credentials, malformed absolute URLs, unknown schemes, `javascript:`, `data:`, and protocol-relative external targets.

The write-boundary validator covers link-bearing fields in Content, Documents, Home Sections, Menu (including nested legacy payloads), Carousel, External Services, Media metadata, Site Settings/footer directory links, and Homepage intro settings. Menu's extracted mutation module also applies the central link policy directly as defense in depth.

P5H intentionally does not perform synchronous network `HEAD`/`GET` checks when an editor saves a record. Remote availability is non-deterministic and can fail because of rate limiting, bot protection, transient DNS/network conditions, or sites that reject `HEAD`. Write validation therefore enforces syntax/scheme/policy deterministically.

## Existing production data audit

`.github/workflows/cms-link-integrity-audit.yml` is a manual, master-only, protected-`production` Environment workflow. It uses `CLOUDFLARE_D1_READ_TOKEN`, verifies the exact protected production D1 UUID, selects only link-bearing fields, and runs the same central link policy against current CMS data.

The audit never prints link values. On failure it prints only table/record identity and field name so an operator can locate the record without leaking URL contents into Actions logs. The workflow contains no migration, D1 write/import, restore, or Worker deploy path.

Production audit coverage includes active Content, Documents, Home Sections, Menu, Carousel, External Services, Media metadata, Site Settings, and Homepage Settings.

## Closure gate

P5H closes only when:

- CI is green with the P5H Governance regression check;
- Worker typecheck/dry deploy and existing Admin/auth regression tests pass after hotspot extraction;
- the production merge deploy is healthy;
- **CMS Link Integrity Audit** succeeds from `master` using the protected read-only D1 token;
- no production write, D1 migration, restore, Worker rename, or URL cutover is needed to achieve closure.
