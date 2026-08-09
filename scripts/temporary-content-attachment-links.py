from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file_path = Path(path)
    content = file_path.read_text(encoding="utf-8")
    if old not in content:
        raise SystemExit(f"marker not found in {path}: {old[:120]!r}")
    file_path.write_text(content.replace(old, new, 1), encoding="utf-8")


# src/utils/contentBlocks.ts
path = "src/utils/contentBlocks.ts"
replace_once(
    path,
    'export type ContentBlockType =\n  "paragraph" | "heading" | "quote" | "checklist" | "image" | "video" | "pdf" | "facebookPost" | "button" | "divider";',
    'export type ContentBlockType =\n  | "paragraph"\n  | "heading"\n  | "quote"\n  | "checklist"\n  | "image"\n  | "video"\n  | "pdf"\n  | "facebookPost"\n  | "link"\n  | "button"\n  | "divider";'
)
replace_once(
    path,
    'export interface ButtonContentBlock extends ContentBlockBase {\n  type: "button";\n  label: string;\n  href: string;\n  variant: "contained" | "outlined";\n}',
    'export type LinkContentSource = "external" | "media";\n\nexport interface LinkContentBlock extends ContentBlockBase {\n  type: "link";\n  source: LinkContentSource;\n  label: string;\n  href: string;\n  mediaId: string;\n}\n\nexport interface ButtonContentBlock extends ContentBlockBase {\n  type: "button";\n  label: string;\n  href: string;\n  variant: "contained" | "outlined";\n}'
)
replace_once(
    path,
    '  | FacebookPostContentBlock\n  | ButtonContentBlock\n  | DividerContentBlock;',
    '  | FacebookPostContentBlock\n  | LinkContentBlock\n  | ButtonContentBlock\n  | DividerContentBlock;'
)
replace_once(
    path,
    '    value === "facebookPost" ||\n    value === "button" ||',
    '    value === "facebookPost" ||\n    value === "link" ||\n    value === "button" ||'
)
replace_once(
    path,
    '  if (type === "button") {\n    return { id, type, label: "", href: "", variant: "contained" };\n  }',
    '  if (type === "link") {\n    return { id, type, source: "external", label: "", href: "", mediaId: "" };\n  }\n\n  if (type === "button") {\n    return { id, type, label: "", href: "", variant: "contained" };\n  }'
)
replace_once(
    path,
    '  if (type === "button") {\n    const variant = value.variant === "outlined" ? "outlined" : "contained";\n    return {\n      id,\n      type,\n      label: normalizeString(value.label),\n      href: normalizeString(value.href),\n      variant\n    };\n  }',
    '  if (type === "link") {\n    return {\n      id,\n      type,\n      source: value.source === "media" ? "media" : "external",\n      label: normalizeString(value.label),\n      href: normalizeString(value.href).trim(),\n      mediaId: normalizeString(value.mediaId).trim()\n    };\n  }\n\n  if (type === "button") {\n    const variant = value.variant === "outlined" ? "outlined" : "contained";\n    return {\n      id,\n      type,\n      label: normalizeString(value.label),\n      href: normalizeString(value.href),\n      variant\n    };\n  }'
)
replace_once(
    path,
    '  if (block.type === "button") {\n    return Boolean(block.label.trim() && block.href.trim());\n  }',
    '  if (block.type === "link") {\n    return block.source === "media" ? Boolean(block.mediaId) : Boolean(block.href.trim());\n  }\n\n  if (block.type === "button") {\n    return Boolean(block.label.trim() && block.href.trim());\n  }'
)
replace_once(
    path,
    'export function extractMediaIdsFromContentBlocks(blocks: ContentBlock[]) {\n  const ids = blocks\n    .filter(\n      (block): block is MediaContentBlock => block.type === "image" || block.type === "video" || block.type === "pdf"\n    )\n    .map((block) => block.mediaId)\n    .filter(Boolean);\n\n  return Array.from(new Set(ids));\n}',
    'export function extractMediaIdsFromContentBlocks(blocks: ContentBlock[]) {\n  const ids = blocks\n    .flatMap((block) => {\n      if (block.type === "image" || block.type === "video" || block.type === "pdf") {\n        return [block.mediaId];\n      }\n\n      if (block.type === "link" && block.source === "media") {\n        return [block.mediaId];\n      }\n\n      return [];\n    })\n    .filter(Boolean);\n\n  return Array.from(new Set(ids));\n}'
)

# src/admin/components/ContentBlockBuilder.tsx
path = "src/admin/components/ContentBlockBuilder.tsx"
replace_once(
    path,
    '  { type: "facebookPost", label: "โพสต์ Facebook", helper: "ฝังโพสต์ Facebook แบบ public" },\n  { type: "button", label: "ปุ่ม", helper: "ลิงก์เรียกให้ดำเนินการ" },',
    '  { type: "facebookPost", label: "โพสต์ Facebook", helper: "ฝังโพสต์ Facebook แบบ public" },\n  {\n    type: "link",\n    label: "ลิงก์ / ไฟล์แนบ",\n    helper: "แนบลิงก์ภายนอกหรือไฟล์จากคลังสื่อ พร้อมกำหนดข้อความที่แสดง"\n  },\n  { type: "button", label: "ปุ่ม", helper: "ลิงก์เรียกให้ดำเนินการ" },'
)
marker = '''                  {block.type === "button" && (\n                    <Fragment>'''
insert = '''                  {block.type === "link" && (\n                    <Fragment>\n                      <TextField\n                        label="แหล่งลิงก์"\n                        select\n                        value={block.source}\n                        onChange={(event) =>\n                          updateBlock(block.id, (current) => {\n                            if (current.type !== "link") {\n                              return current;\n                            }\n\n                            return event.target.value === "media"\n                              ? { ...current, source: "media", href: "" }\n                              : { ...current, source: "external", mediaId: "" };\n                          })\n                        }\n                        fullWidth\n                      >\n                        <MenuItem value="external">ลิงก์ภายนอก</MenuItem>\n                        <MenuItem value="media">ไฟล์จากคลังสื่อ</MenuItem>\n                      </TextField>\n\n                      {block.source === "external" ? (\n                        <TextField\n                          label="URL ภายนอก"\n                          value={block.href}\n                          onChange={(event) =>\n                            updateBlock(block.id, (current) =>\n                              current.type === "link" ? { ...current, href: event.target.value } : current\n                            )\n                          }\n                          placeholder="https://example.org/document"\n                          helperText="ลิงก์จะเปิดในแท็บใหม่เมื่อผู้ชมคลิก"\n                          fullWidth\n                        />\n                      ) : (\n                        <TextField\n                          label="ไฟล์จากคลังสื่อ"\n                          select\n                          value={block.mediaId}\n                          onChange={(event) =>\n                            updateBlock(block.id, (current) =>\n                              current.type === "link" ? { ...current, mediaId: event.target.value } : current\n                            )\n                          }\n                          helperText="ใช้ช่องค้นหาคลังสื่อด้านข้างเพื่อหาไฟล์ที่ต้องการ หากยังไม่เห็นในรายการ"\n                          fullWidth\n                        >\n                          <MenuItem value="">เลือกไฟล์จากคลังสื่อ</MenuItem>\n                          {mediaAssets.map((asset) => (\n                            <MenuItem key={asset.id} value={asset.id}>\n                              {asset.name}\n                            </MenuItem>\n                          ))}\n                        </TextField>\n                      )}\n\n                      <TextField\n                        label="ข้อความที่แสดง"\n                        value={block.label}\n                        onChange={(event) =>\n                          updateBlock(block.id, (current) =>\n                            current.type === "link" ? { ...current, label: event.target.value } : current\n                          )\n                        }\n                        placeholder="เช่น ดาวน์โหลดแบบฟอร์มสมัครเรียน"\n                        helperText="ถ้าเว้นว่าง ระบบจะใช้ชื่อไฟล์จากคลังสื่อ หรือ URL ของลิงก์แทน"\n                        fullWidth\n                      />\n                    </Fragment>\n                  )}\n\n                  {block.type === "button" && (\n                    <Fragment>'''
replace_once(path, marker, insert)

# src/shared/components/ContentBlocksRenderer.tsx
path = "src/shared/components/ContentBlocksRenderer.tsx"
replace_once(
    path,
    'import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";',
    'import AttachFileOutlinedIcon from "@mui/icons-material/AttachFileOutlined";\nimport CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";\nimport LinkOutlinedIcon from "@mui/icons-material/LinkOutlined";'
)
marker = '''        if (block.type === "button") {\n          const safeHref = normalizeSafeHref(block.href);'''
insert = '''        if (block.type === "link") {\n          const asset = block.source === "media" ? mediaById.get(block.mediaId) : undefined;\n          const rawHref =\n            block.source === "media"\n              ? asset?.driveUrl || asset?.previewUrl || asset?.embedUrl || ""\n              : block.href;\n          const safeHref = normalizeSafeHref(rawHref);\n          const isValidHref = safeHref !== "#";\n          const label =\n            block.label.trim() || (block.source === "media" ? asset?.name || "" : block.href.trim());\n\n          if (!isValidHref || !label) {\n            return null;\n          }\n\n          return (\n            <Box key={block.id}>\n              <Button\n                component="a"\n                href={safeHref}\n                target="_blank"\n                rel="noreferrer"\n                variant="outlined"\n                startIcon={block.source === "media" ? <AttachFileOutlinedIcon /> : <LinkOutlinedIcon />}\n              >\n                {label}\n              </Button>\n            </Box>\n          );\n        }\n\n        if (block.type === "button") {\n          const safeHref = normalizeSafeHref(block.href);'''
replace_once(path, marker, insert)

# src/utils/contentBlocks.test.ts
path = "src/utils/contentBlocks.test.ts"
replace_once(
    path,
    '  it("creates and preserves PDF media blocks", () => {',
    '''  it("creates and preserves external and media attachment link blocks", () => {\n    expect(createContentBlock("link")).toMatchObject({\n      type: "link",\n      source: "external",\n      label: "",\n      href: "",\n      mediaId: ""\n    });\n\n    const serialized = serializeContentBlocksToBody([\n      {\n        id: "external-link",\n        type: "link",\n        source: "external",\n        label: "ประกาศต้นฉบับ",\n        href: " https://example.org/notice ",\n        mediaId: ""\n      },\n      {\n        id: "media-link",\n        type: "link",\n        source: "media",\n        label: "ดาวน์โหลดแบบฟอร์ม",\n        href: "",\n        mediaId: " media-document "\n      }\n    ]);\n\n    expect(parseContentBodyToBlocks(serialized)).toEqual([\n      {\n        id: "external-link",\n        type: "link",\n        source: "external",\n        label: "ประกาศต้นฉบับ",\n        href: "https://example.org/notice",\n        mediaId: ""\n      },\n      {\n        id: "media-link",\n        type: "link",\n        source: "media",\n        label: "ดาวน์โหลดแบบฟอร์ม",\n        href: "",\n        mediaId: "media-document"\n      }\n    ]);\n  });\n\n  it("creates and preserves PDF media blocks", () => {'''
)
replace_once(
    path,
    '  it("extracts unique media ids from image/video/pdf blocks", () => {',
    '  it("extracts unique media ids from visual blocks and media attachment links", () => {'
)
replace_once(
    path,
    '''      {\n        id: "image-2",\n        type: "image",\n        mediaId: "media-1",\n        caption: ""\n      }\n    ]);\n\n    expect(mediaIds).toEqual(["media-1", "media-2", "media-3"]);''',
    '''      {\n        id: "image-2",\n        type: "image",\n        mediaId: "media-1",\n        caption: ""\n      },\n      {\n        id: "media-link",\n        type: "link",\n        source: "media",\n        label: "Download",\n        href: "",\n        mediaId: "media-4"\n      },\n      {\n        id: "external-link",\n        type: "link",\n        source: "external",\n        label: "Source",\n        href: "https://example.org",\n        mediaId: "media-should-not-be-used"\n      }\n    ]);\n\n    expect(mediaIds).toEqual(["media-1", "media-2", "media-3", "media-4"]);'''
)

# src/test/contentBlocksRenderer.test.tsx
path = "src/test/contentBlocksRenderer.test.tsx"
replace_once(
    path,
    '  it("renders semantic body images immediately while deferring video network sources until near viewport", async () => {',
    '''  it("renders custom labels for external links and media-library attachments", () => {\n    render(\n      <ContentBlocksRenderer\n        mediaAssets={[\n          {\n            id: "attachment-document",\n            name: "original-file-name.pdf",\n            type: "document",\n            size: "2 MB",\n            owner: "Public",\n            driveUrl: "https://drive.google.com/file/d/attachment-document/view",\n            updatedAt: "2026-08-09T00:00:00.000Z"\n          }\n        ]}\n        blocks={[\n          {\n            id: "external-link",\n            type: "link",\n            source: "external",\n            label: "อ่านข้อมูลจากหน่วยงานต้นทาง",\n            href: "https://example.org/source",\n            mediaId: ""\n          },\n          {\n            id: "media-link",\n            type: "link",\n            source: "media",\n            label: "ดาวน์โหลดแบบฟอร์มสมัครเรียน",\n            href: "",\n            mediaId: "attachment-document"\n          }\n        ]}\n      />\n    );\n\n    expect(screen.getByRole("link", { name: "อ่านข้อมูลจากหน่วยงานต้นทาง" })).toHaveAttribute(\n      "href",\n      "https://example.org/source"\n    );\n    expect(screen.getByRole("link", { name: "ดาวน์โหลดแบบฟอร์มสมัครเรียน" })).toHaveAttribute(\n      "href",\n      "https://drive.google.com/file/d/attachment-document/view"\n    );\n    expect(screen.queryByText("original-file-name.pdf")).not.toBeInTheDocument();\n  });\n\n  it("falls back to the media filename or external URL when no custom link label is set", () => {\n    render(\n      <ContentBlocksRenderer\n        mediaAssets={[\n          {\n            id: "attachment-document",\n            name: "คู่มือการสมัคร.pdf",\n            type: "document",\n            size: "2 MB",\n            owner: "Public",\n            driveUrl: "https://drive.google.com/file/d/attachment-document/view",\n            updatedAt: "2026-08-09T00:00:00.000Z"\n          }\n        ]}\n        blocks={[\n          {\n            id: "external-link",\n            type: "link",\n            source: "external",\n            label: "",\n            href: "https://example.org/source",\n            mediaId: ""\n          },\n          {\n            id: "media-link",\n            type: "link",\n            source: "media",\n            label: "",\n            href: "",\n            mediaId: "attachment-document"\n          }\n        ]}\n      />\n    );\n\n    expect(screen.getByRole("link", { name: "https://example.org/source" })).toBeInTheDocument();\n    expect(screen.getByRole("link", { name: "คู่มือการสมัคร.pdf" })).toBeInTheDocument();\n  });\n\n  it("renders semantic body images immediately while deferring video network sources until near viewport", async () => {'''
)

# New builder test
Path("src/admin/components/ContentBlockBuilder.test.tsx").write_text('''import { useState } from "react";\nimport { render, screen } from "@testing-library/react";\nimport userEvent from "@testing-library/user-event";\nimport { describe, expect, it } from "vitest";\nimport type { MediaAsset } from "../../types";\nimport type { ContentBlock } from "../../utils/contentBlocks";\nimport ContentBlockBuilder from "./ContentBlockBuilder";\n\nconst mediaAssets: MediaAsset[] = [\n  {\n    id: "media-form",\n    name: "application-form.pdf",\n    type: "document",\n    size: "1 MB",\n    owner: "Admin",\n    driveUrl: "https://drive.google.com/file/d/media-form/view",\n    updatedAt: "2026-08-09T00:00:00.000Z"\n  }\n];\n\nfunction Harness() {\n  const [blocks, setBlocks] = useState<ContentBlock[]>([]);\n  return <ContentBlockBuilder blocks={blocks} mediaAssets={mediaAssets} onChange={setBlocks} />;\n}\n\ndescribe("ContentBlockBuilder attachment links", () => {\n  it("lets editors add an external link or switch to a media-library file while keeping custom display text", async () => {\n    const user = userEvent.setup();\n    render(<Harness />);\n\n    await user.click(screen.getByRole("button", { name: "ลิงก์ / ไฟล์แนบ" }));\n\n    const externalUrl = screen.getByLabelText("URL ภายนอก");\n    const displayText = screen.getByLabelText("ข้อความที่แสดง");\n    await user.type(externalUrl, "https://example.org/notice");\n    await user.type(displayText, "อ่านประกาศฉบับเต็ม");\n\n    expect(externalUrl).toHaveValue("https://example.org/notice");\n    expect(displayText).toHaveValue("อ่านประกาศฉบับเต็ม");\n\n    await user.click(screen.getByRole("combobox", { name: "แหล่งลิงก์" }));\n    await user.click(screen.getByRole("option", { name: "ไฟล์จากคลังสื่อ" }));\n\n    expect(screen.queryByLabelText("URL ภายนอก")).not.toBeInTheDocument();\n    const mediaSelect = screen.getByRole("combobox", { name: "ไฟล์จากคลังสื่อ" });\n    await user.click(mediaSelect);\n    await user.click(screen.getByRole("option", { name: "application-form.pdf" }));\n\n    expect(screen.getByLabelText("ข้อความที่แสดง")).toHaveValue("อ่านประกาศฉบับเต็ม");\n    expect(mediaSelect).toHaveTextContent("application-form.pdf");\n  });\n});\n''', encoding="utf-8")
