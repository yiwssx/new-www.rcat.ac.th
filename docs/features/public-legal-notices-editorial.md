# RCAT website legal notices — editorial basis and verification

Revision scope: 21 October 2026. These are concise visitor-facing **information notices**, not click-through agreements, formal legal certifications, or institutionally signed proclamations.

## Government guidance consulted

- Personal Data Protection Act B.E. 2562 (Thai PDPA), particularly transparency/notice duties, lawful processing, consent and data subject rights.
- Digital Government Development Agency (DGA), *Privacy Notice for enquiries and complaints*: https://www.dga.or.th/document-sharing/pdpa/124276/
- DGA, *Privacy Notice for Business Portal*: https://www.dga.or.th/document-sharing/pdpa/124352/
- Personal Data Protection Committee (PDPC), *Government Platform for PDPA Compliance*: https://gppc.pdpc.or.th/

These sources inform **document structure, formal Thai diction and general legal principles**. No DGA/PDPC agency text is copied into the RCAT notices, and no agency endorsement or legal approval is claimed.

## Actual RCAT implementation basis

- `src/public/pages/PublicComplaintPage.tsx`: optional contact/complaint form includes name, telephone, email, message and possible attachments.
- `src/public/components/PublicShellRouteLayout.tsx`: no public analytics SDK mounts until optional analytics consent is affirmative.
- `src/public/cookies/publicCookieConsent.ts`: local versioned consent record persists for at most 180 days, permits rejection and withdrawal.
- `src/shared/telemetry/PublicTelemetry.tsx`: Google, Vercel and first-party site-visit analytics behind the public consent boundary.
- Staff-authentication cookies and operational security/access logs are distinct from optional public analytics.
- Privacy/cookie pages remain public, and users may navigate to contacts without analytics consent.

## Editorial exclusions and pending institutional checks

- **Do not assert** that RCAT collects health, biometric, financial or other special-category personal data solely on the basis of these website features.
- Do not invent a Data Protection Officer's name, telephone, email, office order, official effective date, signed approval, or fixed retention schedule.
- The publicly displayed notice describes retention proportionately without asserting a specific duration beyond the verified 180-day browser consent preference. Review the actual retention of complaints, access/security logs and staff records before an official institutional notice is approved.
- Confirm actual processors and international transfers, individual GTM tags and embedded third-party services before any legally certified version.
- Preserve the direct links and SEO routes `/privacy-policy` and `/cookie-policy`, the existing CMS-controlled footer directory, and the consent management functionality.
- A Privacy Notice explains processing; it is **not** a blanket consent agreement. Cookie analytics choice remains separate and user-controlled.

## Layout standard

One continuous, semantically structured document per route, numbered clauses, readable mobile typography, an anchored contents list, and a horizontally scrollable cookie-category table. Avoid promotional cards and multiple competing page headers.