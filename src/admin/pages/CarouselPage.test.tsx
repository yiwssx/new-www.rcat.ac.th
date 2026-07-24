import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CarouselSlide, MediaAsset, Session, User } from "../../types";
import CarouselPage from "./CarouselPage";

const authMock = vi.hoisted(() => ({ role: "editor" as User["role"] }));

const paginationMock = vi.hoisted(() => ({
  listHook: vi.fn(),
  getOrder: vi.fn(),
  saveOrder: vi.fn(),
  getMedia: vi.fn(),
  mediaOptions: vi.fn(),
  invalidateList: vi.fn(),
  setPage: vi.fn(),
  setPageSize: vi.fn(),
  setSearch: vi.fn(),
  setFilter: vi.fn(),
  setSort: vi.fn()
}));

const carouselMock = vi.hoisted(() => ({
  saveSlide: vi.fn(),
  deleteSlide: vi.fn()
}));

const settingsMock = vi.hoisted(() => ({
  getHomepage: vi.fn(),
  saveHomepage: vi.fn()
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
    const session: Session = {
      user,
      token: "test-session-token",
      expiresAt: "2026-07-12T00:00:00.000Z"
    };
    return {
      session,
      capabilities: authMock.role === "viewer" ? [] : ["carousel.manage"],
      login: vi.fn(),
      logout: vi.fn()
    };
  }
}));

vi.mock("../../features/admin-pagination", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../features/admin-pagination")>()),
  useAdminCarouselListQuery: paginationMock.listHook,
  useAdminListUrlState: () => ({
    page: 1,
    pageSize: 25,
    q: "",
    filters: { enabled: "all" },
    sortBy: "order",
    sortDirection: "asc",
    setPage: paginationMock.setPage,
    setPageSize: paginationMock.setPageSize,
    setSearch: paginationMock.setSearch,
    setFilter: paginationMock.setFilter,
    setSort: paginationMock.setSort
  }),
  useDebouncedValue: (value: unknown) => value,
  adminCarouselOrderQueryOptions: () => ({
    queryKey: ["test-admin-orders", "carousel"],
    queryFn: paginationMock.getOrder
  }),
  adminMediaListQueryOptions: (request: unknown) => {
    paginationMock.mediaOptions(request);
    return {
      queryKey: ["test-admin-media", request],
      queryFn: paginationMock.getMedia
    };
  },
  saveAdminCarouselOrder: paginationMock.saveOrder,
  invalidateAdminListQueries: paginationMock.invalidateList
}));

vi.mock("../../features/cms-carousel", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../features/cms-carousel")>()),
  saveCarouselSlideToApi: carouselMock.saveSlide,
  deleteCarouselSlideFromApi: carouselMock.deleteSlide
}));

vi.mock("../../features/cms-settings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../features/cms-settings")>()),
  getHomepageSettingsFromApi: settingsMock.getHomepage,
  saveHomepageSettingsToApi: settingsMock.saveHomepage
}));

vi.mock("../../services/publicCmsInvalidation", () => ({
  invalidatePublicCmsData: publicInvalidationMock.invalidate
}));

const slideOne: CarouselSlide = {
  id: "slide-1",
  title: "Open house",
  subtitle: "Welcome students",
  chip: "",
  imageUrl: "https://cdn.example.test/open-house.jpg",
  imageAlt: "Open house banner",
  buttonLabel: "",
  href: "",
  imageFit: "fit-blur",
  focalPointX: 50,
  focalPointY: 50,
  mobileImageUrl: "",
  backgroundColor: "",
  openInNewTab: false,
  enabled: true,
  order: 1,
  updatedAt: "2026-07-12T09:00:00.000Z",
  revision: 3
};

const mediaAsset: MediaAsset = {
  id: "media-1",
  name: "Library image",
  type: "image",
  size: "1 MB",
  owner: "admin",
  driveUrl: "https://drive.example.test/library.jpg",
  previewUrl: "https://cdn.example.test/library.jpg",
  updatedAt: "2026-07-12T08:00:00.000Z"
};

function listResult() {
  return {
    data: {
      items: [slideOne],
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
      <CarouselPage />
    </QueryClientProvider>
  );
}

describe("CarouselPage paginated list, ordering, and media picker", { timeout: 15_000 }, () => {
  beforeEach(() => {
    authMock.role = "editor";
    paginationMock.listHook.mockReset();
    paginationMock.listHook.mockReturnValue(listResult());
    paginationMock.getOrder.mockReset();
    paginationMock.getOrder.mockResolvedValue([
      { id: "slide-1", title: "Open house", order: 1, enabled: true, revision: 3 },
      { id: "slide-2", title: "Admission", order: 2, enabled: true, revision: 6 }
    ]);
    paginationMock.saveOrder.mockReset();
    paginationMock.saveOrder.mockImplementation(async (items) => items);
    paginationMock.getMedia.mockReset();
    paginationMock.getMedia.mockResolvedValue({
      items: [mediaAsset],
      pagination: {
        page: 1,
        pageSize: 24,
        totalItems: 1,
        totalPages: 1,
        hasPreviousPage: false,
        hasNextPage: false
      },
      generatedAt: "2026-07-12T00:00:00.000Z"
    });
    paginationMock.mediaOptions.mockReset();
    paginationMock.invalidateList.mockReset();
    paginationMock.invalidateList.mockResolvedValue(undefined);
    paginationMock.setPage.mockReset();
    paginationMock.setPageSize.mockReset();
    paginationMock.setSearch.mockReset();
    paginationMock.setFilter.mockReset();
    paginationMock.setSort.mockReset();
    carouselMock.saveSlide.mockReset();
    carouselMock.saveSlide.mockResolvedValue(slideOne);
    carouselMock.deleteSlide.mockReset();
    settingsMock.getHomepage.mockReset();
    settingsMock.getHomepage.mockResolvedValue(undefined);
    settingsMock.saveHomepage.mockReset();
    publicInvalidationMock.invalidate.mockReset();
    publicInvalidationMock.invalidate.mockResolvedValue(undefined);
    swalInstance.fire.mockReset();
    swalInstance.fire.mockResolvedValue({ isConfirmed: true });
    swalInstance.close.mockReset();
    swalInstance.close.mockResolvedValue(undefined);
    swalInstance.showLoading.mockReset();
  });

  it("renders one server page with lazy slide imagery and delegates page changes to URL state", async () => {
    renderPage();

    expect(await screen.findByText("Open house")).toBeInTheDocument();
    expect(paginationMock.listHook).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, pageSize: 25, sortBy: "order", sortDirection: "asc" })
    );
    expect(screen.getByAltText("Open house banner")).toHaveAttribute("loading", "lazy");

    fireEvent.click(screen.getByRole("button", { name: "ไปหน้าที่ 2" }));
    expect(paginationMock.setPage).toHaveBeenCalledWith(2);
  });

  it("loads and saves the compact revision-bearing order only after ordering is opened", async () => {
    renderPage();

    await screen.findByText("Open house");
    expect(paginationMock.getOrder).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "จัดลำดับ" }));
    await waitFor(() => expect(paginationMock.getOrder).toHaveBeenCalledTimes(1));
    fireEvent.click(await screen.findByRole("button", { name: "เลื่อนลง Open house" }));
    fireEvent.click(screen.getByRole("button", { name: "บันทึกลำดับ" }));

    await waitFor(() =>
      expect(paginationMock.saveOrder).toHaveBeenCalledWith(
        [
          expect.objectContaining({ id: "slide-2", order: 1, revision: 6 }),
          expect.objectContaining({ id: "slide-1", order: 2, revision: 3 })
        ],
        expect.anything()
      )
    );
  });

  it("does not load media until the editor opens, then requests an image-only server page with lazy thumbnails", async () => {
    renderPage();

    await screen.findByText("Open house");
    expect(paginationMock.getMedia).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "แก้ไขสไลด์หน้าแรก Open house" }));

    await waitFor(() => expect(paginationMock.getMedia).toHaveBeenCalledTimes(1));
    expect(paginationMock.mediaOptions).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, pageSize: 24, type: "image", sortBy: "updatedAt", sortDirection: "desc" })
    );
    expect(await screen.findByAltText("Library image")).toHaveAttribute("loading", "lazy");
    expect(screen.getByDisplayValue(slideOne.imageUrl)).toBeInTheDocument();
  });
});
