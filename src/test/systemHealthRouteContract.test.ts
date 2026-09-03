// @vitest-environment node

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function read(path: string) {
  return readFileSync(join(repositoryRoot, path), "utf8");
}

describe("system health route contract", () => {
  it("keeps the page lazy and protected by the existing dashboard capability", () => {
    const routeComponents = read("src/routeComponents.tsx");
    const routes = read("src/routes.tsx");

    expect(routeComponents).toContain('SystemHealthPage = lazy(() => import("./admin/pages/SystemHealthPage"))');
    expect(routes).toContain('path: "system-health"');
    expect(routes).toContain('<CapabilityGuard capability="dashboard.read">\n      <SystemHealthPage />');
  });

  it("exposes system health through the capability-filtered CMS navigation", () => {
    const shell = read("src/admin/layout/CmsShell.tsx");

    expect(shell).toContain('| "/admin/system-health"');
    expect(shell).toContain('label: "สถานะระบบ"');
    expect(shell).toContain('to: "/admin/system-health"');
    expect(shell).toContain('capabilities: ["dashboard.read"]');
  });
});
