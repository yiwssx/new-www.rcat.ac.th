import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "vitest";
import { format, resolveConfig } from "prettier";

// Temporary verification harness to obtain byte-exact project formatting.
// Remove this file before merging the pull request.
describe("temporary content editor formatting trace", () => {
  it("prints bounded segments of the expected Prettier output", async () => {
    const paths = [
      "src/admin/components/ContentEditorDialog.tsx",
      "src/admin/pages/ContentEditorRoutePage.tsx"
    ];
    for (let fileIndex = 0; fileIndex < paths.length; fileIndex += 1) {
      const path = resolve(process.cwd(), paths[fileIndex]);
      const source = readFileSync(path, "utf8");
      const expected = await format(source, { ...(await resolveConfig(path)), filepath: path });
      const encoded = JSON.stringify(expected);
      for (let offset = 0; offset < encoded.length; offset += 1400) {
        console.log(`CONTENT_PRETTY_CHUNK|${fileIndex}|${offset / 1400}|${encoded.slice(offset, offset + 1400)}`);
      }
    }
  });
});
