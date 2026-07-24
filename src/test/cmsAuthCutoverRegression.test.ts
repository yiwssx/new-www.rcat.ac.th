// @vitest-environment node

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function productionSources(path: string): string[] {
  if (statSync(path).isFile()) {
    return /\.(?:ts|tsx)$/.test(path) && !/\.test\.(?:ts|tsx)$/.test(path) ? [path] : [];
  }

  return readdirSync(path).flatMap((entry) => productionSources(join(path, entry)));
}

describe("CMS auth cutover regression guard", () => {
  it("keeps the active React graph free of retired proxy-session authentication", () => {
    const activePaths = [
      join(srcRoot, "admin"),
      join(srcRoot, "context"),
      join(srcRoot, "features"),
      join(srcRoot, "routeComponents.tsx"),
      join(srcRoot, "routes.tsx")
    ];
    const source = activePaths
      .flatMap(productionSources)
      .map((path) => readFileSync(path, "utf8"))
      .join("\n");

    expect(source).not.toContain("/api/admin-proxy-session/login");
    expect(source).not.toContain("admin proxy session is required");
    expect(source).not.toContain("rcat:admin-proxy-session-expired");
    expect(source).not.toContain("rcat.admin.proxy.session.notice");
    expect(source).not.toContain("admin-proxy.local.");
    expect(source).not.toMatch(/from\s+["'][^"']*services\/auth["']/);
  });

  it("does not restore or persist a browser-side admin Session", () => {
    const authContext = readFileSync(join(srcRoot, "context", "AuthContext.tsx"), "utf8");

    expect(authContext).not.toMatch(/(?:getItem|setItem)\(\s*projectSettings\.storageKeys\.session/);
    expect(authContext).toContain("window.localStorage.removeItem(projectSettings.storageKeys.session)");
  });
});
