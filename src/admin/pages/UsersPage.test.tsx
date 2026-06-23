import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import UsersPage from "./UsersPage";

vi.mock("../components/UserManagementCard", () => ({
  default: () => <section data-testid="user-management-card">User management</section>
}));

vi.mock("../../config/projectSettings", () => ({
  getGoogleAppsScriptUrl: () => ""
}));

describe("UsersPage", () => {
  it("hosts user management and scopes the Apps Script warning to legacy user CRUD", () => {
    render(<UsersPage />);

    expect(screen.getByRole("heading", { name: "ผู้ใช้" })).toBeInTheDocument();
    expect(screen.getByTestId("user-management-card")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Legacy user management");
    expect(screen.getByRole("alert")).toHaveTextContent("การจัดการผู้ใช้เดิมยังต้องใช้การเชื่อมต่อ Apps Script โดยตรง");
    expect(screen.getByRole("alert")).not.toHaveTextContent("production auth requires Apps Script");
  });
});
