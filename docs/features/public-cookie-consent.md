# Public Cookie Consent and Privacy Boundary

Implementation: 2026-10-21. This feature is reviewed as a separate stacked PR after the public legal policy pages.

## Default decision

- Until a valid explicit decision is loaded, public analytics components **do not mount**.
- Before consent or after rejection, Google Tag Manager/Analytics, Vercel Analytics/Speed Insights and first-party Cloudflare/D1 public visitor tracking are disabled by the same boundary.
- Essential staff authentication, CSRF and MFA cookies are not controlled by this feature and must remain functional.
- Public pages, search, legal information and public read-only data remain accessible without opting in.

## Consent storage

- Browser localStorage key: `rcat.cookie.consent.v1`.
- Versioned object: `{ "version": 1, "analytics": boolean, "decidedAt": ISO-8601 timestamp }`.
- Consent expires after **180 days**, and a missing, malformed, future-dated, expired or unknown-version value fails closed.
- The record is saved locally. It is **not** a server-side immutable consent audit record.
- Rejection / withdrawal clears first-party analytics visitor ID and throttle keys and attempts cleanup of origin-accessible standard Google Analytics cookies.
- Withdrawal after prior acceptance reloads the document so the already-mounted third-party SDKs stop running on the new page. Cookies controlled by other origins may require browser-side deletion.
- Users can revisit preferences from the public footer without being logged in.

## Scope and limitations

- First-party visitor totals are based only on opted-in browsers after this change. Do not describe them as counts of all site visitors.
- The first-party public aggregate stats GET can remain public. The collection POSTs are gated.
- Off-site content providers or media embeds may have their own consent and browser storage policies. Audit any new embedded third-party content separately.
- Never interpret this feature alone as certification of PDPA compliance. The institution must validate lawful bases, DPO or privacy contact, actual retention periods, processor contracts/transfers, Google Tag Manager tags and third-party integrations.
- Keep operational/abuse-prevention server-side logs separate from optional analytics. This gate does not remove logging required for availability or security.

## Release QA

1. New browser with empty storage: banner visible; zero analytics scripts and first-party tracking writes before user action.
2. Reject: banner hides; public navigation works; zero optional telemetry after route changes or reloads.
3. Accept: telemetry mounts after action, with existing normalization and privacy/route scope; choice persists across reloads.
4. Change preferences in footer: preselect saved analytics value; reject/withdraw and verify page reload, first-party analytics storage cleared, no new analytics requests.
5. Corrupt, expired and unknown-version preferences: return to unconsented state.
6. Check mobile layout, keyboard/focus, screen reader dialog and SSR hydration.
7. Ensure functional telemetry tests explicitly seed consent and do not accidentally assume unconditional analytics loading.
8. Review policy text against deployed tags and obtain the institution's legal/privacy sign-off before production promotion.
