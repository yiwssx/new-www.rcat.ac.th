// @vitest-environment node

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("P6D public product/UX baseline", () => {
  it("keeps the not-found page public-facing and gives users recovery actions", () => {
    const source = readSource("src/shared/pages/NotFoundPage.tsx");

    expect(source).toContain('component="main"');
    expect(source).toContain("ไม่พบหน้าที่ต้องการ");
    expect(source).toContain("กลับหน้าแรก");
    expect(source).toContain("ค้นหาในเว็บไซต์");
    expect(source).toContain('href="/search"');
    expect(source).not.toContain("เส้นทาง CMS");
  });

  it("keeps public error states recoverable after a failed retry", () => {
    const source = readSource("src/public/components/PublicErrorState.tsx");

    expect(source).toContain("กำลังลองใหม่");
    expect(source).toContain("กลับหน้าแรก");
    expect(source).toContain('href="/"');
  });

  it("keeps search input synchronized with URL state and offers no-result exits", () => {
    const source = readSource("src/public/pages/PublicSearchPage.tsx");

    expect(source).toContain("new FormData(event.currentTarget)");
    expect(source).toContain('key={query}');
    expect(source).toContain('name="q"');
    expect(source).toContain('defaultValue={query}');
    expect(source).toContain("ล้างคำค้น");
    expect(source).toContain('normalizeSafeHref("/news")');
    expect(source).toContain('normalizeSafeHref("/announcements")');
    expect(source).toContain('aria-live="polite"');
    expect(source).not.toContain("setDraftQuery");
  });
});
