import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PublicOrganizationDetailPage from "./PublicOrganizationDetailPage";

const mock = vi.hoisted(() => ({ data: null as unknown, index: [] as unknown[] }));
vi.mock("../../features/public-organization", () => ({
  getPublicOrganizationIndex: async () => mock.index,
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
  mock.index = [];
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
    expect(await screen.findByRole("heading", { level: 1, name: "งานสารบรรณ" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "ลำดับหน่วยงาน" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ฝ่ายบริหาร" })).toHaveAttribute("href", "/organization/division");
    expect(screen.getByRole("region", { name: "ผังลำดับชั้นหน่วยงาน เลื่อนแนวนอนได้" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "งานย่อย" })).toHaveAttribute("href", "/organization/sub");
    expect(screen.getByText("หัวหน้างาน")).toBeInTheDocument();
    expect(screen.getByText("บุคลากรตัวอย่าง")).toBeInTheDocument();
    expect(screen.queryByText("ประสานงาน")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "ดูรายละเอียด บุคลากรตัวอย่าง" }));
    expect(screen.getByText("ประสานงาน")).toBeInTheDocument();
    expect(screen.queryByText(/อีเมล:|โทรศัพท์:/)).not.toBeInTheDocument();
  });

  it("only renders supplied qualifications in a department position", async () => {
    const baseUnit = {
      contentId: "dept",
      parentContentId: null,
      slug: "dept",
      title: "แผนกวิชา",
      summary: "",
      unitKind: "department",
      sortOrder: 0,
      depth: 0
    };
    const position = {
      id: "position-1",
      unitContentId: "dept",
      title: "ครู",
      groupLabel: "",
      groupSortOrder: 0,
      sortOrder: 0,
      displayStyle: "default",
      assignments: [
        {
          id: "a-1",
          dutyDetail: "",
          sortOrder: 0,
          person: {
            id: "person-1",
            displayName: "ครู ทดสอบ",
            personnelType: "ครู",
            employmentPosition: "ครู",
            educationQualifications: "ปริญญาโท",
            photoMediaId: null,
            publicEmail: "",
            publicPhone: ""
          }
        }
      ]
    };
    mock.data = { unit: baseUnit, ancestors: [], units: [baseUnit], positions: [position], media: [] };
    const screenDepartment = setup();
    expect(await screen.findByText("ครู ทดสอบ")).toBeInTheDocument();
    expect(screen.queryByText(/วุฒิการศึกษา: ปริญญาโท/)).not.toBeInTheDocument();
    expect(screen.getAllByText("ครู")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "ดูรายละเอียด ครู ทดสอบ" }));
    expect(screen.getByText("ปริญญาโท")).toBeInTheDocument();
    // Selected department is already identified by the page H1; no one-unit diagram above people.
    expect(screen.getAllByRole("heading", { name: "แผนกวิชา" })).toHaveLength(1);
    expect(screen.queryByRole("region", { name: "ผังลำดับชั้นหน่วยงาน เลื่อนแนวนอนได้" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "ผังบุคลากร" })).not.toBeInTheDocument();
    screenDepartment.unmount();
    const workUnit = { ...baseUnit, unitKind: "work" };
    mock.data = { unit: workUnit, ancestors: [], units: [workUnit], positions: [position], media: [] };
    setup();
    expect(await screen.findByText("ครู ทดสอบ")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "ดูรายละเอียด ครู ทดสอบ" }));
    expect(screen.queryByText(/วุฒิการศึกษา: ปริญญาโท/)).not.toBeInTheDocument();
  });

  it("lists independently published departments under academic division without leaking their people", async () => {
    const academic = {
      contentId: "academic",
      parentContentId: null,
      slug: "academic",
      title: "ฝ่ายวิชาการ",
      summary: "",
      unitKind: "division",
      sortOrder: 0,
      depth: 0
    };
    const work = {
      ...academic,
      contentId: "teaching-support",
      parentContentId: "academic",
      unitKind: "work",
      title: "งานหลักสูตร",
      slug: "teaching-support"
    };
    mock.data = {
      unit: academic,
      ancestors: [],
      units: [academic, work],
      positions: [],
      media: []
    };
    mock.index = [
      academic,
      work,
      { ...academic, contentId: "dept-root", unitKind: "department", title: "แผนกวิชาบริหารธุรกิจ", slug: "business" },
      { ...academic, contentId: "unpublished", unitKind: "program", title: "ไม่ใช่แผนกวิชา", slug: "program" }
    ];
    setup();
    const link = await screen.findByRole("link", { name: "แผนกวิชาบริหารธุรกิจ" });
    expect(link).toHaveAttribute("href", "/organization/business");
    expect(screen.queryByText("บุคลากรจากหน่วยงานอื่น")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "งานหลักสูตร" })).toBeInTheDocument();
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
