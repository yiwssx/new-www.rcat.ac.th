import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import App from "../../App";
import { createAppRuntime } from "../../runtime";

function renderApp() {
  const runtime = createAppRuntime();
  render(
    <App emotionCache={runtime.emotionCache} queryClient={runtime.queryClient} router={runtime.router} />
  );
}

describe("router + auth integration", () => {
  beforeEach(() => {
    cleanup();
    window.localStorage.clear();
    window.history.pushState({}, "", "/admin");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ error: "CMS session is invalid or expired" }, { status: 401 }))
    );
  });

  it("redirects unauthenticated admin visits to the login page", async () => {
    renderApp();

    expect(await screen.findByRole("button", { name: /เข้าสู่ระบบ/ }, { timeout: 5_000 })).toBeInTheDocument();
  });

  it("protects the public documents admin route", async () => {
    window.history.pushState({}, "", "/admin/documents");

    renderApp();

    const loginButton = await screen.findByRole("button", { name: /เข้าสู่ระบบ/ }, { timeout: 5_000 });

    expect(loginButton.textContent).toContain("เข้าสู่ระบบ");
  });
});
