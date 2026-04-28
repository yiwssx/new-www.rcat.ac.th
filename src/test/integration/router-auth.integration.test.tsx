import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "../../App";
import { sessionEnded } from "../../store/authSlice";
import { store } from "../../store/store";

describe("router + auth integration", () => {
  beforeEach(() => {
    window.localStorage.clear();
    store.dispatch(sessionEnded());
    window.history.pushState({}, "", "/admin");
  });

  it("redirects unauthenticated admin visits to the login page", async () => {
    render(<App />);

    expect(await screen.findByRole("button", { name: /เข้าสู่ระบบ/ })).toBeInTheDocument();
  });
});
