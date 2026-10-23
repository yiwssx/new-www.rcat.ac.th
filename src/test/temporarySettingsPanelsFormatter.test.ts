import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "vitest";
import { format, resolveConfig } from "prettier";

describe("temporary settings panels formatter", () => {
  it("prints canonical Prettier output for the edited files", async () => {
    const paths = [
      "src/admin/components/ContentEditorDialog.tsx",
      "src/admin/components/ContentEditorDialog.test.tsx",
      "tests/functional/designSystemUiUx.spec.ts"
    ];
    for (let i = 0; i < paths.length; i += 1) {
      const path = resolve(process.cwd(), paths[i]);
      const source = readFileSync(path, "utf8");
      const expected = await format(source, { ...(await resolveConfig(path)), filepath: path });
      const serialized = JSON.stringify(expected);
      for (let offset = 0; offset < serialized.length; offset += 1300) {
        console.log(`SETTINGS_PRETTIER|${i}|${offset / 1300}|${serialized.slice(offset, offset + 1300)}`);
      }
    }
  });
});
