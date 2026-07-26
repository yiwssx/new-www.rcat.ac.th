import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExternalServiceLink, User } from "../../types";
import ExternalServicesPage from "./ExternalServicesPage";

const authMock = vi.hoisted(() => ({ role: "editor" as User["role"] }));

const paginationMock = vi.hoisted(() => ({
  listHook: vi.fn(),
  getOrder: vi.fn(),
  saveOrder: vi.fn(),
  invalidateList: vi.fn(),
  setPage: vi.fn(),
  setPageSize: vi.fn(),
  setSearch: vi.fn(),
  setFilter: vi.fn(),
  setSort: vi.fn()
}));

const externalServicesMock = vi.hoisted(() => ({
  saveOne: vi.fn(),
  deleteOne: vi.fn(),
  saveBatch: vi.fn()
}));

const publicInvalidationMock = vi.hoisted(() => ({ invalidate: vi.fn() }));

const swalInstance = vi.hoisted(() => ({
  fire: vi.fn(),
  close: vi.fn(),
  showLoading: vi.fn()
}));

vi.mock("sweetalert2", () => ({
  default: { mixin: vi.fn(() => swalInstance) }
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
    const session = { user, capabilities: authMock.role === "admin" ? ["external-services.manage"] : [] };
    return {
      session,
      capabilities: authMock.role === "admin" ? ["external-services.manage"] : [],
      login: vi.fn(),
      logout: vi.fn()
    };
  }
}));

vi.mock("../../features/admin-pagination", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../features/admin-pagination")>()),
  useAdminExternalServiceListQuery: paginationMock.listHook,
  useAdminListUrlState: () => ({
    page: 1,
    pageSize: 25,
    q: "",
    filters: { enabled: "all", tone: "all" },
    sortBy: "order",
    sortDirection: "asc",
    setPage: paginationMock.setPage,
    setPageSize: paginationMock.setPageSize,
    setSearch: paginationMock.setSearch,
    setFilter: paginationMock.setFilter,
    setSort: paginationMock.setSort
  }),
  useDebouncedValue: (value: unknown) => value,
  adminExternalServiceOrderQueryOptions: () => ({
    queryKey: ["test-admin-orders", "external-services"],
    queryFn: paginationMock.getOrder
  }),
  saveAdminExternalServiceOrder: paginationMock.saveOrder,
  invalidateAdminListQueries: paginationMock.invalidateList
}));

vi.mock("../../features/cms-external-services", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../features/cms-external-services")>()),
  saveExternalServiceLinkToApi: externalServicesMock.saveOne,
  deleteExternalServiceLinkFromApi: externalServicesMock.deleteOne,
  saveExternalServiceLinksToApi: externalServicesMock.saveBatch
}));

vi.mock("../../services/publicCmsInvalidation", () => ({
  invalidatePublicCmsData: publicInvalidationMock.invalidate
}));

const serviceOne: ExternalServiceLink = {
  id: "service-1",
  title: "Student portal",
  description: "Student self-service",
  href: "https://service.example.test/student",
  tone: "student",
  iconKey: "apps",
  enabled: true,
  order: 1,
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
  order: 2,
  updatedAt: "2026-07-07T08:00:00.000Z",
  revision: 4
};

function listResult(items: ExternalServiceLink[] = [serviceOne, serviceTwo]) {
  return {
    data: {
      items,
      pagination: {
        page: 1,
        pageSize: 25,
        totalItems: 26,
        totalPages: 2,
        hasPreviousPage: false,
        hasNextPage: true
      },
      generatedAt: "2026-07-12T00:00:00.000Z"
    },
    isLoading: false,
    isFetching: false,
    isPlaceholderData: false,
    isError: false,
    error: null
  };
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ExternalServicesPage />
    </QueryClientProvider>
  );
}

describe("ExternalServicesPage paginated and compact ordering workflows", () => {
  beforeEach(() => {
    authMock.role = "admin";
    paginationMock.listHook.mockReset();
    paginationMock.listHook.mockReturnValue(listResult());
    paginationMock.getOrder.mockReset();
    paginationMock.getOrder.mockResolvedValue([
      { id: "service-1", title: "Student portal", order: 1, enabled: true, revision: 2 },
      { id: "service-2", title: "Teacher portal", order: 2, enabled: true, revision: 4 }
    ]);
    paginationMock.saveOrder.mockReset();
    paginationMock.saveOrder.mockImplementation(async (items) => items);
    paginationMock.invalidateList.mockReset();
    paginationMock.invalidateList.mockResolvedValue(undefined);
    paginationMock.setPage.mockReset();
    paginationMock.setPageSize.mockReset();
    paginationMock.setSearch.mockReset();
    paginationMock.setFilter.mockReset();
    paginationMock.setSort.mockReset();
    externalServicesMock.saveOne.mockReset();
    externalServicesMock.saveOne.mockResolvedValue(serviceOne);
    externalServicesMock.deleteOne.mockReset();
    externalServicesMock.deleteOne.mockResolvedValue({ id: serviceOne.id, deleted: true });
    externalServicesMock.saveBatch.mockReset();
    publicInvalidationMock.invalidate.mockReset();
    publicInvalidationMock.invalidate.mockResolvedValue(undefined);
    swalInstance.fire.mockReset();
    swalInstance.fire.mockResolvedValue({ isConfirmed: true });
    swalInstance.close.mockReset();
    swalInstance.close.mockResolvedValue(undefined);
    swalInstance.showLoading.mockReset();
  });

  it("renders one server page and changes pages through URL state", async () => {
    renderPage();

    expect(await screen.findByText("Student portal")).toBeInTheDocument();
    expect(screen.getByText("Teacher portal")).toBeInTheDocument();
    expect(paginationMock.listHook).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, pageSize: 25, sortBy: "order", sortDirection: "asc" })
    );

    fireEvent.click(screen.getByRole("button", { name: "ไปหน้าที่ 2" }));
    expect(paginationMock.setPage).toHaveBeenCalledWith(2);
  });

  it("saves an existing item individually and never sends the paginated slice to batch PUT", async () => {
    renderPage();

    await screen.findByText("Student portal");
    fireEvent.click(screen.getByRole("button", { name: "แก้ไขลิงก์ E-Service Student portal" }));
    fireEvent.change(screen.getByRole("textbox", { name: "ชื่อบริการ" }), {
      target: { value: "Updated student portal" }
    });
    fireEvent.click(screen.getByRole("button", { name: "บันทึกลิงก์ E-Service" }));

    await waitFor(() =>
      expect(externalServicesMock.saveOne).toHaveBeenCalledWith(
        expect.objectContaining({ id: "service-1", title: "Updated student portal", revision: 2 }),
        expect.anything()
      )
    );
    expect(externalServicesMock.saveBatch).not.toHaveBeenCalled();
  });

  it("deletes an individual item after confirmation", async () => {
    renderPage();

    await screen.findByText("Student portal");
    fireEvent.click(screen.getByRole("button", { name: "ลบลิงก์ E-Service Student portal" }));

    await waitFor(() => expect(externalServicesMock.deleteOne).toHaveBeenCalledWith("service-1", expect.anything()));
    expect(externalServicesMock.saveBatch).not.toHaveBeenCalled();
  });

  it("loads the compact global order only on demand and saves revision-bearing rows", async () => {
    renderPage();

    await screen.findByText("Student portal");
    expect(paginationMock.getOrder).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "จัดลำดับ" }));
    await waitFor(() => expect(paginationMock.getOrder).toHaveBeenCalledTimes(1));
    fireEvent.click(await screen.findByRole("button", { name: "เลื่อนลง Student portal" }));
    fireEvent.click(screen.getByRole("button", { name: "บันทึกลำดับ" }));

    await waitFor(() =>
      expect(paginationMock.saveOrder).toHaveBeenCalledWith(
        [
          expect.objectContaining({ id: "service-2", order: 1, revision: 4 }),
          expect.objectContaining({ id: "service-1", order: 2, revision: 2 })
        ],
        expect.anything()
      )
    );
    expect(externalServicesMock.saveBatch).not.toHaveBeenCalled();
  });

  it("allows viewers to paginate but hides every mutation and ordering control", async () => {
    authMock.role = "viewer";
    renderPage();

    await screen.findByText("Student portal");
    expect(screen.queryByRole("button", { name: "เพิ่มลิงก์บริการ" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "จัดลำดับ" })).not.toBeInTheDocument();
    expect(
      within(screen.getByText("Student portal").closest(".MuiCard-root") as HTMLElement).queryByLabelText(/แก้ไข/)
    ).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "ไปหน้าที่ 2" }));
    expect(paginationMock.setPage).toHaveBeenCalledWith(2);
  });
});
