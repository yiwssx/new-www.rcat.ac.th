import { describe, expect, it, vi } from "vitest";
import { hashPassword, isTokenExpired, login, restoreSession } from "./auth";

vi.mock("./users", () => ({
  authenticateUser: vi.fn(async (email: string) => ({
    id: "user-test",
    name: "Test User",
    email,
    role: "admin",
    status: "active",
    passwordHash: "$2a$08$test",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z"
  }))
}));

describe("auth service", () => {
  it("creates a session token for an authenticated user", async () => {
    const session = await login("admin@example.com", "password");

    expect(session.user.email).toBe("admin@example.com");
    expect(session.token.split(".")).toHaveLength(3);
    expect(isTokenExpired(session.token, session.expiresAt)).toBe(false);
  });

  it("hashes passwords with bcrypt", async () => {
    const hash = await hashPassword("password");

    expect(hash).not.toBe("password");
    expect(hash.startsWith("$2")).toBe(true);
  });

  it("restores a saved session payload", async () => {
    const session = await login("admin@example.com", "password");

    expect(restoreSession(JSON.stringify(session))).toEqual(session);
    expect(restoreSession("bad-json")).toBeNull();
  });
});
