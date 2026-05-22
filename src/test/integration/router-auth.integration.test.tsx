import { beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import App from "../../App";

describe("router + auth integration", () => {
  beforeEach(() => {
    cleanup();
    window.localStorage.clear();
    window.history.pushState({}, "", "/admin");
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
