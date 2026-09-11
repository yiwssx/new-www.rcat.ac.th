# Production Smoke Checklist

Updated: 2026-09-11.

ใช้เช็กลิสต์นี้หลัง Deploy ทุกครั้ง เพื่อยืนยันว่าเว็บไซต์สาธารณะและ CMS ยังทำงานได้ครบตามจุดเสี่ยงหลักก่อนประกาศใช้งานจริง

สถานะโครงการปัจจุบันให้อ้างอิง `docs/architecture/post-p5h-current-project-state.md` โดย M20/M21 เป็นประวัติ migration/stabilization ไม่ใช่เฟส active ปัจจุบัน Reliability Roadmap v2 เสร็จครบแล้ว: Phase 0, Phase A, Phase B (B1/B2/B3) และ Phase C เป็น complete เช็กลิสต์นี้ใช้ตรวจ release candidate และไม่ใช่การอนุมัติให้แก้ไข production นอกขอบเขต

## 1. Quality Gate ก่อน Deploy

- [ ] รัน `pnpm format:check` และต้องผ่าน
- [ ] รัน `pnpm lint:strict` และต้องผ่าน
- [ ] รัน `pnpm test:unit` และต้องผ่าน
- [ ] รัน `pnpm test:integration` และต้องผ่าน
- [ ] รัน `pnpm build` และต้องผ่าน
- [ ] รัน `pnpm quality` และต้องผ่าน
- [ ] ถ้า `pnpm quality` ไม่ผ่าน ให้แยก sub-command ที่ล้มเหลวออกมารันซ้ำ แก้ปัญหานั้นให้จบ แล้วค่อยดำเนินการ Deploy ต่อ

## 2. Public Homepage / Public Route Smoke Checks

- [ ] หน้าแรกโหลดสำเร็จและไม่มีหน้าขาวหรือ error boundary
- [ ] `/documents` โหลดสำเร็จบน desktop/mobile
- [ ] `/search?q=...` โหลดสำเร็จและใช้ Worker/D1-backed search contract
- [ ] ไม่มี console error ที่เกิดจากโค้ดของแอปเรา
- [ ] Intro gate แสดงเมื่อเปิดใช้งานจาก settings
- [ ] Intro gate สามารถกดปิดหรือเข้าสู่เว็บไซต์ได้
- [ ] Intro gate แสดงผลหลัง settings โหลดเสร็จโดยไม่ต้อง refresh หน้า
- [ ] Intro gate image URL ไม่ใช่ direct Facebook CDN URL (`fbcdn.net` หรือ `scontent...fbcdn.net`); ใช้ไฟล์ static เช่น `/intro/intro-gate-2026.webp`, site media/storage, Google Drive file ที่เปิด Anyone with the link, หรือ owned CDN/storage URL
- [ ] Carousel แสดงเป็น slideshow รูปภาพอย่างเดียว
- [ ] Carousel ไม่มี title, subtitle หรือ CTA overlay บังรูปภาพ
- [ ] ปุ่มควบคุม Carousel ทำงานเมื่อมีหลาย slide
- [ ] Carousel autoplay ทำงานเมื่อเปิดใช้งาน
- [ ] Carousel ไม่ autoplay เมื่อปิดใช้งาน
- [ ] รูปแรกของ Carousel ถูก prioritize ถูกต้องเมื่อเป็นรูปที่มองเห็นทันทีบนหน้า
- [ ] Marquee เริ่มจากด้านขวานอกพื้นที่ที่มองเห็นและเลื่อนไปซ้ายอย่างสม่ำเสมอบน desktop/tablet/mobile
- [ ] Marquee ใน reduced-motion ยังเลื่อนช้าลง ไม่หยุดนิ่ง

## 3. Public Content Detail Smoke Checks

- [ ] หน้ารายละเอียดข่าวโหลดสำเร็จ
- [ ] หน้ารายละเอียดประกาศโหลดสำเร็จ
- [ ] Dynamic canonical `/content/:slug` ตอบ `Cache-Control: no-store` และไม่มี shared Vercel CDN cache directive
- [ ] Metadata แสดงประเภทเนื้อหา
- [ ] Metadata แสดงสถานะการเผยแพร่
- [ ] Metadata แสดงวันที่ภาษาไทยแบบเต็ม เช่น `14 พฤษภาคม 2569`
- [ ] Metadata แสดงผู้เผยแพร่
- [ ] Metadata แสดง tags
- [ ] Metadata แสดงจำนวน views
- [ ] Sidebar เก่า `รายละเอียดเนื้อหา` ไม่แสดงแล้ว
- [ ] สื่อที่แนบมากับเนื้อหาแสดงผลได้
- [ ] Related content แสดงผลได้
- [ ] ปุ่มย้อนกลับทำงานถูกต้อง
- [ ] Tags กดได้และพาไปยังหน้ารายการที่ filter ตาม tag นั้น

## 4. Facebook Embed Smoke Checks

- [ ] Facebook permalink URL ที่รองรับแสดง iframe plugin ได้
- [ ] iframe ใช้ URL จาก `facebook.com/plugins/post.php`
- [ ] ลิงก์ fallback `เปิดโพสต์บน Facebook` แสดงอยู่ใต้ embed ที่รองรับ
- [ ] URL รูปแบบ `/share/p` แสดง fallback แทน iframe
- [ ] URL รูปแบบ `/watch` แสดง fallback แทน iframe
- [ ] URL รูปแบบ `/reel` แสดง fallback แทน iframe
- [ ] ข้อความ fallback แสดงว่า `ไม่สามารถฝังโพสต์ Facebook นี้ได้โดยตรง`
- [ ] ลิงก์ fallback เปิด Facebook URL ต้นฉบับ
- [ ] แอปเราไม่ได้ inject script `facebook-jssdk`
- [ ] ไม่มี `.fb-post` div ถูก render โดยแอปเรา

## 5. Analytics / Runtime Incident Smoke Checks

- [ ] Public pages โหลด analytics ตาม strategy ที่ตั้งค่าไว้
- [ ] GTM โหลดเมื่อเปิด strategy แบบ GTM
- [ ] GA4 direct `gtag` โหลดเฉพาะเมื่อ strategy เป็น `gtag` หรือ `both`
- [ ] หน้า login และ admin routes ไม่ส่ง public analytics `page_view`
- [ ] ตรวจ public `page_view` ใน GTM หรือ GA4 debug tools ถ้ามีสิทธิ์เข้าถึง
- [ ] ตรวจว่า Vercel Analytics และ Speed Insights โหลดเฉพาะจุดที่คาดไว้
- [ ] Visitor stats / Who's Online อ่านค่าจาก Cloudflare analytics path และไม่ใช้ browser-side direct Apps Script structured write
- [ ] ถ้ามี runtime incident ที่ตั้งใจทดสอบ ให้ยืนยันว่า B2 เก็บเฉพาะ privacy-safe allowlisted fields และไม่เก็บ message/stack/token/body/query string

## 6. Admin CMS / System Health Smoke Checks

- [ ] เข้าสู่ระบบ admin ได้
- [ ] `/admin/system-health` เปิดได้ตาม `dashboard.read` capability
- [ ] B1 live health checks ทำงานเมื่อกด refresh
- [ ] B2 Runtime Incident Feed แสดง bounded operator feed ตามสิทธิ์
- [ ] B3 Health Aggregation แสดง Phase A/P6A/P6B/P6C/deployment/B2 summary ผ่าน server-owned boundary โดยไม่มี infrastructure credential ใน browser
- [ ] รายการ content โหลดสำเร็จ
- [ ] สร้าง content ใหม่ได้
- [ ] แก้ไข content เดิมได้
- [ ] เปลี่ยนสถานะ publish/unpublish ได้
- [ ] เลือก media จาก CMS ได้
- [ ] Media upload/delete แสดง loading modal และ success/error modal ที่ต้องกดรับทราบ
- [ ] Content save/publish/delete แสดง loading modal และ success/error modal ที่ต้องกดรับทราบ
- [ ] Documents, Menu, Users, Calendar, Carousel, E-Service, และ Settings ใช้รูปแบบ feedback เดียวกัน
- [ ] `/admin/documents` จัดการ metadata และสถานะ draft/published ได้ตามสิทธิ์
- [ ] จัดการ Carousel slides ได้
- [ ] บันทึก Intro gate settings ได้
- [ ] Facebook post content block รับ permalink URL ที่รองรับได้
- [ ] Facebook URL ที่ไม่รองรับแสดง fallback บนหน้าสาธารณะ
- [ ] ไม่มี Apps Script media bridge error ที่ไม่คาดคิด
- [ ] ไม่มีการเรียก browser-side direct Apps Script structured read/write

## 7. Vercel Deployment Checks

- [ ] Deployment บน Vercel สำเร็จเมื่อ diff มี Vercel-owned runtime change
- [ ] Route หน้าแรกเปิดได้บน production URL
- [ ] `/documents` และ Search เปิดได้บน production URL
- [ ] Public content detail routes เปิดได้บน production URL
- [ ] Admin route เปิดได้บน production URL
- [ ] Browser hard refresh แล้วยังโหลด route เดิมได้ถูกต้อง
- [ ] ไม่มี critical runtime errors ใน Vercel logs
- [ ] Speed Insights ไม่แสดง regression ที่ชัดเจน
- [ ] First load performance ยังอยู่ในระดับที่ยอมรับได้สำหรับผู้ใช้จริง

หมายเหตุ: Phase A automation ใช้ GitHub `Vercel` commit-status context เป็น gate ก่อนยิง production browser smoke ปัจจุบัน status `success` อาจเกิดกับ `Canceled by Ignored Build Step` ได้ จึงไม่ควรใช้ Phase A status อย่างเดียวเป็นหลักฐานว่า production กำลัง serve exact SHA หาก release นั้นต้องการ exact-deployment proof ให้ตรวจ deployment record เพิ่มเติมตามขอบเขตงานนั้น

## 8. Rollback Readiness

- [ ] ระบุ last known good deployment ก่อน Deploy รอบใหม่
- [ ] ยืนยัน rollback path ใน Vercel ว่าสามารถ redeploy หรือ promote deployment เดิมได้
- [ ] จด environment variable changes ก่อน Deploy
- [ ] หลีกเลี่ยงการรวม dependency upgrades กับ feature releases ใน Deploy เดียวกัน

## 9. Release Sign-off

- [ ] ผู้ตรวจ QA ระบุ production URL ที่ตรวจแล้ว
- [ ] ผู้ตรวจ QA ระบุวันที่และเวลาที่ตรวจ
- [ ] ผู้ตรวจ QA บันทึก browser/device หลักที่ใช้ตรวจ
- [ ] ทุกข้อที่ไม่ผ่านมี owner และแนวทางแก้ไขก่อนเปิดใช้งานจริง
