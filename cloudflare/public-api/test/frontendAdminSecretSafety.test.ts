import { describe, expect, it } from "vitest";
import adminWriteProviderSource from "../../../src/config/adminWriteProvider.ts?raw";
import adminWriteProviderTestSource from "../../../src/config/adminWriteProvider.test.ts?raw";
import cloudflareApiSource from "../../../src/features/admin-write/cloudflareApi.ts?raw";
import adminWriteFeatureTestSource from "../../../src/features/admin-write/adminWriteProvider.test.ts?raw";
import viteEnvSource from "../../../src/vite-env.d.ts?raw";

const forbiddenBrowserSecretName = ["VITE", "CLOUDFLARE", "ADMIN", "WRITE", "TOKEN"].join("_");

describe("M18 frontend admin write secret safety", () => {
  it("does not expose an admin write credential through Vite frontend source", () => {
    const sourceFiles = [
      ["src/config/adminWriteProvider.ts", adminWriteProviderSource],
      ["src/features/admin-write/cloudflareApi.ts", cloudflareApiSource],
      ["src/features/admin-write/adminWriteProvider.test.ts", adminWriteFeatureTestSource],
      ["src/config/adminWriteProvider.test.ts", adminWriteProviderTestSource],
      ["src/vite-env.d.ts", viteEnvSource]
    ];

    for (const [relativePath, source] of sourceFiles) {
      expect(source, relativePath).not.toContain(forbiddenBrowserSecretName);
    }
  });
});
