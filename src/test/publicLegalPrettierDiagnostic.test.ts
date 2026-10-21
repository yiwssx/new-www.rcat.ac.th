// @vitest-environment node
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { format, resolveConfig } from "prettier";

describe("temporary legal notice formatting diagnostic", () => {
  it("prints the exact source formatting diff for repair", async () => {
    const file = fileURLToPath(new URL("../public/pages/PublicLegalPages.tsx", import.meta.url));
    const original = readFileSync(file, "utf8");
    const config = (await resolveConfig(file)) ?? {};
    const formatted = await format(original, { ...config, filepath: file });
    const folder = mkdtempSync(join(tmpdir(), "rcat-format-"));
    const a = join(folder, "original.tsx");
    const b = join(folder, "prettier.tsx");
    try {
      writeFileSync(a, original);
      writeFileSync(b, formatted);
      let patch = "";
      try {
        patch = execFileSync("diff", ["-u", a, b], { encoding: "utf8" });
      } catch (error) {
        patch = (error as { stdout?: string }).stdout ?? "";
      }
      console.error("RCAT_PRETTIER_DIAGNOSTIC_BEGIN\n" + patch + "\nRCAT_PRETTIER_DIAGNOSTIC_END");
      expect(original).toBe(formatted);
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  });
});
