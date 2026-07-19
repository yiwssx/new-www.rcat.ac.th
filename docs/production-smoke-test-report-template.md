# Production Smoke Test Report Template

ใช้เอกสารนี้บันทึกผลตรวจจริงหลัง Deploy โดยอ้างอิงจาก [Production Smoke Checklist](./production-smoke-checklist.md)

สถานะปัจจุบัน: ขอบเขต migration/runtime/domain cutover ของ M20 ปิดแล้ว และ M21 รับผิดชอบงาน stabilization เอกสารนี้บันทึกผล smoke test และไม่ใช่การอนุมัติให้แก้ไข production นอกขอบเขต

## 1. Deployment Information

| รายการ                        | รายละเอียด |
| ----------------------------- | ---------- |
| Deployment URL                |            |
| Vercel Deployment ID หรือ URL |            |
| Commit SHA                    |            |
| วันที่/เวลาที่ทดสอบ           |            |
| ผู้ทดสอบ                      |            |
| Browser/Device                |            |
| Environment                   | Production |
| หมายเหตุรอบ Deploy            |            |

## 2. Environment Variables Checked

| Environment variable / setting            | ตรวจแล้ว | ค่า/แหล่งอ้างอิง | หมายเหตุ                                   |
| ----------------------------------------- | -------- | ---------------- | ------------------------------------------ |
| Cloudflare public API provider/URL        | [ ]      |                  | Record only source label, not private URLs |
| Cloudflare admin proxy/provider settings  | [ ]      |                  | Record only source label, not secrets      |
| Apps Script media bridge server settings  | [ ]      |                  | Record only status, not bridge URL/token   |
| Public site URL                           | [ ]      |                  |                                            |
| Analytics strategy                        | [ ]      |                  |                                            |
| GTM ID                                    | [ ]      |                  |                                            |
| GA4 Measurement ID                        | [ ]      |                  |                                            |
| Vercel Analytics / Speed Insights setting | [ ]      |                  |                                            |
| อื่น ๆ                                    | [ ]      |                  |                                            |

## 3. Quality Command Results

| Command                 | Result                | Evidence / notes |
| ----------------------- | --------------------- | ---------------- |
| `pnpm format:check`     | Not run / Pass / Fail |                  |
| `pnpm lint`             | Not run / Pass / Fail |                  |
| `pnpm test:unit`        | Not run / Pass / Fail |                  |
| `pnpm test:integration` | Not run / Pass / Fail |                  |
| `pnpm build`            | Not run / Pass / Fail |                  |
| `pnpm quality`          | Not run / Pass / Fail |                  |

- [ ] ถ้า `pnpm quality` fail ได้แยก sub-command ที่ fail แล้วแก้ไขก่อนดำเนินการต่อ
- [ ] ไม่มี test หรือ quality failure ค้างอยู่ก่อนตัดสินใจ release

## 4. Public Homepage Result

**Overall result:** Not tested / Pass / Fail / Pass with known issues

- [ ] หน้าแรกโหลดสำเร็จ
- [ ] ไม่มี console error จากโค้ดของแอปเรา
- [ ] Route หน้าแรกใช้งานได้หลัง hard refresh
- [ ] First load performance ยังยอมรับได้
- [ ] Marquee speed readable on desktop/tablet/mobile
- [ ] Reduced-motion marquee still moves slowly

**Evidence / notes:**

-

## 5. Intro Gate Result

**Overall result:** Not tested / Pass / Fail / Pass with known issues

- [ ] Intro gate แสดงเมื่อเปิดใช้งานจาก settings
- [ ] Intro gate กดปิดหรือเข้าสู่เว็บไซต์ได้
- [ ] Intro gate ไม่ต้อง refresh หน้าเพื่อแสดงหลัง settings โหลดเสร็จ
- [ ] Intro gate ไม่แสดงเมื่อปิดใช้งาน

**Evidence / notes:**

-

## 6. Carousel Result

**Overall result:** Not tested / Pass / Fail / Pass with known issues

- [ ] Carousel แสดง image-only slides
- [ ] ไม่มี title/subtitle/CTA overlay บังรูป
- [ ] Controls ทำงานเมื่อมีหลาย slide
- [ ] Autoplay ทำงานเมื่อเปิดใช้งาน
- [ ] Autoplay ไม่ทำงานเมื่อปิดใช้งาน
- [ ] รูปแรกถูก prioritize ถูกต้องเมื่อมองเห็นทันที

**Evidence / notes:**

-

## 7. Public Content Detail Result

**Overall result:** Not tested / Pass / Fail / Pass with known issues

- [ ] News detail page โหลดสำเร็จ
- [ ] Announcement detail page โหลดสำเร็จ
- [ ] Metadata แสดง content type, publication status, วันที่ไทยแบบเต็ม, publisher, tags และ view count
- [ ] Sidebar เก่า `รายละเอียดเนื้อหา` ไม่แสดง
- [ ] Attached media แสดงผลได้
- [ ] Related content แสดงผลได้
- [ ] Back button ทำงาน
- [ ] Tags กดได้และ route ไปหน้ารายการที่ filter แล้ว

**Test URLs:**

| ประเภท              | URL | Result                   | Notes |
| ------------------- | --- | ------------------------ | ----- |
| News detail         |     | Not tested / Pass / Fail |       |
| Announcement detail |     | Not tested / Pass / Fail |       |

## 8. Facebook Embed/Fallback Result

**Overall result:** Not tested / Pass / Fail / Pass with known issues

- [ ] Valid Facebook permalink URL render iframe plugin
- [ ] iframe ใช้ `facebook.com/plugins/post.php`
- [ ] ลิงก์ `เปิดโพสต์บน Facebook` แสดงใต้ supported embed
- [ ] `/share/p` URL แสดง fallback แทน iframe
- [ ] `/watch` URL แสดง fallback แทน iframe
- [ ] `/reel` URL แสดง fallback แทน iframe
- [ ] ข้อความ `ไม่สามารถฝังโพสต์ Facebook นี้ได้โดยตรง` แสดงใน fallback
- [ ] Fallback link เปิด Facebook URL ต้นฉบับ
- [ ] ไม่มี `facebook-jssdk` script จากแอปเรา
- [ ] ไม่มี `.fb-post` div จากแอปเรา

**Test URLs / evidence:**

| กรณี                   | Public page URL | Facebook URL | Result                   | Notes |
| ---------------------- | --------------- | ------------ | ------------------------ | ----- |
| Supported permalink    |                 |              | Not tested / Pass / Fail |       |
| Unsupported `/share/p` |                 |              | Not tested / Pass / Fail |       |
| Unsupported `/watch`   |                 |              | Not tested / Pass / Fail |       |
| Unsupported `/reel`    |                 |              | Not tested / Pass / Fail |       |

## 9. Analytics / GTM / GA4 Result

**Overall result:** Not tested / Pass / Fail / Pass with known issues

- [ ] Public pages โหลด analytics ตาม configured strategy
- [ ] GTM โหลดเมื่อเปิด GTM strategy
- [ ] GA4 direct `gtag` โหลดเฉพาะเมื่อ strategy เป็น `gtag` หรือ `both`
- [ ] Login/admin routes ไม่ส่ง public analytics `page_view`
- [ ] ตรวจ public `page_view` ใน GTM/GA4 debug tools แล้ว ถ้ามีสิทธิ์เข้าถึง
- [ ] Vercel Analytics และ Speed Insights โหลดเฉพาะจุดที่คาดไว้

**Evidence / notes:**

-

## 10. Admin CMS Result

**Overall result:** Not tested / Pass / Fail / Pass with known issues

- [ ] Admin login works
- [ ] Content list loads
- [ ] Create content works
- [ ] Edit content works
- [ ] Publish/unpublish status works
- [ ] Media selection works
- [ ] Media upload/delete shows blocking loading and acknowledged success/error result
- [ ] Content save/publish/delete shows blocking loading and acknowledged success/error result
- [ ] Documents, Menu, Users, Calendar, Carousel, E-Service, and Settings use acknowledged result modals for writes
- [ ] Carousel slide management works
- [ ] Intro gate settings can be saved
- [ ] Facebook post content block accepts a valid permalink URL
- [ ] Unsupported Facebook URLs display fallback on the public page
- [ ] No unexpected Apps Script media bridge errors
- [ ] No browser-side direct Apps Script structured read/write observed

**Evidence / notes:**

-

## 11. Vercel Logs / Performance Result

**Overall result:** Not tested / Pass / Fail / Pass with known issues

- [ ] Vercel deployment succeeded
- [ ] Homepage route works
- [ ] Public content detail routes work
- [ ] Admin route works
- [ ] Browser hard refresh works
- [ ] No critical runtime errors in Vercel logs
- [ ] Speed Insights does not show obvious regression
- [ ] First load performance remains acceptable

**Evidence / notes:**

-

## 12. Rollback Readiness Result

**Overall result:** Not tested / Ready / Not ready / Ready with notes

- [ ] Last known good deployment identified
- [ ] Rollback path in Vercel confirmed
- [ ] Environment variable changes noted before deployment
- [ ] Dependency upgrades were not combined with unrelated feature releases

| รายการ                       | รายละเอียด |
| ---------------------------- | ---------- |
| Last known good deployment   |            |
| Rollback method              |            |
| Environment variable changes |            |
| Dependency upgrade notes     |            |

## 13. Failed Checks

| Section | Failed check | Impact | Owner | Action | Priority          | Target fix date | Status                                     |
| ------- | ------------ | ------ | ----- | ------ | ----------------- | --------------- | ------------------------------------------ |
|         |              |        |       |        | P0 / P1 / P2 / P3 |                 | Open / In progress / Fixed / Accepted risk |

## 14. Final Release Decision

เลือกผลลัพธ์สุดท้ายเพียงข้อเดียว

- [ ] Pass
- [ ] Pass with known issues
- [ ] Block release

**Decision rationale:**

- **Release approver:**

-
