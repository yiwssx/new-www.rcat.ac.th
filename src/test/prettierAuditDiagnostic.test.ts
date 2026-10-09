// Temporary diagnostic: delete this test after extracting the formatted audit text.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as prettier from "prettier";
import { describe, expect, it } from "vitest";

describe("temporary P08 Prettier diagnostic", () => {
  it("prints the exact formatter output for the unformatted final audit", async () => {
    const filePath = "docs/workstreams/agent-skills-code-alignment-final-audit.md";
    const input = readFileSync(resolve(process.cwd(), filePath), "utf8");
    const config = await prettier.resolveConfig(filePath);
    const formatted = await prettier.format(input, { ...config, filepath: filePath });

    process.stdout.write(`P08_PRETTIER_FORMATTED=${JSON.stringify(formatted)}\n`);
    expect(formatted.length).toBeGreaterThan(100);
  });
});
