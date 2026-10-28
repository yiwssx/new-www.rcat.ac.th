import { readFileSync } from "node:fs";
import prettier from "prettier";
import { describe, it } from "vitest";

describe("temporary source format inspection", () => {
  it("emits canonical Prettier text for the affected P2 files", async () => {
    for (const path of ["scripts/ci/detect-impact.mjs", "scripts/ci/selective-gate.test.mjs"]) {
      const original = readFileSync(path, "utf8");
      const formatted = await prettier.format(original, {
        ...(await prettier.resolveConfig(path)),
        filepath: path
      });
      console.log("RCAT_FORMAT_RESULT:" + JSON.stringify({ path, formatted }));
    }
  });
});
