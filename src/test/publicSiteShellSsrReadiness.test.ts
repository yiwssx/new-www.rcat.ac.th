import publicSiteShellSource from "../public/components/PublicSiteShell.tsx?raw";
import publicShellHookSource from "../public/hooks/usePublicShellSnapshot.ts?raw";
import { describe, expect, it } from "vitest";

describe("PublicSiteShell SSR readiness", () => {
  it("renders nested page content independently of client registration effects", () => {
    expect(publicSiteShellSource).toContain("return <>{children}</>;");
    expect(publicSiteShellSource).toContain("useEffect(() => {");
    expect(publicSiteShellSource).toContain("register?.(registration);");
    expect(publicSiteShellSource).toContain("return () => {");
    expect(publicSiteShellSource).toContain("unregister?.(token);");
    expect(publicSiteShellSource).not.toContain("activeRegistration === registration");
    expect(publicSiteShellSource).not.toContain("useLayoutEffect");
  });

  it("makes the route shell own the lightweight public shell query through a testable hook boundary", () => {
    expect(publicSiteShellSource).toContain("usePublicShellSnapshot({");
    expect(publicSiteShellSource).not.toContain("usePublicCmsSnapshot({");
    expect(publicSiteShellSource).not.toContain("skipShellDataFetch: true");
    expect(publicShellHookSource).toContain("publicShellQueryOptions({ consumeAbortSignal: false })");
  });

  it("keeps page media closed until shell settings resolve so Intro Gate ownership is not bypassed", () => {
    expect(publicSiteShellSource).toContain("pageMediaAllowed={hasResolvedShellSettings && !introGateVisible}");
  });
});
