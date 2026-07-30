import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import settingsPageSource from "../admin/pages/SettingsPage.tsx?raw";
import PublicMainMenu from "../public/components/PublicMainMenu";
import publicMainMenuSource from "../public/components/PublicMainMenu.tsx?raw";
import publicSiteShellSource from "../public/components/PublicSiteShell.tsx?raw";
import publicDocumentsPageSource from "../public/pages/PublicDocumentsPage.tsx?raw";

vi.mock("../public/hooks/usePublicCmsSnapshot", () => ({
  usePublicCmsSnapshot: () => ({ data: undefined, isLoading: false, isFetching: false, isError: false })
}));

beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("MUI 9 deprecated API migrations", () => {
  it("keeps migrated components free of the deprecated prop families", () => {
    expect(settingsPageSource).not.toMatch(/\b(?:InputProps|inputProps)\s*=/);
    expect(publicDocumentsPageSource).not.toMatch(/\b(?:InputProps|inputProps)\s*=/);
    expect(publicSiteShellSource).not.toMatch(/\bInputProps\s*=/);
    expect(publicMainMenuSource).not.toMatch(/\b(?:PaperProps|primaryTypographyProps)\s*=/);
  });

  it("keeps the compact menu keyboard-operable after the Drawer slot migration", async () => {
    const user = userEvent.setup();

    render(
      <PublicMainMenu
        preloadedMenu={[
          {
            id: "about",
            label: "About",
            href: "/about",
            enabled: true
          }
        ]}
      />
    );

    const openButton = screen.getAllByRole("button")[0];
    await user.tab();
    expect(openButton).toHaveFocus();
    await user.keyboard("{Enter}");

    const menuLink = await screen.findByRole("link", { name: "About" });
    expect(menuLink).toBeVisible();

    const buttons = screen.getAllByRole("button");
    const closeButton = buttons[buttons.length - 1];
    expect(closeButton).toBeDefined();
    await user.click(closeButton!);

    await waitFor(() => expect(menuLink).not.toBeVisible());
  });
});
