// @vitest-environment node
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const apiDirectory = path.join(repositoryRoot, "api");
const executableExtensions = new Set([".js", ".mjs", ".cjs", ".ts", ".mts", ".cts"]);
const expectedFunctions = [
  "admin-proxy.mjs",
  "apps-script-proxy.mjs",
  "cms-auth.mjs",
  "complaint.mjs",
  "sitemap.mjs",
  "ssr.ts"
];
const retiredFunctions = ["admin-proxy-session/login.mjs", "admin-proxy-session/logout.mjs"];
const obsoleteCmsAuthFunctions = [
  "cms-auth/login.mjs",
  "cms-auth/session.mjs",
  "cms-auth/logout.mjs",
  "cms-auth/logout-all.mjs",
  "cms-auth/change-password.mjs",
  "cms-auth/invitation/inspect.mjs",
  "cms-auth/invitation/accept.mjs",
  "cms-auth/password-reset/inspect.mjs",
  "cms-auth/password-reset/complete.mjs"
];

function listExecutableApiFiles(directory, prefix = "") {
  const files = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    const absolutePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...listExecutableApiFiles(absolutePath, relativePath));
      continue;
    }

    if (
      entry.isFile() &&
      !entry.name.startsWith("_") &&
      !entry.name.startsWith(".") &&
      !entry.name.endsWith(".d.ts") &&
      executableExtensions.has(path.extname(entry.name))
    ) {
      files.push(relativePath);
    }
  }

  return files.sort();
}

describe("direct Vercel Function budget", () => {
  it("keeps exactly the six reviewed direct Functions including Complaint and Public SSR", () => {
    const functions = listExecutableApiFiles(apiDirectory);

    expect(functions).toHaveLength(6);
    expect(functions).toEqual(expectedFunctions);
  });

  it("uses only the consolidated CMS-auth API entry and never restores retired Functions", () => {
    expect(existsSync(path.join(apiDirectory, "cms-auth.mjs"))).toBe(true);

    for (const obsoleteFunction of [...obsoleteCmsAuthFunctions, ...retiredFunctions]) {
      expect(existsSync(path.join(apiDirectory, ...obsoleteFunction.split("/")))).toBe(false);
    }
  });
});
