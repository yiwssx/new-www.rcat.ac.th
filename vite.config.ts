import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

function utf8HtmlCharset() {
  return {
    name: "utf8-html-charset",
    configureServer(server: any) {
      server.middlewares.use((_req: any, res: any, next: any) => {
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

export default defineConfig({
  plugins: [react(), utf8HtmlCharset()],
  build: {
    cssCodeSplit: true
  },
  server: {
    host: "127.0.0.1",
    port: 5173
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
    exclude: ["tests/functional/**", "node_modules/**", "dist/**"]
  }
});