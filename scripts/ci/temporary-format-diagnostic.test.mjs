import { readFileSync } from "node:fs";
import prettier from "prettier";
import { describe, it } from "vitest";

describe("temporary CI formatting diagnostics", () => {
  it("prints Prettier-canonical source for the three new files", async () => {
    for (const path of [
      "config/ci-impact-map.json",
      "scripts/ci/impact-plan.mjs",
      "scripts/ci/impact-plan.test.mjs"
    ]) {
      const original = readFileSync(path, "utf8");
      const formatted = await prettier.format(original, {
        ...(await prettier.resolveConfig(path)),
        filepath: path
      });
      console.log("RCAT_FORMAT_RESULT:" + JSON.stringify({ path, formatted }));
    }
  });
});
