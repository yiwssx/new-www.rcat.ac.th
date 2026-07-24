import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import App from "../../App";

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
    render(<App />);

    expect(await screen.findByRole("button", { name: /เข้าสู่ระบบ/ })).toBeInTheDocument();
  });

  it("protects the public documents admin route", async () => {
    window.history.pushState({}, "", "/admin/documents");

    render(<App />);

    const loginButton = await screen.findByRole("button", { name: /เข้าสู่ระบบ/ });

    expect(loginButton.textContent).toContain("เข้าสู่ระบบ");
  });
});
