# Production Smoke Test Report: 2026-05-15

รายงานนี้บันทึกผล smoke test สำหรับ deployment ปัจจุบัน โดยอ้างอิงจาก [Production Smoke Checklist](../production-smoke-checklist.md) และ [Production Smoke Test Report Template](../production-smoke-test-report-template.md)

> Manual production smoke verification completed against https://preview-placeholder.example.invalid/. Follow-up mobile IntroGate image issue was traced to Google Drive file sharing permission; after the file was shared publicly with anyone who has the link, the IntroGate image appears correctly.

## 1. Deployment Information

| รายการ                        | รายละเอียด                                                                  |
| ----------------------------- | --------------------------------------------------------------------------- |
| Deployment URL                | https://preview-placeholder.example.invalid/                                         |
| Vercel Deployment ID หรือ URL | Deployment URL verified; exact Vercel deployment ID not recorded            |
| Commit SHA                    | `a4da2a27e4946124d1ed52ba4857abad5c9ac5bd`                                  |
| วันที่/เวลาที่ทดสอบ           | 2026-05-15, local quality gate and manual production verification completed |
| ผู้ทดสอบ                      | Codex QA/frontend release engineer                                          |
| Browser/Device                | Manual browser verification completed; exact browser/device not recorded    |
| Environment                   | Production                                                                  |
| หมายเหตุรอบ Deploy            | Manual production smoke verification passed                                 |

## 2. Environment Variables Checked

**Overall result:** Pass

Environment variables were manually verified in Vercel. Sensitive values are intentionally not recorded.

| Environment variable / setting            | Result | ค่า/แหล่งอ้างอิง                                               | หมายเหตุ                      |
| ----------------------------------------- | ------ | -------------------------------------------------------------- | ----------------------------- |
| Google Apps Script URL                    | Pass   | Verified in Vercel dashboard; value intentionally not recorded | Do not expose Apps Script URL |
| Public site URL                           | Pass   | Verified in Vercel dashboard; value intentionally not recorded |                               |
| Analytics strategy                        | Pass   | Verified in Vercel dashboard; value intentionally not recorded |                               |
| GTM ID                                    | Pass   | Verified in Vercel dashboard; value intentionally not recorded | Do not expose analytics IDs   |
| GA4 Measurement ID                        | Pass   | Verified in Vercel dashboard; value intentionally not recorded | Do not expose analytics IDs   |
| Vercel Analytics / Speed Insights setting | Pass   | Verified in Vercel dashboard; value intentionally not recorded |                               |
| อื่น ๆ                                    | Pass   | Verified in Vercel dashboard; value intentionally not recorded |                               |

## 3. Quality Command Results

| Command                 | Result | Evidence / notes                          |
| ----------------------- | ------ | ----------------------------------------- |
| `pnpm format:check`     | Pass   | Full local quality gate passed            |
| `pnpm lint`             | Pass   | Full local quality gate passed            |
| `pnpm test:unit`        | Pass   | Full local quality gate passed            |
| `pnpm test:integration` | Pass   | Full local quality gate passed            |
| `pnpm build`            | Pass   | Full local quality gate passed            |
| `pnpm quality`          | Pass   | Full local quality gate passed end-to-end |

- [x] Local quality gate passed before release sign-off.

## 4. Public Homepage

**Overall result:** Pass

Manual production browser verification passed against https://preview-placeholder.example.invalid/.

- [x] Homepage loads successfully
- [x] No app-owned console errors
- [x] Route works after browser hard refresh
- [x] First load performance remains acceptable

**Evidence / notes:**

- Homepage was manually verified on production.

## 5. Intro Gate

**Overall result:** Pass

Manual production browser verification passed. Follow-up mobile testing confirmed the IntroGate image appears correctly after the Google Drive file sharing permission was corrected.

- [x] Intro gate appears when enabled
- [x] Intro gate can be dismissed
- [x] Intro gate does not require page refresh after settings load
- [x] Intro gate remains hidden when disabled
- [x] Mobile intro gate image appears reliably

**Evidence / notes:**

- Root cause: the Google Drive image file was not shared publicly; this was a file permission issue, not an IntroGate rendering logic issue.
- Google Drive image files used by IntroGate must be shared as "Anyone with the link can view".
- IntroGate supports public Google Drive image URLs and normalizes supported Drive share/open/uc/thumbnail URLs to `https://drive.google.com/thumbnail?id=FILE_ID&sz=w1600`.
- Direct Facebook CDN URLs such as `scontent...fbcdn.net` should still be avoided because they are temporary and can vary by CDN edge.
- Mobile IntroGate was re-tested after correcting the Google Drive sharing permission and now appears correctly.
- Director image was also verified working with the corrected public image access.

## 6. Carousel

**Overall result:** Pass

Manual production browser verification passed against real CMS carousel data.

- [x] Carousel renders image-only slides
- [x] No title/subtitle/CTA overlay blocks images
- [x] Controls work when multiple slides exist
- [x] Autoplay works when enabled
- [x] Carousel does not autoplay when disabled
- [x] First carousel image is prioritized correctly if visible

**Evidence / notes:**

- Carousel behavior was manually verified on production.

## 7. Public Content Detail

**Overall result:** Pass

Manual production browser verification passed.

- [x] News detail page loads
- [x] Announcement detail page loads
- [x] Metadata displays content type, publication status, full Thai date, publisher, tags, and view count
- [x] Old `รายละเอียดเนื้อหา` sidebar is not shown
- [x] Attached media renders
- [x] Related content renders
- [x] Back button works
- [x] Tags are clickable and route to filtered listing pages

| ประเภท              | URL | Result | Notes                                                   |
| ------------------- | --- | ------ | ------------------------------------------------------- |
| News detail         |     | Pass   | Manually verified on production; exact URL not recorded |
| Announcement detail |     | Pass   | Manually verified on production; exact URL not recorded |

## 8. Facebook Embed/Fallback

**Overall result:** Pass

Manual production browser verification passed.

- [x] Valid Facebook permalink URL renders iframe plugin
- [x] iframe uses `facebook.com/plugins/post.php`
- [x] Fallback link `เปิดโพสต์บน Facebook` is visible under supported embeds
- [x] `/share/p` URLs show fallback instead of iframe
- [x] `/watch` URLs show fallback instead of iframe
- [x] `/reel` URLs show fallback instead of iframe
- [x] Fallback text appears: `ไม่สามารถฝังโพสต์ Facebook นี้ได้โดยตรง`
- [x] Fallback link opens the original Facebook URL
- [x] No `facebook-jssdk` script is injected by our app
- [x] No `.fb-post` div is rendered

| กรณี                   | Public page URL | Facebook URL | Result | Notes                                                   |
| ---------------------- | --------------- | ------------ | ------ | ------------------------------------------------------- |
| Supported permalink    |                 |              | Pass   | Manually verified on production; exact URL not recorded |
| Unsupported `/share/p` |                 |              | Pass   | Manually verified on production; exact URL not recorded |
| Unsupported `/watch`   |                 |              | Pass   | Manually verified on production; exact URL not recorded |
| Unsupported `/reel`    |                 |              | Pass   | Manually verified on production; exact URL not recorded |

## 9. Analytics / GTM / GA4

**Overall result:** Pass

Manual production analytics verification passed. Private analytics account details are intentionally not recorded.

- [x] Public pages load analytics according to configured strategy
- [x] GTM loads when GTM strategy is enabled
- [x] GA4 direct `gtag` loads only when strategy is `gtag` or `both`
- [x] Login/admin routes do not send public analytics `page_view`
- [x] Public `page_view` verified in GTM/GA4 debug tools if available
- [x] Vercel Analytics and Speed Insights load only where expected

**Evidence / notes:**

- Analytics, GTM, GA4, Vercel Analytics, and Speed Insights behavior was manually verified on production. Private account values are not recorded.

## 10. Admin CMS

**Overall result:** Pass

Manual production CMS verification passed. Credentials are intentionally not recorded.

- [x] Admin login works
- [x] Content list loads
- [x] Create content works
- [x] Edit content works
- [x] Publish/unpublish status works
- [x] Media selection works
- [x] Carousel slide management works
- [x] Intro gate settings can be saved
- [x] Facebook post content block accepts a valid permalink URL
- [x] Unsupported Facebook URLs display fallback on the public page
- [x] No unexpected Apps Script write errors

**Evidence / notes:**

- Admin CMS smoke checks were manually verified on production. No credentials are recorded.

## 11. Vercel Logs / Performance

**Overall result:** Pass

Manual Vercel deployment, logs, route, and performance verification passed.

- [x] Deployment succeeds
- [x] Homepage route works
- [x] Public content detail routes work
- [x] Admin route works
- [x] Browser hard refresh works
- [x] No critical runtime errors in Vercel logs
- [x] Speed Insights does not show obvious regression
- [x] First load performance remains acceptable

**Evidence / notes:**

- Deployment URL verified; exact Vercel deployment ID not recorded.

## 12. Rollback Readiness

**Overall result:** Ready

Rollback readiness was manually verified.

- [x] Last known good deployment identified
- [x] Rollback path in Vercel confirmed
- [x] Environment variable changes noted before deployment
- [x] Dependency upgrades were not combined with unrelated feature releases

| รายการ                       | รายละเอียด                                                |
| ---------------------------- | --------------------------------------------------------- |
| Last known good deployment   | Verified; exact deployment ID not recorded                |
| Rollback method              | Verified in Vercel; exact rollback target ID not recorded |
| Environment variable changes | Verified; exact values intentionally not recorded         |
| Dependency upgrade notes     | Verified; no dependency changes recorded in this report   |

## 13. Failed Checks

No failed checks. Mobile IntroGate image issue was resolved by setting the Google Drive file permission to public / anyone with the link can view.

## 14. Final Release Decision

- [x] Pass
- [ ] Pass with known issues
- [ ] Block release

**Decision rationale:**

- Local quality gate passed. Manual production smoke verification passed. The mobile IntroGate image issue was resolved by correcting the Google Drive file sharing permission, and production was re-tested successfully.

**Release approver:**

- Supharoek Sudadet
