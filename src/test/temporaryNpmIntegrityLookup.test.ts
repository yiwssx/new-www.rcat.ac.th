import { execFileSync } from "node:child_process";
import { describe, it, expect } from "vitest";

describe("temporary npm integrity lookup", () => {
  it("prints the exact integrity of the security-fixed fast-uri tarball", () => {
    const integrity = execFileSync("npm", ["view", "fast-uri@3.1.9", "dist.integrity", "--json"], {
      encoding: "utf8",
      timeout: 20000
    }).trim();
    console.log("FASTURI_319_INTEGRITY|" + JSON.parse(integrity));
    expect(JSON.parse(integrity)).toMatch(/^sha512-/);
  });
});
