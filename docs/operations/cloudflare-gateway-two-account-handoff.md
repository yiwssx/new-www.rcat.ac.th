# คู่มือส่งมอบ Gateway ระหว่าง Cloudflare 2 บัญชี — RCAT

อ้างอิง Issue #760 — 29 ตุลาคม 2569

**ข้อห้าม:** ห้ามโอนโดเมน .ac.th, เปลี่ยน Nameserver, เปิดใช้งาน Pending Zone ที่ไม่ใช่ของผู้ดูแลเดิม หรือแก้ DNS Production โดยพลการ

## ความรับผิดชอบ

| ฝ่าย | Cloudflare Account | หน้าที่ |
| --- | --- | --- |
| วิทยาลัย | rcat-digital | ดูแล Public Standby, Public API Worker, D1 และภาพ |
| ผู้ดูแลโดเมนเดิม | Active Zone rcat.ac.th, NS maria/kirk | ติดตั้ง Gateway Worker ในบัญชีเดิม, เพิ่ม Test Route และ Production Route หลังผ่านการทดสอบ |
| วิทยาลัย (Vercel) | rcat-it-dev-team | ดูแล Primary SSR, CMS/Admin และ API ที่ใช้ Vercel |

**เว็บไซต์สำรอง:** https://rcat-web-standby.rcat-digital.workers.dev/

Gateway เรียกเว็บไซต์สำรองข้ามบัญชีผ่าน HTTPS เท่านั้น ไม่ต้องย้าย D1, ใช้ Service Binding ข้ามบัญชี, ส่ง Credentials หรือเปลี่ยนโดเมน .ac.th

## สิ่งที่ฝั่งวิทยาลัยส่งให้ผู้ดูแลโดเมน

1. `cloudflare/web-failover/gateway-worker.mjs` — Gateway อิสระ ไม่พึ่ง D1, ASSETS หรือ Service Binding
2. `cloudflare/web-failover/gateway-wrangler.toml` — Production config ไม่ใส่ Routes
3. `cloudflare/web-failover/gateway-test-wrangler.toml` — Test-only config สำหรับ `failover-test.rcat.ac.th`
4. `cloudflare/web-failover/gateway.node-check.mjs` — Unit Tests ครอบคลุม Vercel 200/503, API public GET, Auth, Cookies และการกลับมาเป็นปกติ
5. เอกสารฉบับนี้ในโครงการ GitHub

Standby เป็น CSR แบบอ่านข้อมูลเท่านั้น ไม่รองรับ Admin Login, CMS Write, Upload หรือระบบร้องเรียนในช่วง Vercel ล่ม ไม่รับประกัน SEO SSR เท่ากับ Vercel

## ขั้นตอนผู้ดูแลโดเมน (Cloudflare Account เดิม)

### 1. ตรวจสอบก่อน

- Login เข้าบัญชีที่มี Active Zone `rcat.ac.th` และ Nameservers `maria.ns.cloudflare.com` / `kirk.ns.cloudflare.com`
- ตรวจสอบ DNS ของ `www.rcat.ac.th` เป็น Proxied (เมฆสีส้ม) และยังชี้ไป Vercel Origin ที่ถูกต้อง
- ตรวจสอบ Vercel Domain `www.rcat.ac.th` มีสถานะ Verified และ TLS ใช้งานได้
- ตรวจสอบสิทธิ์ Workers Scripts และ Workers Routes
- หากบัญชีนี้มีนโยบาย Access “All Workers” ต้องพิจารณา Bypass เฉพาะ Gateway ที่เปิดสาธารณะ ไม่ปิดการป้องกันทั้งบัญชี

### 2. ติดตั้ง Test Gateway ก่อน (ไม่แตะ www)

ดาวน์โหลด Code จาก repo หลักแล้วใช้ Wrangler **ภายใน Cloudflare Account ของผู้ดูแลโดเมน**:

~~~bash
git clone https://github.com/yiwssx/new-www.rcat.ac.th.git
cd new-www.rcat.ac.th
corepack enable
pnpm install --frozen-lockfile
pnpm exec wrangler whoami

# ไม่เพิ่ม DNS หรือ Route อัตโนมัติ
pnpm exec wrangler deploy --config cloudflare/web-failover/gateway-test-wrangler.toml
~~~

ในการทดสอบ passthrough Vercel ต้องเพิ่ม `failover-test.rcat.ac.th` เป็น Custom Domain ใน Vercel Project ให้ Verified ก่อน และให้ผู้ดูแลเดิมเพิ่ม DNS ของ Hostname **ทดสอบเท่านั้น** ไปยัง Origin ที่ Vercel ระบุ (Proxy เมฆสีส้ม) หลังอนุมัติ อย่าเดา Vercel IP หรือ CNAME

จากนั้นผู้ดูแลเข้า **Workers & Pages → rcat-web-gateway-test → Settings → Domains & Routes → Add → Route**:

- Zone: `rcat.ac.th`
- Pattern: `failover-test.rcat.ac.th/*`
- Worker: `rcat-web-gateway-test`

ค่า `TEST_SIMULATE_503 = "true"` ทำให้ Gateway จำลองว่า Vercel 503 **เฉพาะ Hostname ทดสอบ** ให้ตรวจ:

- GET `/news` ตอบ 200 จาก Standby มี Header `X-RCAT-Failover: primary-simulated-503`
- GET `/api/public/home` ตอบ JSON ไม่ใช่ HTML/Login
- JS/CSS Asset ที่อ้างถึงโหลดได้จริง
- GET `/admin`, `/login`, API Auth และ POST/PUT/PATCH/DELETE ไม่ถูก Forward เข้า Standby
- HTTPS, SSL, Redirect, Cache, Header และหน้าเว็บไซต์ใน Browser ทำงานถูกต้อง

**ทดสอบกลับไป Vercel:** เปลี่ยนค่า `TEST_SIMULATE_503` เป็น `"false"` ใน Test Wrangler Config แล้ว Deploy ทดสอบซ้ำ บน Test Hostname `/news` ต้องได้ Response จาก Vercel และไม่มี `X-RCAT-Failover` (ต้องมี Vercel Custom Domain ที่ใช้งานได้จริง) แล้วบันทึกผลและ Rollback Test Route ตามความเหมาะสม

### 3. เปิด Production เมื่อทดสอบผ่านและได้รับอนุมัติเท่านั้น

ผู้ดูแลโดเมน Deploy Gateway จริงในบัญชีเดิม:

~~~bash
pnpm exec wrangler deploy --config cloudflare/web-failover/gateway-wrangler.toml
~~~

คำสั่ง Deploy จะ **ไม่แก้ DNS หรือเพิ่ม Route อัตโนมัติ**. เมื่อผ่าน Change Approval แล้วจึงเข้า **Workers & Pages → rcat-web-gateway → Settings → Domains & Routes → Add → Route**:

- Zone: `rcat.ac.th`
- Pattern: `www.rcat.ac.th/*`
- Worker: `rcat-web-gateway`

**ใช้ Worker Route ไม่ใช้ Custom Domain** ที่อาจทับ CNAME Vercel เดิม. ทดสอบ Production GET 200, Admin Login, SSR Metadata, API, Cookies, SSL และ Canonical URL หลังเพิ่ม Route ทันที หลีกเลี่ยงการจำลองเหตุขัดข้องบน www จริง

### 4. Rollback ฉุกเฉิน

หากเกิดปัญหากับ www ให้ผู้ดูแลโดเมนเข้า Active Zone เดิม ลบเฉพาะ **Worker Route `www.rcat.ac.th/*`** ที่ชี้ไป `rcat-web-gateway`; **ไม่ลบ DNS**. จากนั้นตรวจ SSR Vercel และ Admin กลับมาทำงานตามเดิม

## พฤติกรรม Gateway

- Vercel ตอบ 200/301/302/401/403/404 → ส่งต่อคำตอบเดิม
- Vercel ตอบ 502/503/504 หรือ Network Error บน Public GET/HEAD → HTTPS ไป Cloudflare Standby
- `GET /api/public/*` ที่ Vercel ล่ม → Gateway ไป Standby Public API JSON ทาง HTTPS โดยไม่มี Auth/Cookie
- Auth, Login, CMS Admin, Sitemap, และคำขอเขียนข้อมูล → ไม่ Failover; ไม่ replay POST
- ถ้า Backup ตอบ Redirect ไป Cloudflare Access Login, HTML ปลอม JSON หรือ 5xx → Gateway ตอบ 503 ไม่แสดงเป็น 200
- HTML ที่ได้จาก Standby มี `noindex` และ `Cache-Control: no-store` เพราะเป็น CSR ไม่ใช่ SSR
- เมื่อ Vercel กลับมา 200 → Gateway ส่งให้ Vercel โดยอัตโนมัติ (ไม่ต้องแก้ DNS)
- ตัว Gateway มีต้นทุน Workers Requests เพิ่มขึ้น และไม่ได้ป้องกันเหตุ Cloudflare/D1 ขัดข้องร่วมกัน
- `workers.dev` ของ Gateway เป็น Preview ที่ไม่ได้ผูก Route; เปิด Health Endpoint ได้ แต่ไม่ใช่การพิสูจน์ Failover จริง

## เกณฑ์ปิด Issue #760

ต้องมีผลผ่าน: (1) Unit Test/Dry-run, (2) Standby Live Smoke, (3) Test Route 503 → HTML และ Public API JSON, (4) Test Route Restore → Vercel 200, (5) Auth/Write ไม่ถูกส่งไป Standby, (6) ผู้ดูแลอนุมัติ www Route, (7) ตรวจ Production และ Rollback

**ห้ามปิด Issue ก่อนครบทั้ง 7 ข้อ**. การเพิ่ม Route ใน Zone ผู้ดูแลเดิมคือสิทธิ์และหน้าที่ของผู้ดูแลโดเมน ไม่ใช่งานที่บัญชี rcat-digital จะทำแทน
