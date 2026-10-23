import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "vitest";
import { format, resolveConfig } from "prettier";

describe("temporary UX03 exact formatting", () => {
  it("prints the canonical Prettier source in numbered chunks", async () => {
    const file = resolve(process.cwd(), "src/admin/components/ContentEditorDialog.tsx");
    const source = readFileSync(file, "utf8");
    const formatted = await format(source, { ...(await resolveConfig(file)), filepath: file });
    const serialized = JSON.stringify(formatted);
    for (let offset = 0; offset < serialized.length; offset += 1400) {
      console.log(`UX03_PRETTIER_CHUNK|${offset / 1400}|${serialized.slice(offset, offset + 1400)}`);
    }
  });
});
