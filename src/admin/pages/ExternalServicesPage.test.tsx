import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CmsSnapshot, ExternalServiceLink, Session, User } from "../../types";
import ExternalServicesPage from "./ExternalServicesPage";

const authMock = vi.hoisted(() => ({
  role: "editor" as User["role"]
}));

const dashboardMock = vi.hoisted(() => ({
  getAdminCmsSnapshot: vi.fn()
}));

const externalServicesMock = vi.hoisted(() => ({
  saveExternalServiceLinkToApi: vi.fn(),
  saveExternalServiceLinksToApi: vi.fn(),
  deleteExternalServiceLinkFromApi: vi.fn()
}));

const publicCacheMock = vi.hoisted(() => ({
  clearPublicCmsCache: vi.fn()
}));

const swalInstance = vi.hoisted(() => ({
  fire: vi.fn(),
  close: vi.fn(),
  showLoading: vi.fn()
}));

vi.mock("sweetalert2", () => ({
  default: {
    mixin: vi.fn(() => swalInstance)
  }
}));

vi.mock("sweetalert2/dist/sweetalert2.min.css", () => ({}));

vi.mock("../../context/authSessionContext", () => ({
  useAuth: () => {
    const user: User = {
      id: `cloudflare-${authMock.role}`,
      name: `Cloudflare ${authMock.role}`,
      email: `${authMock.role}@example.invalid`,
      role: authMock.role
    };
    const session: Session = {
      user,
      token: "test-session-token",
      expiresAt: "2026-07-07T00:00:00.000Z"
    };

    return {
      session,
      login: vi.fn(),
      logout: vi.fn()
    };
  }
}));

vi.mock("../../features/cms-dashboard", () => ({
  getAdminCmsSnapshot: dashboardMock.getAdminCmsSnapshot
}));

vi.mock("../../features/cms-external-services", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../features/cms-external-services")>()),
  saveExternalServiceLinkToApi: externalServicesMock.saveExternalServiceLinkToApi,
  saveExternalServiceLinksToApi: externalServicesMock.saveExternalServiceLinksToApi,
  deleteExternalServiceLinkFromApi: externalServicesMock.deleteExternalServiceLinkFromApi
}));

vi.mock("../../services/publicCmsCache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../services/publicCmsCache")>()),
  clearPublicCmsCache: publicCacheMock.clearPublicCmsCache
}));

const serviceOne: ExternalServiceLink = {
  id: "service-1",
  title: "Student portal",
  description: "Student self-service",
  href: "https://service.example.test/student",
  tone: "student",
  iconKey: "apps",
  enabled: true,
  order: 7,
  updatedAt: "2026-07-07T09:00:00.000Z",
  revision: 2
};

const serviceTwo: ExternalServiceLink = {
  id: "service-2",
  title: "Teacher portal",
  description: "Teacher service",
  href: "https://service.example.test/teacher",
  tone: "learning",
  iconKey: "school",
  enabled: true,
  order: 7,
  updatedAt: "2026-07-07T08:00:00.000Z",
  revision: 4
};

function snapshot(externalServices: ExternalServiceLink[] = [serviceTwo, serviceOne]): CmsSnapshot {
  return {
    metrics: [],
    content: [],
    documents: [],
    media: [],
    events: [],
    menu: [],
    carouselSlides: [],
    externalServices
  };
}

function renderExternalServicesPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ExternalServicesPage />
    </QueryClientProvider>
  );
}

function findSwalCall(predicate: (options: Record<string, unknown>) => boolean) {
  const call = swalInstance.fire.mock.calls.find(([options]) => {
    if (!options || typeof options !== "object") {
      return false;
    }

    return predicate(options as Record<string, unknown>);
  });

  return call?.[0] as Record<string, unknown> | undefined;
}

describe("ExternalServicesPage flat ordering workflow", () => {
  beforeEach(() => {
    authMock.role = "editor";
    dashboardMock.getAdminCmsSnapshot.mockReset();
    dashboardMock.getAdminCmsSnapshot.mockResolvedValue(snapshot());
    externalServicesMock.saveExternalServiceLinkToApi.mockReset();
    externalServicesMock.deleteExternalServiceLinkFromApi.mockReset();
    externalServicesMock.saveExternalServiceLinksToApi.mockReset();
    externalServicesMock.saveExternalServiceLinksToApi.mockImplementation(async (items: ExternalServiceLink[]) =>
      items.map((item, index) => ({
        ...item,
        id: item.id || `service-new-${index + 1}`,
        updatedAt: "2026-07-07T10:00:00.000Z",
        revision: item.revision ?? 0
      }))
    );
    publicCacheMock.clearPublicCmsCache.mockReset();
    swalInstance.fire.mockReset();
    swalInstance.fire.mockResolvedValue({ isConfirmed: true });
    swalInstance.close.mockReset();
    swalInstance.close.mockResolvedValue(undefined);
    swalInstance.showLoading.mockReset();
  });

  it("normalizes duplicate loaded order values and does not render a numeric order field", async () => {
    renderExternalServicesPage();

    await screen.findByText("Student portal");

    expect(screen.getByText("ลำดับ 1")).toBeInTheDocument();
    expect(screen.getByText("ลำดับ 2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "แก้ไขลิงก์ E-Service Student portal" }));

    expect(screen.queryByRole("spinbutton", { name: "ลำดับ" })).not.toBeInTheDocument();
  });

  it("edits an existing draft item and batch save keeps the same item count and id", async () => {
    renderExternalServicesPage();

    await screen.findByText("Student portal");
    fireEvent.click(screen.getByRole("button", { name: "แก้ไขลิงก์ E-Service Student portal" }));
    fireEvent.change(screen.getByRole("textbox", { name: "ชื่อบริการ" }), {
      target: { value: "Updated student portal" }
    });
    fireEvent.click(screen.getByRole("button", { name: "บันทึกลิงก์ E-Service" }));

    expect(await screen.findByText("Updated student portal")).toBeInTheDocument();
    expect(screen.queryByText("Student portal")).not.toBeInTheDocument();
    expect(externalServicesMock.saveExternalServiceLinkToApi).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "บันทึก E-Service" }));

    await waitFor(() => expect(externalServicesMock.saveExternalServiceLinksToApi).toHaveBeenCalledTimes(1));
    expect(externalServicesMock.saveExternalServiceLinksToApi.mock.calls[0]?.[0]).toEqual([
      expect.objectContaining({ id: "service-1", title: "Updated student portal", order: 1 }),
      expect.objectContaining({ id: "service-2", order: 2 })
    ]);
  });

  it("moves draft items up and down while disabling boundary controls", async () => {
    renderExternalServicesPage();

    await screen.findByText("Student portal");

    expect(screen.getByRole("button", { name: "เลื่อนขึ้น Student portal" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "เลื่อนลง Teacher portal" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "เลื่อนลง Student portal" }));
    fireEvent.click(screen.getByRole("button", { name: "บันทึก E-Service" }));

    await waitFor(() => expect(externalServicesMock.saveExternalServiceLinksToApi).toHaveBeenCalledTimes(1));
    expect(externalServicesMock.saveExternalServiceLinksToApi.mock.calls[0]?.[0]).toEqual([
      expect.objectContaining({ id: "service-2", order: 1 }),
      expect.objectContaining({ id: "service-1", order: 2 })
    ]);
  });

  it("adds a new draft item and sends it through the batch save without a persisted id", async () => {
    renderExternalServicesPage();

    await screen.findByText("Student portal");
    fireEvent.click(screen.getByRole("button", { name: "เพิ่มลิงก์บริการ" }));
    fireEvent.change(screen.getByRole("textbox", { name: "ชื่อบริการ" }), {
      target: { value: "Admission service" }
    });
    fireEvent.change(screen.getByRole("textbox", { name: "URL บริการ" }), {
      target: { value: "https://service.example.test/admission" }
    });
    fireEvent.click(screen.getByRole("button", { name: "บันทึกลิงก์ E-Service" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "บันทึก E-Service" }));

    await waitFor(() => expect(externalServicesMock.saveExternalServiceLinksToApi).toHaveBeenCalledTimes(1));
    const savedItems = externalServicesMock.saveExternalServiceLinksToApi.mock.calls[0]?.[0] as ExternalServiceLink[];

    expect(savedItems).toHaveLength(3);
    expect(savedItems[2]).toEqual(
      expect.objectContaining({
        title: "Admission service",
        href: "https://service.example.test/admission",
        order: 3
      })
    );
    expect(savedItems[2].id).toBe("");
  });

  it("removes a draft item and batch save omits it", async () => {
    renderExternalServicesPage();

    await screen.findByText("Student portal");
    fireEvent.click(screen.getByRole("button", { name: "ลบลิงก์ E-Service Student portal" }));
    fireEvent.click(screen.getByRole("button", { name: "บันทึก E-Service" }));

    await waitFor(() => expect(externalServicesMock.saveExternalServiceLinksToApi).toHaveBeenCalledTimes(1));
    expect(externalServicesMock.saveExternalServiceLinksToApi.mock.calls[0]?.[0]).toEqual([
      expect.objectContaining({ id: "service-2", order: 1 })
    ]);
  });

  it("keeps the draft intact and shows an error modal when batch save fails", async () => {
    externalServicesMock.saveExternalServiceLinksToApi.mockRejectedValue(new Error("D1 unavailable"));
    renderExternalServicesPage();

    await screen.findByText("Student portal");
    fireEvent.click(screen.getByRole("button", { name: "แก้ไขลิงก์ E-Service Student portal" }));
    fireEvent.change(screen.getByRole("textbox", { name: "ชื่อบริการ" }), {
      target: { value: "Draft survives failed save" }
    });
    fireEvent.click(screen.getByRole("button", { name: "บันทึกลิงก์ E-Service" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "บันทึก E-Service" }));

    expect(await screen.findByText("Draft survives failed save")).toBeInTheDocument();
    await waitFor(() => {
      expect(findSwalCall((options) => options.title === "ไม่สามารถบันทึก E-Service ได้")).toEqual(
        expect.objectContaining({
          icon: "error",
          text: "D1 unavailable",
          confirmButtonText: "ตกลง"
        })
      );
    });
  });

  it("keeps read-only users from editing the flat list", async () => {
    authMock.role = "viewer";
    renderExternalServicesPage();

    await screen.findByText("Student portal");
    expect(screen.queryByRole("button", { name: "บันทึก E-Service" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "เพิ่มลิงก์บริการ" })).not.toBeInTheDocument();
    expect(
      within(screen.getByText("Student portal").closest(".MuiCard-root") as HTMLElement).queryByLabelText(/แก้ไข/)
    ).toBeNull();
  });
});
