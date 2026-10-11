import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PublicOrganizationDetailPage from "./PublicOrganizationDetailPage";

const mock = vi.hoisted(() => ({ data: null as unknown }));
vi.mock("../../features/public-organization", () => ({
  publicOrganizationDetailQueryOptions: (slug: string) => ({
    queryKey: ["org-detail-test", slug],
    queryFn: async () => mock.data,
    staleTime: 10000
  })
}));

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PublicOrganizationDetailPage slug="work" />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  mock.data = null;
});

describe("Phase 7 responsive public organization renderer", () => {
  it("shows ancestor breadcrumbs, nested sections and published people without requiring Admin", async () => {
    mock.data = {
      unit: {
        contentId: "work",
        parentContentId: "division",
        slug: "work",
        title: "งานสารบรรณ",
        summary: "การดำเนินงานสารบรรณ",
        unitKind: "work",
        sortOrder: 0,
        depth: 1
      },
      ancestors: [
        {
          contentId: "division",
          parentContentId: null,
          slug: "division",
          title: "ฝ่ายบริหาร",
          summary: "",
          unitKind: "division",
          sortOrder: 0,
          depth: 0
        }
      ],
      units: [
        {
          contentId: "work",
          parentContentId: "division",
          slug: "work",
          title: "งานสารบรรณ",
          summary: "การดำเนินงานสารบรรณ",
          unitKind: "work",
          sortOrder: 0,
          depth: 1
        },
        {
          contentId: "sub",
          parentContentId: "work",
          slug: "sub",
          title: "งานย่อย",
          summary: "",
          unitKind: "subunit",
          sortOrder: 0,
          depth: 2
        }
      ],
      positions: [
        {
          id: "p1",
          unitContentId: "work",
          title: "หัวหน้างาน",
          groupLabel: "ผู้บริหาร",
          groupSortOrder: 0,
          sortOrder: 0,
          displayStyle: "default",
          assignments: [
            {
              id: "a1",
              dutyDetail: "ประสานงาน",
              sortOrder: 0,
              person: {
                id: "person1",
                displayName: "บุคลากรตัวอย่าง",
                personnelType: "teacher",
                employmentPosition: "ครู",
                photoMediaId: null,
                publicEmail: "",
                publicPhone: ""
              }
            }
          ]
        }
      ],
      media: []
    };
    setup();
    expect(await screen.findByRole("heading", { name: "งานสารบรรณ" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "ลำดับหน่วยงาน" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ฝ่ายบริหาร" })).toHaveAttribute("href", "/organization/division");
    expect(screen.getByRole("heading", { name: "งานย่อย" })).toBeInTheDocument();
    expect(screen.getByText("หัวหน้างาน")).toBeInTheDocument();
    expect(screen.getByText("บุคลากรตัวอย่าง")).toBeInTheDocument();
    expect(screen.getByText("ประสานงาน")).toBeInTheDocument();
    expect(screen.queryByText(/อีเมล:|โทรศัพท์:/)).not.toBeInTheDocument();
  });

  it("does not invent personnel or positions when the published unit is empty", async () => {
    mock.data = {
      unit: {
        contentId: "work",
        parentContentId: null,
        slug: "work",
        title: "หน่วยงานว่าง",
        summary: "",
        unitKind: "work",
        sortOrder: 0,
        depth: 0
      },
      ancestors: [],
      units: [
        {
          contentId: "work",
          parentContentId: null,
          slug: "work",
          title: "หน่วยงานว่าง",
          summary: "",
          unitKind: "work",
          sortOrder: 0,
          depth: 0
        }
      ],
      positions: [],
      media: []
    };
    setup();
    expect(await screen.findByRole("heading", { name: "หน่วยงานว่าง" })).toBeInTheDocument();
    expect(screen.queryByText("หัวหน้างาน")).not.toBeInTheDocument();
  });
});
