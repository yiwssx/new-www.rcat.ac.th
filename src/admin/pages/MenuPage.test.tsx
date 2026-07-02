import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicMenuItem, Session, User } from "../../types";
import MenuPage from "./MenuPage";

const authMock = vi.hoisted(() => ({
  role: "admin" as User["role"]
}));

const navigationMock = vi.hoisted(() => ({
  getPublicMenuItems: vi.fn(),
  savePublicMenuItems: vi.fn()
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
      expiresAt: "2026-06-23T00:00:00.000Z"
    };

    return {
      session,
      login: vi.fn(),
      logout: vi.fn()
    };
  }
}));

vi.mock("../../features/cms-navigation", () => ({
  getPublicMenuItems: navigationMock.getPublicMenuItems,
  savePublicMenuItems: navigationMock.savePublicMenuItems
}));

const menuItems: PublicMenuItem[] = [
  {
    id: "menu-news",
    label: "ข่าวสาร",
    href: "/news",
    enabled: true
  }
];

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

function renderMenuPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MenuPage />
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

describe("MenuPage operation feedback", () => {
  beforeEach(() => {
    authMock.role = "admin";
    navigationMock.getPublicMenuItems.mockReset();
    navigationMock.getPublicMenuItems.mockResolvedValue(menuItems);
    navigationMock.savePublicMenuItems.mockReset();
    navigationMock.savePublicMenuItems.mockResolvedValue(menuItems);
    swalInstance.fire.mockReset();
    swalInstance.fire.mockResolvedValue({ isConfirmed: true });
    swalInstance.close.mockReset();
    swalInstance.close.mockResolvedValue(undefined);
    swalInstance.showLoading.mockReset();
  });

  it("shows loading and an acknowledged success modal when publishing the menu", async () => {
    const save = deferred<PublicMenuItem[]>();
    navigationMock.savePublicMenuItems.mockReturnValue(save.promise);
    renderMenuPage();

    await screen.findByText("ข่าวสาร");
    fireEvent.click(screen.getByRole("button", { name: "บันทึกเมนู" }));

    await waitFor(() => expect(navigationMock.savePublicMenuItems).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "กำลังบันทึก" })).toBeDisabled();
    expect(findSwalCall((options) => options.title === "กำลังบันทึกเมนู")).toEqual(
      expect.objectContaining({
        showConfirmButton: false,
        allowOutsideClick: false,
        allowEscapeKey: false
      })
    );

    save.resolve(menuItems);

    let successModal: Record<string, unknown> | undefined;
    await waitFor(() => {
      successModal = findSwalCall((options) => options.title === "บันทึกเมนูสำเร็จ");
      expect(successModal).toEqual(
        expect.objectContaining({
          icon: "success",
          title: "บันทึกเมนูสำเร็จ",
          confirmButtonText: "ตกลง"
        })
      );
    });
    expect(successModal).not.toHaveProperty("toast");
    expect(successModal).not.toHaveProperty("timer");
  });

  it("confirms before clearing the menu draft", async () => {
    renderMenuPage();

    await screen.findByText("ข่าวสาร");
    fireEvent.click(screen.getByRole("button", { name: "ล้างแบบร่าง" }));

    await waitFor(() =>
      expect(findSwalCall((options) => options.title === "ล้างแบบร่างเมนู?")).toEqual(
        expect.objectContaining({
          icon: "warning",
          title: "ล้างแบบร่างเมนู?",
          text: "รายการเมนูที่แก้ไขไว้ในหน้านี้จะถูกล้างออก",
          showCancelButton: true,
          confirmButtonText: "ล้างแบบร่าง",
          cancelButtonText: "ยกเลิก"
        })
      )
    );
  });
});
