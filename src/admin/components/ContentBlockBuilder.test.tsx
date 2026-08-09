import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { MediaAsset } from "../../types";
import type { ContentBlock } from "../../utils/contentBlocks";
import ContentBlockBuilder from "./ContentBlockBuilder";

const mediaAssets: MediaAsset[] = [
  {
    id: "media-form",
    name: "application-form.pdf",
    type: "document",
    size: "1 MB",
    owner: "Admin",
    driveUrl: "https://drive.google.com/file/d/media-form/view",
    updatedAt: "2026-08-09T00:00:00.000Z"
  }
];

function Harness() {
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  return <ContentBlockBuilder blocks={blocks} mediaAssets={mediaAssets} onChange={setBlocks} />;
}

describe("ContentBlockBuilder attachment links", () => {
  it("lets editors add an external link or switch to a media-library file while keeping custom display text", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(
      screen.getByRole("button", { name: "แนบลิงก์ภายนอกหรือไฟล์จากคลังสื่อ พร้อมกำหนดข้อความที่แสดง" })
    );

    const externalUrl = screen.getByLabelText("URL ภายนอก");
    const displayText = screen.getByLabelText("ข้อความที่แสดง");
    await user.type(externalUrl, "https://example.org/notice");
    await user.type(displayText, "อ่านประกาศฉบับเต็ม");

    expect(externalUrl).toHaveValue("https://example.org/notice");
    expect(displayText).toHaveValue("อ่านประกาศฉบับเต็ม");

    await user.click(screen.getByRole("combobox", { name: "แหล่งลิงก์" }));
    await user.click(screen.getByRole("option", { name: "ไฟล์จากคลังสื่อ" }));

    expect(screen.queryByLabelText("URL ภายนอก")).not.toBeInTheDocument();
    const mediaSelect = screen.getByRole("combobox", { name: "ไฟล์จากคลังสื่อ" });
    await user.click(mediaSelect);
    await user.click(screen.getByRole("option", { name: "application-form.pdf" }));

    expect(screen.getByLabelText("ข้อความที่แสดง")).toHaveValue("อ่านประกาศฉบับเต็ม");
    expect(mediaSelect).toHaveTextContent("application-form.pdf");
  });
});
