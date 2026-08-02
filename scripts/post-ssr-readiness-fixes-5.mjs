import fs from "node:fs";

function write(file, content) {
  fs.writeFileSync(file, content.endsWith("\n") ? content : `${content}\n`);
}

function patch(file, from, to) {
  let source = fs.readFileSync(file, "utf8");
  if (!source.includes(from)) throw new Error(`Missing post-fix source in ${file}`);
  source = source.replace(from, to);
  write(file, source);
}

write(
  "src/public/components/PublicShellRouteLayout.tsx",
  `import { lazy, Suspense } from "react";
import { Outlet, useRouterState } from "@tanstack/react-router";
import { SilentTelemetryBoundary } from "../../shared/telemetry/SilentTelemetryBoundary";
import PublicSiteShell from "./PublicSiteShell";

declare global {
  interface Window {
    __RCAT_FUNCTIONAL_FAIL_PUBLIC_TELEMETRY_IMPORT__?: boolean;
    __RCAT_FUNCTIONAL_PUBLIC_TELEMETRY_FAILURE_TRIGGERED__?: boolean;
  }
}

function loadPublicTelemetry() {
  if (import.meta.env.DEV && typeof window !== "undefined" && window.__RCAT_FUNCTIONAL_FAIL_PUBLIC_TELEMETRY_IMPORT__) {
    window.__RCAT_FUNCTIONAL_PUBLIC_TELEMETRY_FAILURE_TRIGGERED__ = true;
    return Promise.reject(new Error("Synthetic optional telemetry module failure"));
  }

  return import("../../shared/telemetry/PublicTelemetry");
}

const PublicTelemetry = lazy(loadPublicTelemetry);

export default function PublicShellRouteLayout() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <>
      <PublicSiteShell routeLayout routePathname={pathname}>
        <Outlet />
      </PublicSiteShell>
      <SilentTelemetryBoundary>
        <Suspense fallback={null}>
          <PublicTelemetry />
        </Suspense>
      </SilentTelemetryBoundary>
    </>
  );
}
`
);

patch(
  "src/public/components/PublicSiteShell.tsx",
  "  routeLayout: _routeLayout = false,",
  "  routeLayout = false,"
);

patch(
  "src/public/components/PublicSiteShell.tsx",
  '  const routeDefaults = getPublicRouteShellDefaults(pathname || "/");',
  '  const routeDefaults = routeLayout ? getPublicRouteShellDefaults(pathname || "/") : {};'
);

patch(
  "src/public/components/PublicSiteShell.tsx",
  "  return controller?.activeRegistration === registration ? <>{children}</> : null;",
  "  // Registration is transitional client metadata plumbing only. Page content must\n  // render on the first pass so future SSR never depends on useLayoutEffect.\n  return <>{children}</>;"
);

patch(
  "src/test/publicShellLayoutStability.test.tsx",
  '    expect(publicSiteShellSource).toContain("useLayoutEffect");',
  '    expect(publicSiteShellSource).toContain("useLayoutEffect");\n    expect(publicSiteShellSource).not.toContain("controller?.activeRegistration === registration ?");\n    expect(publicSiteShellSource).toContain("Page content must\\n  // render on the first pass");'
);

patch(
  "docs/architecture/ssr-readiness-foundation.md",
  "5. Public pages own PublicSiteShell directly; the public route layout is telemetry-only, so critical rendering no longer depends on child-to-parent useLayoutEffect registration.",
  "5. The persistent Public route shell remains the single structural owner for CLS stability. Nested page-shell registration is retained only as transitional client metadata/preload plumbing, but it no longer gates page children; critical rendering therefore no longer depends on child-to-parent useLayoutEffect completion."
);

patch(
  "docs/performance/public-shell-footer-cls-stability.md",
  "- Ready route children mount only after the outer shell accepts the same\n  registration object. This closes the one-frame loading-to-ready gap so Intro\n  Gate settings are active before Home carousel or page media can request assets.",
  "- Ready route children now render immediately inside the persistent outer shell.\n  Nested registration remains transitional client metadata/preload plumbing only\n  and no longer gates route content. This preserves the single structural shell\n  while making the critical page tree compatible with a future server render."
);

patch(
  "docs/performance/public-shell-footer-cls-stability.md",
  "Its syntax-aware checks protect the stable directory states,\nnon-focusable placeholder, structured loading variants, functional CLS budget,\nPublic/Auth import boundary, route-level shell ownership, and ready-content\nretention.",
  "Its syntax-aware checks protect the stable directory states,\nnon-focusable placeholder, structured loading variants, functional CLS budget,\nPublic/Auth import boundary, route-level shell ownership, and ready-content\nretention. The SSR-readiness regression test additionally protects the rule that\nnested shell registration must never withhold route children from the first render."
);
