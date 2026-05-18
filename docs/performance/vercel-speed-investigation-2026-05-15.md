# Vercel Speed Investigation: 2026-05-15

## Scope

- Production URL: https://new-wwwrcatacth.vercel.app/
- Baseline report from user: Vercel Speed Insights is around 70 on both mobile and desktop after the functional smoke release passed.
- Goal: recover 90+ desktop and mobile without removing current production UX.
- Status: 90+ has not been measured yet from this environment. PageSpeed Insights returned quota errors, so the score must be verified after deployment in Vercel Speed Insights or Lighthouse.

## Evidence Collected

### Build Output

Baseline build before optimization:

| Asset group             | Evidence                                                   |
| ----------------------- | ---------------------------------------------------------- |
| Main JS                 | `index-LhElgNbU.js` 412.28 kB raw / 134.83 kB gzip         |
| Public homepage JS      | `PublicHomePage-Cx8MH7RR.js` 59.45 kB raw / 19.43 kB gzip  |
| Public shell JS         | `PublicSiteShell-D1hC0MY7.js` 39.88 kB raw / 13.97 kB gzip |
| Largest admin chunk     | `ContentPage-C2o9iBb1.js` 120.01 kB raw / 33.80 kB gzip    |
| Largest shared UI chunk | `TextField-WG16cTXa.js` 51.37 kB raw / 15.02 kB gzip       |
| CSS total               | 45,649 bytes                                               |
| JS total                | 87 built JS files, 1,164,634 bytes                         |

Build after optimization:

| Asset group               | Evidence                                                     |
| ------------------------- | ------------------------------------------------------------ |
| Main JS                   | `index-ysCef0Bj.js` 390.70 kB raw / 128.48 kB gzip           |
| Public homepage JS        | `PublicHomePage-zmXHa7Ig.js` 60.52 kB raw / 19.80 kB gzip    |
| Public shell JS           | `PublicSiteShell-DWHCqraz.js` 40.26 kB raw / 14.14 kB gzip   |
| Lazy admin progress chunk | `AdminActionProgress-Dw4habV7.js` 2.20 kB raw / 1.22 kB gzip |
| Largest admin chunk       | `ContentPage-Bn8mIudg.js` 120.15 kB raw / 33.86 kB gzip      |
| Largest shared UI chunk   | `TextField-BwhwfZ5M.js` 51.47 kB raw / 15.06 kB gzip         |
| CSS total                 | 45,649 bytes                                                 |
| JS total                  | 92 built JS files, 1,171,091 bytes                           |

Result: the public initial main bundle dropped by 21.58 kB raw and 6.35 kB gzip. Total JS increased slightly because one small public/admin boundary was split out.

### Production Runtime Trace

PageSpeed Insights could not provide a score in this environment. The first attempt could not reach the remote service, and retrying with network access returned `429 Too Many Requests` for both mobile and desktop. The following evidence came from a production browser trace instead and should not be treated as a Lighthouse score.

Mobile production observations:

| Metric / resource             | Evidence                                                                 |
| ----------------------------- | ------------------------------------------------------------------------ |
| LCP element                   | IntroGate `img` using Google Drive thumbnail `sz=w1600`                  |
| LCP timing                    | About 8.1 s in the trace                                                 |
| CLS                           | About 0.4566 in the trace                                                |
| Apps Script `public-home`     | About 5.1 s                                                              |
| Legacy Apps Script `snapshot` | About 3.8 s, also requested during homepage cold load                    |
| IntroGate image               | Google Drive final image about 287 kB                                    |
| Director image                | Google Drive final image about 442 kB                                    |
| Logo                          | `/rcat-logo.png` about 354 kB and preloaded at high priority             |
| YouTube iframe                | Loaded below-fold resources immediately, including a large player script |
| Google Maps iframe            | Loaded below-fold map scripts immediately                                |

Desktop production observations:

| Metric / resource | Evidence                                                |
| ----------------- | ------------------------------------------------------- |
| LCP element       | IntroGate `img` using Google Drive thumbnail `sz=w1600` |
| LCP timing        | About 10.3 s in the trace                               |
| FCP               | About 2.2 s in the trace                                |
| CLS               | About 0.3316 in the trace                               |
| Logo              | `/rcat-logo.png` about 354 kB                           |

## Suspected Bottlenecks

1. IntroGate Google Drive image was the observed LCP element and was always requested as `sz=w1600`, which is larger than needed on mobile.
2. The homepage started both the `public-home` request and the legacy `snapshot` request during cold load, increasing Apps Script work and network contention.
3. Below-fold YouTube and Google Maps iframes were mounted immediately, pulling third-party JavaScript before the user reached those sections.
4. The site logo was a 354 kB image and was also preloaded at high priority despite being displayed as a small header asset.
5. The root public bundle still contained admin progress code before route-level need.
6. GTM, Vercel Analytics, and Speed Insights add third-party work, but these are required production features and were preserved.

## Changes Applied

1. Removed the high-priority logo preload from `index.html`.
2. Added a smaller `public/rcat-logo-128.png` and switched `logoPath` and favicon usage to that asset.
3. Added responsive Google Drive thumbnail `srcset` generation for safe public image URLs.
4. Applied responsive Drive `srcset` to IntroGate, Director image, and carousel images while preserving existing normalized `src` behavior.
5. Deferred below-fold YouTube and Google Maps iframe `src` assignment until the section is near the viewport.
6. Prevented the homepage shell from starting the legacy `snapshot` request while the homepage-specific `public-home` request is already loading.
7. Lazy-loaded `AdminActionProgress` only on login/admin routes.

## Expected Impact

- Mobile IntroGate and Director images can use smaller Google Drive thumbnail candidates instead of always taking `w1600`.
- Homepage cold load should avoid the duplicate Apps Script `snapshot` request when the public-home endpoint is already the source of homepage data.
- Initial network should no longer include below-fold YouTube and Google Maps iframe payloads before those sections are near the viewport.
- The 354 kB logo no longer competes as a high-priority preload; the header uses a smaller image asset.
- The public initial bundle is smaller because admin progress code is no longer part of the public root path.

## Manual Verification Required

1. Deploy the frontend changes to Vercel.
2. Confirm the Apps Script public endpoint cache is deployed, because uncached Apps Script reads were a major observed bottleneck.
3. Open the production homepage in an incognito mobile viewport.
4. Verify IntroGate still appears with the public Google Drive image and can be dismissed.
5. Verify Director image, carousel, Facebook embed/fallback, analytics, and Speed Insights still work.
6. Run Lighthouse mobile and desktop, or review Vercel Speed Insights after fresh field data is available.
7. Confirm whether both mobile and desktop reach 90+.

## Remaining Risk

- The 90+ target is still pending measurement. This report does not claim that target has been reached.
- Google Drive remains slower and less controllable than an optimized static WebP/AVIF asset under `/public/intro` or an owned CDN.
- If the score remains below target after deployment, the next highest-impact change is to replace the IntroGate and Director Drive images with optimized static WebP/AVIF images sized for their rendered layout.
- If Apps Script caching is not deployed, the homepage can still be slowed by live Google Sheets/Drive reads.

## Rollback Notes

- Revert the responsive Drive `srcset` helper and component attributes if image selection behaves unexpectedly.
- Revert the lazy iframe helper if below-fold embeds need to mount immediately again.
- Restore `logoPath` to `/rcat-logo.png` and re-add the preload if the smaller logo asset is rejected visually.
- Revert the `PublicSiteShell` `skipShellDataFetch` flow if homepage menu hydration regresses.
