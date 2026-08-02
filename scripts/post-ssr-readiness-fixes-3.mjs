import fs from "node:fs";

function patch(file, from, to) {
  let source = fs.readFileSync(file, "utf8");
  if (!source.includes(from)) throw new Error(`Missing post-fix source in ${file}`);
  source = source.replace(from, to);
  fs.writeFileSync(file, source);
}

patch(
  "src/public/components/publicIntroGateState.ts",
  "export function getInitialPublicIntroGateVisibility() {\n  return false;\n}",
  "export function getInitialPublicIntroGateVisibility(_settings?: HomepageIntroGateSettings) {\n  return false;\n}"
);

patch(
  "src/routes.tsx",
  "const rootRoute = createRootRoute({\n  component: RootRouteLayout,",
  "const rootRoute = createRootRoute({\n  validateSearch: (search) => search as Record<string, unknown>,\n  component: RootRouteLayout,"
);
