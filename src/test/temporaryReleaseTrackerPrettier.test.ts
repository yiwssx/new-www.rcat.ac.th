import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "vitest";
import { format, resolveConfig } from "prettier";

describe("temporary release tracker formatter", () => {
  it("prints exact formatted tracker", async () => {
    const path = resolve(process.cwd(), "docs/workstreams/admin-content-workspace-ux-tracker.md");
    const output = await format(readFileSync(path, "utf8"), {
      ...(await resolveConfig(path)),
      filepath: path
    });
    const encoded = JSON.stringify(output);
    for (let offset = 0; offset < encoded.length; offset += 1200) {
      console.log(`RELEASE_TRACKER_PRETTY|${offset / 1200}|${encoded.slice(offset, offset + 1200)}`);
    }
  });
});
