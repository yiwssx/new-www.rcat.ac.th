from pathlib import Path

path = Path("src/admin/components/ContentBlockBuilder.test.tsx")
content = path.read_text(encoding="utf-8")
old = 'screen.getByRole("button", { name: "ลิงก์ / ไฟล์แนบ" })'
new = 'screen.getByRole("button", { name: "แนบลิงก์ภายนอกหรือไฟล์จากคลังสื่อ พร้อมกำหนดข้อความที่แสดง" })'
if old not in content:
    raise SystemExit("attachment link button selector marker not found")
path.write_text(content.replace(old, new, 1), encoding="utf-8")
