# Navigation Placeholder Policy

## Purpose

The CMS intentionally permits placeholder navigation targets while a final destination is not yet available. These placeholders keep menu and footer entries renderable without inventing a route or redirecting users through an unrelated content page.

## Supported placeholder semantics

The following values are intentional and must not be treated as broken links by repository governance solely because they are placeholders:

- `#` — a container or non-navigating menu target.
- `/` — the safe fallback used when an editor leaves a menu destination empty.
- `/#` — an explicit root placeholder used by existing navigation data.

`normalizeMenuHref` therefore keeps `#`, `/`, and `/#` stable and normalizes an empty or whitespace-only value to `/`.

## Why this behavior is preserved

When a CMS item has no final destination, inventing a route such as `/content/...` or redirecting it to another unrelated page creates misleading navigation. Rewriting placeholders can also create loop-like UX where the user repeatedly lands on a page that does not represent the selected menu item.

The fallback contract is therefore intentional: preserve a neutral target until an editor supplies a real destination.

## Validation boundary

Placeholder support does not relax URL safety. Navigation validation must continue to reject malformed or unsafe targets such as protocol-relative URLs (`//...`), `javascript:` URLs, `data:` URLs, URLs containing unsafe whitespace or backslashes, and credential-bearing absolute URLs.

Resource and canonical URL policies remain narrower than navigation policy and must not inherit placeholder semantics.

## Regression policy

Any future change to placeholder handling must update both the Admin menu-model tests and Worker link-policy tests. Production link audits should distinguish deliberate placeholders from malformed or unsafe navigation targets rather than automatically rewriting placeholder values.
