// @vitest-environment node

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as prettier from "prettier";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const workflowPath = join(repositoryRoot, ".github", "workflows", "production-verification.yml");

describe("temporary Prettier concurrency probe", () => {
  it("prints the canonical concurrency block", async () => {
    const source = readFileSync(workflowPath, "utf8");
    const formatted = await prettier.format(source, { filepath: workflowPath });
    const match = formatted.match(/concurrency:\n[\s\S]*?\n\njobs:/);
    console.log(`PRETTIER_CONCURRENCY_BLOCK\n${match?.[0] ?? "missing"}`);
    expect(formatted).toBe(source);
  });
});
