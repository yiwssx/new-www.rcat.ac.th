import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PublicSiteShell from "../public/components/PublicSiteShell";
import PublicHomePage from "../public/pages/PublicHomePage";
import { CmsSnapshot } from "../types";

let currentSnapshot: CmsSnapshot;

vi.mock("../public/hooks/usePublicCmsSnapshot", () => ({
  usePublicCmsSnapshot: () => ({
    data: currentSnapshot,
    isLoading: false
  })
}));

function createSnapshot(overrides: Partial<CmsSnapshot> = {}): CmsSnapshot {
  return {
    metrics: [],
    content: [],
    media: [],
    events: [],
    menu: [],
    siteSettings: {
      siteName: "CMS public site",
      eyebrow: "",
      intro: "",
      campus: "",
      phone: "",
      fax: "",
      email: "",
      address: "",
      admissionUrl: "",
      facebookUrl: "",
      youtubeUrl: "",
      tiktokUrl: "",
      heroTitle: "CMS public site",
      heroDescription: "",
      heroChip: "",
      heroImageUrl: "",
      directorName: "",
      directorTitle: "",
      directorDescription: "",
      footerTitle: "CMS public site",
      footerDescription: ""
    },
    ...overrides
  };
}

afterEach(() => {
  cleanup();
});

describe("public data-driven pages", () => {
  it("does not render mock document titles when no CMS content exists", () => {
    currentSnapshot = createSnapshot();

    render(<PublicHomePage />);

    expect(screen.queryByText(/ITA/)).not.toBeInTheDocument();
    expect(screen.queryByText(/แผนปฏิบัติการ/)).not.toBeInTheDocument();
    expect(screen.getByText("ยังไม่มีเอกสารเผยแพร่")).toBeInTheDocument();
  });

  it("shows an honest empty state when no program content exists", () => {
    currentSnapshot = createSnapshot();

    render(<PublicHomePage />);

    expect(screen.getByText("ยังไม่มีข้อมูลหลักสูตรที่เผยแพร่")).toBeInTheDocument();
  });

  it("hides social icons when site settings URLs are empty", () => {
    currentSnapshot = createSnapshot();

    render(
      <PublicSiteShell>
        <div>content</div>
      </PublicSiteShell>
    );

    expect(screen.queryByLabelText("Facebook")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("YouTube")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("TikTok")).not.toBeInTheDocument();
  });
});
