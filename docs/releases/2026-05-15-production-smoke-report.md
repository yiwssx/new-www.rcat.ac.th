# Production Smoke Test Report: 2026-05-15

รายงานนี้บันทึกผล smoke test สำหรับ deployment ปัจจุบัน โดยอ้างอิงจาก [Production Smoke Checklist](../production-smoke-checklist.md) และ [Production Smoke Test Report Template](../production-smoke-test-report-template.md)

> Manual verification required: มี live deployment URL แล้ว แต่ยังไม่มีหลักฐาน manual production smoke verification สำหรับรอบนี้ ดังนั้นการตรวจที่ต้องใช้ production browser, Vercel dashboard, GTM/GA4 debug tools, admin credentials หรือ Apps Script production writes ถูกบันทึกเป็น `Not tested`

## 1. Deployment Information

| รายการ                        | รายละเอียด                                                                          |
| ----------------------------- | ----------------------------------------------------------------------------------- |
| Deployment URL                | https://new-wwwrcatacth.vercel.app/                                                 |
| Vercel Deployment ID หรือ URL |                                                                                     |
| Commit SHA                    | `a4da2a27e4946124d1ed52ba4857abad5c9ac5bd`                                          |
| วันที่/เวลาที่ทดสอบ           | 2026-05-15, local repository verification                                           |
| ผู้ทดสอบ                      | Codex QA/frontend release engineer                                                  |
| Browser/Device                | Not tested                                                                          |
| Environment                   | Production                                                                          |
| หมายเหตุรอบ Deploy            | Live deployment URL provided; manual production smoke verification is still pending |

## 2. Environment Variables Checked

**Overall result:** Not tested

Manual verification required: ต้องตรวจค่าจริงใน Vercel project settings และยืนยันว่า production deployment ใช้ค่าที่ถูกต้อง

| Environment variable / setting            | Result     | ค่า/แหล่งอ้างอิง | หมายเหตุ                          |
| ----------------------------------------- | ---------- | ---------------- | --------------------------------- |
| Google Apps Script URL                    | Not tested |                  | ต้องตรวจใน Vercel dashboard       |
| Public site URL                           | Not tested |                  | ต้องตรวจใน Vercel dashboard       |
| Analytics strategy                        | Not tested |                  | ต้องตรวจ strategy ที่ deploy จริง |
| GTM ID                                    | Not tested |                  | ต้องตรวจใน Vercel dashboard       |
| GA4 Measurement ID                        | Not tested |                  | ต้องตรวจใน Vercel dashboard       |
| Vercel Analytics / Speed Insights setting | Not tested |                  | ต้องตรวจใน Vercel dashboard       |
| อื่น ๆ                                    | Not tested |                  | ระบุเพิ่มเติมเมื่อมีข้อมูลจริง    |

## 3. Quality Command Results

| Command                 | Result | Evidence / notes                          |
| ----------------------- | ------ | ----------------------------------------- |
| `pnpm format:check`     | Pass   | Full local quality gate passed            |
| `pnpm lint`             | Pass   | Full local quality gate passed            |
| `pnpm test:unit`        | Pass   | Full local quality gate passed            |
| `pnpm test:integration` | Pass   | Full local quality gate passed            |
| `pnpm build`            | Pass   | Full local quality gate passed            |
| `pnpm quality`          | Pass   | Full local quality gate passed end-to-end |

- [ ] Manual verification required before release sign-off.

## 4. Public Homepage

**Overall result:** Not tested

Manual verification required: ต้องเปิด production homepage URL ใน browser จริงก่อนสรุปผล

- [ ] Homepage loads successfully: Not tested
- [ ] No app-owned console errors: Not tested
- [ ] Route works after browser hard refresh: Not tested
- [ ] First load performance remains acceptable: Not tested

**Evidence / notes:**

- No deployment URL provided, so homepage smoke checks were not executed.

## 5. Intro Gate

**Overall result:** Not tested

Manual verification required: ต้องตรวจด้วย production settings ทั้งกรณีเปิดและปิด Intro gate

- [ ] Intro gate appears when enabled: Not tested
- [ ] Intro gate can be dismissed: Not tested
- [ ] Intro gate does not require page refresh after settings load: Not tested
- [ ] Intro gate remains hidden when disabled: Not tested

**Evidence / notes:**

- Unit coverage exists in the repo, but no production browser verification was performed for this report.

## 6. Carousel

**Overall result:** Not tested

Manual verification required: ต้องตรวจ production homepage กับข้อมูล carousel จริงจาก CMS

- [ ] Carousel renders image-only slides: Not tested
- [ ] No title/subtitle/CTA overlay blocks images: Not tested
- [ ] Controls work when multiple slides exist: Not tested
- [ ] Autoplay works when enabled: Not tested
- [ ] Carousel does not autoplay when disabled: Not tested
- [ ] First carousel image is prioritized correctly if visible: Not tested

**Evidence / notes:**

- Unit coverage exists in the repo, but no production browser verification was performed for this report.

## 7. Public Content Detail

**Overall result:** Not tested

Manual verification required: ต้องใช้ production content URLs จริงสำหรับข่าวและประกาศ

- [ ] News detail page loads: Not tested
- [ ] Announcement detail page loads: Not tested
- [ ] Metadata displays content type, publication status, full Thai date, publisher, tags, and view count: Not tested
- [ ] Old `รายละเอียดเนื้อหา` sidebar is not shown: Not tested
- [ ] Attached media renders: Not tested
- [ ] Related content renders: Not tested
- [ ] Back button works: Not tested
- [ ] Tags are clickable and route to filtered listing pages: Not tested

| ประเภท              | URL | Result     | Notes                       |
| ------------------- | --- | ---------- | --------------------------- |
| News detail         |     | Not tested | ต้องใส่ production URL จริง |
| Announcement detail |     | Not tested | ต้องใส่ production URL จริง |

## 8. Facebook Embed/Fallback

**Overall result:** Not tested

Manual verification required: ต้องใช้ production page ที่มี Facebook content block จริงและตรวจ DOM/network ใน browser

- [ ] Valid Facebook permalink URL renders iframe plugin: Not tested
- [ ] iframe uses `facebook.com/plugins/post.php`: Not tested
- [ ] Fallback link `เปิดโพสต์บน Facebook` is visible under supported embeds: Not tested
- [ ] `/share/p` URLs show fallback instead of iframe: Not tested
- [ ] `/watch` URLs show fallback instead of iframe: Not tested
- [ ] `/reel` URLs show fallback instead of iframe: Not tested
- [ ] Fallback text appears: `ไม่สามารถฝังโพสต์ Facebook นี้ได้โดยตรง`: Not tested
- [ ] Fallback link opens the original Facebook URL: Not tested
- [ ] No `facebook-jssdk` script is injected by our app: Not tested
- [ ] No `.fb-post` div is rendered: Not tested

| กรณี                   | Public page URL | Facebook URL | Result     | Notes                       |
| ---------------------- | --------------- | ------------ | ---------- | --------------------------- |
| Supported permalink    |                 |              | Not tested | ต้องใส่ production URL จริง |
| Unsupported `/share/p` |                 |              | Not tested | ต้องใส่ production URL จริง |
| Unsupported `/watch`   |                 |              | Not tested | ต้องใส่ production URL จริง |
| Unsupported `/reel`    |                 |              | Not tested | ต้องใส่ production URL จริง |

## 9. Analytics / GTM / GA4

**Overall result:** Not tested

Manual verification required: ต้องตรวจ production page, network requests, GTM preview หรือ GA4 debug tools ตามสิทธิ์ที่มี

- [ ] Public pages load analytics according to configured strategy: Not tested
- [ ] GTM loads when GTM strategy is enabled: Not tested
- [ ] GA4 direct `gtag` loads only when strategy is `gtag` or `both`: Not tested
- [ ] Login/admin routes do not send public analytics `page_view`: Not tested
- [ ] Public `page_view` verified in GTM/GA4 debug tools if available: Not tested
- [ ] Vercel Analytics and Speed Insights load only where expected: Not tested

**Evidence / notes:**

- No production URL or analytics debug access was provided.

## 10. Admin CMS

**Overall result:** Not tested

Manual verification required: ต้องใช้ production admin URL และบัญชีทดสอบที่มีสิทธิ์เหมาะสม

- [ ] Admin login works: Not tested
- [ ] Content list loads: Not tested
- [ ] Create content works: Not tested
- [ ] Edit content works: Not tested
- [ ] Publish/unpublish status works: Not tested
- [ ] Media selection works: Not tested
- [ ] Carousel slide management works: Not tested
- [ ] Intro gate settings can be saved: Not tested
- [ ] Facebook post content block accepts a valid permalink URL: Not tested
- [ ] Unsupported Facebook URLs display fallback on the public page: Not tested
- [ ] No unexpected Apps Script write errors: Not tested

**Evidence / notes:**

- No production admin credentials or live deployment URL were provided.

## 11. Vercel Logs / Performance

**Overall result:** Not tested

Manual verification required: ต้องตรวจ Vercel deployment status, logs, Speed Insights และ production route behavior ใน dashboard/browser

- [ ] Deployment succeeds: Not tested
- [ ] Homepage route works: Not tested
- [ ] Public content detail routes work: Not tested
- [ ] Admin route works: Not tested
- [ ] Browser hard refresh works: Not tested
- [ ] No critical runtime errors in Vercel logs: Not tested
- [ ] Speed Insights does not show obvious regression: Not tested
- [ ] First load performance remains acceptable: Not tested

**Evidence / notes:**

- No Vercel deployment ID or URL was provided.

## 12. Rollback Readiness

**Overall result:** Not tested

Manual verification required: ต้องระบุ last known good deployment และยืนยัน rollback path ใน Vercel ก่อน release

- [ ] Last known good deployment identified: Not tested
- [ ] Rollback path in Vercel confirmed: Not tested
- [ ] Environment variable changes noted before deployment: Not tested
- [ ] Dependency upgrades were not combined with unrelated feature releases: Not tested

| รายการ                       | รายละเอียด |
| ---------------------------- | ---------- |
| Last known good deployment   |            |
| Rollback method              |            |
| Environment variable changes |            |
| Dependency upgrade notes     |            |

## 13. Failed Checks

No failed production smoke checks were observed because production smoke checks were not executed. Untested items must be verified manually before release approval.

| Section | Failed check | Impact | Owner | Action | Priority          | Target fix date | Status                                     |
| ------- | ------------ | ------ | ----- | ------ | ----------------- | --------------- | ------------------------------------------ |
|         |              |        |       |        | P0 / P1 / P2 / P3 |                 | Open / In progress / Fixed / Accepted risk |

## 14. Final Release Decision

- [ ] Pass
- [ ] Pass with known issues
- [x] Block release

**Decision rationale:**

- Local quality gate passed, but release remains blocked until manual production smoke verification is completed against a real deployment URL.

**Release approver:**

-
