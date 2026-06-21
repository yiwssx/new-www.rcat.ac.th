import { describe, expect, it } from "vitest";
import { formatFileSize, readFileAsBase64 } from "./files";

describe("media file payload preservation", () => {
  it("encodes the exact original File bytes and reports the original size", async () => {
    const bytes = new Uint8Array([0, 255, 16, 32, 127]);
    const file = new File([bytes], "original-image.png", { type: "image/png" });

    expect(await readFileAsBase64(file)).toBe("AP8QIH8=");
    expect(formatFileSize(file.size)).toBe("5 B");
  });
});
