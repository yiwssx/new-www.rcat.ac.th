import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import checker from "vite-plugin-checker";

const WRANGLER_REPOSITORY_PATH = "cloudflare/public-api/wrangler.toml";
const CLIENT_MANIFEST_PATH = path.resolve("dist", ".vite", "manifest.json");

type ClientManifestChunk = {
  css?: string[];
  file?: string;
  isEntry?: boolean;
};

function toPublicAssetPath(file: string) {
  return `/${file.replace(/^\/+/, "")}`;
}

function loadSsrClientAssets() {
  const manifest = JSON.parse(readFileSync(CLIENT_MANIFEST_PATH, "utf8")) as Record<string, ClientManifestChunk>;

  const entry = manifest["index.html"] ?? Object.values(manifest).find((chunk) => chunk.isEntry);
  if (!entry?.file) {
    throw new Error("Production client manifest does not contain an application entry chunk");
  }

  const stylesheetPaths = (entry.css ?? []).map(toPublicAssetPath);
  if (stylesheetPaths.length === 0) {
    throw new Error("Production client manifest does not contain an application stylesheet");
  }

  return {
    entryPath: toPublicAssetPath(entry.file),
    stylesheetPaths
  };
}

function committedWranglerSafetySource(): Plugin {
  let committedSource: string | undefined;

  return {
    name: "committed-wrangler-safety-source",
    enforce: "pre",
    load(id) {
      if (!id.replace(/\\/g, "/").endsWith(`/${WRANGLER_REPOSITORY_PATH}?raw`)) {
        return null;
      }

      try {
        committedSource ??= execFileSync("git", ["show", `HEAD:${WRANGLER_REPOSITORY_PATH}`], {
          cwd: process.cwd(),
          encoding: "utf8"
        });
      } catch {
        throw new Error(`Unable to load the committed HEAD source for ${WRANGLER_REPOSITORY_PATH}`);
      }

      return `export default ${JSON.stringify(committedSource)};`;
    }
  };
}

function utf8HtmlCharset(): Plugin {
  return {
    name: "utf8-html-charset",
    configureServer(server) {
      server.middlewares.use((_req, res, next) => {
        const originalSetHeader = res.setHeader.bind(res);

        res.setHeader = (name: string, value: string | string[]) => {
          if (String(name).toLowerCase() === "content-type") {
            const values = Array.isArray(value) ? value : [value];
            const normalized = values.map((entry) =>
              String(entry).startsWith("text/html") && !String(entry).includes("charset")
                ? `${entry}; charset=utf-8`
                : entry
            );
            return originalSetHeader(name, Array.isArray(value) ? normalized : normalized[0]);
          }
          return originalSetHeader(name, value);
        };
        next();
      });
    }
  };
}

export default defineConfig(({ command, mode, isSsrBuild }) => {
  const plugins = [react(), utf8HtmlCharset()] as Plugin[];
  const ssrClientAssets = isSsrBuild ? loadSsrClientAssets() : null;

  if (mode === "test") {
    plugins.push(committedWranglerSafetySource());
  }

  // Enable vite-plugin-checker only during the dev server to provide
  // fast TypeScript feedback without affecting production builds.
  if (command === "serve" && mode !== "test") {
    plugins.push(
      checker({
        typescript: {
          tsconfigPath: "tsconfig.json"
        }
      })
    );
  }

  return {
    plugins,
    ...(ssrClientAssets
      ? {
          define: {
            __RCAT_SSR_CLIENT_ENTRY_PATH__: JSON.stringify(ssrClientAssets.entryPath),
            __RCAT_SSR_CLIENT_STYLESHEET_PATHS__: JSON.stringify(ssrClientAssets.stylesheetPaths)
          }
        }
      : {}),
    build: {
      cssCodeSplit: true,
      manifest: !isSsrBuild,
      ...(!isSsrBuild
        ? {
            rollupOptions: {
              output: {
                entryFileNames: "assets/[name]-[hash].js",
                chunkFileNames: "assets/[name]-[hash].js",
                assetFileNames: "assets/[name]-[hash][extname]"
              }
            }
          }
        : {})
    },
    server: {
      host: "127.0.0.1",
      port: 5173
    },
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: "./src/test/setup.ts",
      exclude: ["tests/functional/**", "node_modules/**", "dist/**", ".dependency-migration/**"]
    }
  };
});
