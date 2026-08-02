import fs from "node:fs";

function patch(file, from, to) {
  let source = fs.readFileSync(file, "utf8");
  if (!source.includes(from)) throw new Error(`Missing post-fix source in ${file}`);
  source = source.replace(from, to);
  fs.writeFileSync(file, source);
}

patch(
  "cloudflare/public-api/src/adapters/publicContentAdapter.ts",
  '  const { body_snapshot: _bodySnapshot, ...summaryRow } = row as PublicContentReadRow;\n  return mapContentRowToPublicContentItem({ ...summaryRow, body_snapshot: "" });',
  '  return mapContentRowToPublicContentItem({ ...(row as PublicContentReadRow), body_snapshot: "" });'
);

patch(
  "src/public/components/PublicSiteShell.tsx",
  "  routeLayout = false,",
  "  routeLayout: _routeLayout = false,"
);

patch(
  "src/public/components/PublicSiteShell.tsx",
  '  useEffect(() => {\n    setBrowserIntroGateVisible(readBrowserPublicIntroGateVisibility(homepageSettings.introGate));\n  }, [homepageSettings.introGate]);',
  '  useEffect(() => {\n    const timeoutId = window.setTimeout(() => {\n      setBrowserIntroGateVisible(readBrowserPublicIntroGateVisibility(homepageSettings.introGate));\n    }, 0);\n    return () => window.clearTimeout(timeoutId);\n  }, [homepageSettings.introGate]);'
);
