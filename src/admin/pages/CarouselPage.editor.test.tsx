import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CarouselSlide, HomepageCarouselSettings, HomepageSettings, Session, User } from "../../types";
import { normalizeHomepageSettings } from "../../services/homepageSettings";
import CarouselPage from "./CarouselPage";

const authMock = vi.hoisted(() => ({
  role: "editor" as User["role"]
}));

const paginationMock = vi.hoisted(() => ({
  listHook: vi.fn(),
  getOrder: vi.fn(),
  saveOrder: vi.fn(),
  getMedia: vi.fn(),
  invalidateList: vi.fn(),
  setState: vi.fn(),
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

const publicInvalidationMock = vi.hoisted(() => ({
  invalidate: vi.fn()
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
      expiresAt: "2026-07-17T12:00:00.000Z"
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
    filters: {
      enabled: "all"
    },
    sortBy: "order",
    sortDirection: "asc",
    setState: paginationMock.setState,
    setPage: paginationMock.setPage,
    setPageSize: paginationMock.setPageSize,
    setSearch: paginationMock.setSearch,
    setFilter: paginationMock.setFilter,
    setSort: paginationMock.setSort
  }),
  useDebouncedValue: (value: unknown) => value,
  adminCarouselOrderQueryOptions: () => ({
    queryKey: ["task5-order"],
    queryFn: paginationMock.getOrder
  }),
  adminMediaListQueryOptions: () => ({
    queryKey: ["task5-media"],
    queryFn: paginationMock.getMedia
  }),
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

/*
 * Actual MUI controls are covered by:
 * - CarouselGlobalSettingsEditor.test.tsx
 * - CarouselSlidePresentationEditor.test.tsx
 *
 * This page-level test only verifies that editor callbacks are wired into
 * CarouselPage state and reach the existing API payloads. Keeping those
 * responsibilities separate makes the integration test deterministic on
 * slower Windows runners.
 */
vi.mock("../components/CarouselGlobalSettingsEditor", () => ({
  default: ({
    settings,
    dirty,
    onChange,
    onSave
  }: {
    settings: HomepageCarouselSettings;
    dirty: boolean;
    onChange: <K extends keyof HomepageCarouselSettings>(key: K, value: HomepageCarouselSettings[K]) => void;
    onSave: () => void;
  }) => (
    <section aria-label="Mock global carousel settings">
      <output data-testid="global-settings-transition">{settings.transition}</output>

      <button
        type="button"
        onClick={() => {
          onChange("autoplayIntervalSeconds", 9);
          onChange("showArrows", false);
          onChange("showDots", false);
          onChange("pauseOnHover", false);
          onChange("pauseOnFocus", false);
          onChange("transition", "fade");
        }}
      >
        Apply global carousel settings
      </button>

      <button type="button" disabled={!dirty} onClick={onSave}>
        บันทึกการตั้งค่า
      </button>
    </section>
  )
}));

vi.mock("../components/CarouselSlidePresentationEditor", () => ({
  CarouselSlidePresentationFields: ({
    onChange
  }: {
    onChange: <K extends keyof CarouselSlide>(key: K, value: CarouselSlide[K]) => void;
  }) => (
    <button
      type="button"
      onClick={() => {
        onChange("imageFit", "fill");
        onChange("mobileImageUrl", " https://cdn.example.test/open-house-mobile.jpg ");
        onChange("backgroundColor", "#ABCDEF");
        onChange("focalPointX", 35);
        onChange("focalPointY", 20);
        onChange("openInNewTab", true);
      }}
    >
      Apply responsive image controls
    </button>
  ),
  CarouselSlidePresentationPreview: ({ slide }: { slide: CarouselSlide }) => (
    <output
      data-testid="mock-carousel-preview"
      data-image-fit={slide.imageFit}
      data-mobile-image-url={slide.mobileImageUrl}
    />
  )
}));

const slide: CarouselSlide = {
  id: "slide-1",
  title: "Open house",
  subtitle: "",
  chip: "",
  imageUrl: "https://cdn.example.test/open-house.jpg",
  imageAlt: "Open house banner",
  buttonLabel: "",
  href: "https://example.test/open-house",
  imageFit: "fit-blur",
  focalPointX: 50,
  focalPointY: 50,
  mobileImageUrl: "",
  backgroundColor: "",
  openInNewTab: false,
  enabled: true,
  order: 1,
  updatedAt: "2026-07-17T09:00:00.000Z",
  revision: 3
};

function listResult() {
  return {
    data: {
      items: [slide],
      pagination: {
        page: 1,
        pageSize: 25,
        totalItems: 1,
        totalPages: 1,
        hasPreviousPage: false,
        hasNextPage: false
      },
      generatedAt: "2026-07-17T09:00:00.000Z"
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
    defaultOptions: {
      queries: {
        retry: false
      },
      mutations: {
        retry: false
      }
    }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <CarouselPage />
    </QueryClientProvider>
  );
}

describe("CarouselPage task 5 editor", () => {
  beforeEach(() => {
    authMock.role = "editor";

    paginationMock.listHook.mockReset();
    paginationMock.listHook.mockReturnValue(listResult());

    paginationMock.getOrder.mockReset();
    paginationMock.getOrder.mockResolvedValue([]);

    paginationMock.saveOrder.mockReset();

    paginationMock.getMedia.mockReset();
    paginationMock.getMedia.mockResolvedValue({
      items: [],
      pagination: {
        page: 1,
        pageSize: 24,
        totalItems: 0,
        totalPages: 1,
        hasPreviousPage: false,
        hasNextPage: false
      },
      generatedAt: "2026-07-17T09:00:00.000Z"
    });

    paginationMock.invalidateList.mockReset();
    paginationMock.invalidateList.mockResolvedValue(undefined);

    paginationMock.setState.mockReset();
    paginationMock.setPage.mockReset();
    paginationMock.setPageSize.mockReset();
    paginationMock.setSearch.mockReset();
    paginationMock.setFilter.mockReset();
    paginationMock.setSort.mockReset();

    carouselMock.saveSlide.mockReset();
    carouselMock.saveSlide.mockImplementation(async (input: Partial<CarouselSlide>) => ({
      ...slide,
      ...input,
      updatedAt: "2026-07-17T10:00:00.000Z"
    }));

    carouselMock.deleteSlide.mockReset();

    const homepageSettings = normalizeHomepageSettings();

    settingsMock.getHomepage.mockReset();
    settingsMock.getHomepage.mockResolvedValue(homepageSettings);

    settingsMock.saveHomepage.mockReset();
    settingsMock.saveHomepage.mockImplementation(async (input: HomepageSettings) => input);

    publicInvalidationMock.invalidate.mockReset();
    publicInvalidationMock.invalidate.mockResolvedValue(undefined);

    swalInstance.fire.mockReset();
    swalInstance.fire.mockResolvedValue({
      isConfirmed: true
    });

    swalInstance.close.mockReset();
    swalInstance.close.mockResolvedValue(undefined);

    swalInstance.showLoading.mockReset();
  });

  it("saves every global carousel runtime setting in one homepage payload", async () => {
    renderPage();

    await screen.findByText("Open house");

    fireEvent.click(
      screen.getByRole("button", {
        name: "Apply global carousel settings"
      })
    );

    await waitFor(() =>
      expect(
        screen.getByRole("button", {
          name: "บันทึกการตั้งค่า"
        })
      ).toBeEnabled()
    );

    expect(screen.getByTestId("global-settings-transition")).toHaveTextContent("fade");

    fireEvent.click(
      screen.getByRole("button", {
        name: "บันทึกการตั้งค่า"
      })
    );

    await waitFor(() => expect(settingsMock.saveHomepage).toHaveBeenCalledTimes(1));

    expect(settingsMock.saveHomepage).toHaveBeenCalledWith(
      expect.objectContaining({
        carousel: {
          autoplayEnabled: true,
          autoplayIntervalSeconds: 9,
          showArrows: false,
          showDots: false,
          pauseOnHover: false,
          pauseOnFocus: false,
          transition: "fade"
        }
      }),
      expect.anything()
    );
  }, 10_000);

  it("saves responsive image controls through the existing slide API", async () => {
    renderPage();

    await screen.findByText("Open house");

    fireEvent.click(
      screen.getByRole("button", {
        name: "แก้ไขสไลด์หน้าแรก Open house"
      })
    );

    await screen.findByRole("dialog", {
      name: "แก้ไขสไลด์หน้าแรก"
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: "Apply responsive image controls"
      })
    );

    expect(screen.getByTestId("mock-carousel-preview")).toHaveAttribute("data-image-fit", "fill");

    fireEvent.click(
      screen.getByRole("button", {
        name: "บันทึกสไลด์หน้าแรก"
      })
    );

    await waitFor(() => expect(carouselMock.saveSlide).toHaveBeenCalledTimes(1));

    expect(carouselMock.saveSlide).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "slide-1",
        imageFit: "fill",
        focalPointX: 35,
        focalPointY: 20,
        mobileImageUrl: "https://cdn.example.test/open-house-mobile.jpg",
        backgroundColor: "#abcdef",
        openInNewTab: true
      }),
      expect.anything()
    );
  }, 10_000);
});
