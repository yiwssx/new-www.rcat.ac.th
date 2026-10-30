// @vitest-environment node

import { describe, expect, it } from "vitest";
import { auditSourceImportGraph, formatSourceGraphAudit, scanModuleImports } from "./audit-functional-imports.mjs";

const owners = {
  "src/public/Carousel.tsx": ["tests/functional/carousel.spec.ts"],
  "src/public/Cookie.tsx": ["tests/functional/publicCookieConsent.spec.ts"]
};
const files = new Map([
  ["src/public/helper.ts", "export const value = 1;"],
  ["src/public/wrapper.ts", 'export { value } from "./helper";'],
  ["src/public/Carousel.tsx", 'import { value } from "./wrapper"; export const slider = value;'],
  ["src/public/Cookie.tsx", 'import type { Consent } from "./helper"; export const cookie = true;'],
  ["src/public/lazy.tsx", 'export const view = import("./Carousel");'],
  ["src/public/opaque.tsx", "const lazy = import(getModulePath()); void lazy;"]
]);

describe("source import graph shadow audit", () => {
  it("follows transitive consumers through static and literal dynamic imports", () => {
    const output = auditSourceImportGraph(files, ["src/public/helper.ts"], owners);
    expect(output.reached).toBe(5);
    expect(output.ownerAnchors).toEqual(["src/public/Carousel.tsx", "src/public/Cookie.tsx"]);
    expect(output.candidateSpecs).toEqual([
      "tests/functional/carousel.spec.ts",
      "tests/functional/publicCookieConsent.spec.ts"
    ]);
    expect(output.safeToSkipFullE2E).toBe(false);
    expect(formatSourceGraphAudit(output)).toContain("Full browser suite remains required");
  });

  it("marks unresolved relative dependencies and opaque dynamic expressions as uncertain", () => {
    const fixture = new Map([
      ["src/public/a.ts", 'export { x } from "./missing"; const unknown = import("./" + name);'],
      ["src/public/b.tsx", 'import "./a"; import.meta.glob("./widgets/*.tsx");']
    ]);
    const output = auditSourceImportGraph(fixture, ["src/public/a.ts"], owners);
    expect(output.opaqueCount).toBe(2);
    expect(output.opaqueReachable).toEqual(["src/public/a.ts", "src/public/b.tsx"]);
    expect(output.candidateSpecs).toEqual([]);
    expect(output.safeToSkipFullE2E).toBe(false);
  });

  it("does not treat an import keyword in comments or strings as an import edge", () => {
    expect(scanModuleImports("src/example.ts", '// import("./file");\nconst note = "import x";').requests).toEqual([]);
  });

  it("resolves index modules, TSX and re-exports while excluding outside-src imports", () => {
    const fixture = new Map([
      ["src/shared/index.ts", "export const name = 'RCAT';"],
      ["src/public/route.tsx", 'import { name } from "../shared"; export { name } from "../shared/index";'],
      ["src/public/unrelated.ts", 'import thing from "library";']
    ]);
    const output = auditSourceImportGraph(fixture, ["src/shared/index.ts"], owners);
    expect(output.reached).toBe(2);
    expect(output.opaqueCount).toBe(0);
  });

  it("rejects missing changed source and malformed/unbounded graphs", () => {
    expect(() => auditSourceImportGraph(files, ["src/public/not-found.ts"], owners)).toThrow("Missing changed file");
    expect(() => auditSourceImportGraph(new Map(), [], owners)).not.toThrow();
    expect(() => auditSourceImportGraph({}, [], owners)).toThrow();
    const huge = new Map(Array.from({ length: 2501 }, (_, index) => [`src/n${index}.ts`, "export {};"]));
    expect(() => auditSourceImportGraph(huge, [], owners)).toThrow("Invalid or unbounded");
  });

  it("retains exact-path, deterministic suggestions without claiming transitive test completeness", () => {
    const output = auditSourceImportGraph(files, ["src/public/Carousel.tsx"], owners);
    expect(output.candidateSpecs).toEqual(["tests/functional/carousel.spec.ts"]);
    expect(output.safeToSkipFullE2E).toBe(false);
  });
});
