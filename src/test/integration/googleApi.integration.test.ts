import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../config/projectSettings", () => ({
  getGoogleAppsScriptUrl: () => "https://script.google.com/macros/s/test/exec",
  projectSettings: {
    api: {
      googleAppsScriptUrl: "https://script.google.com/macros/s/test/exec",
      googleAppsScriptUrlEnv: "VITE_GOOGLE_APPS_SCRIPT_URL",
      resources: {
        snapshot: "snapshot",
        health: "health",
        authLogin: "auth-login",
        content: "content",
        contentDetail: "content-detail",
        deleteContent: "content-delete",
        media: "media",
        deleteMedia: "media-delete",
        publish: "publish",
        menu: "menu",
        event: "event",
        deleteEvent: "event-delete",
        displaySettings: "display-settings",
        users: "users",
        deleteUser: "users-delete",
        resetUsers: "users-reset",
        languageSource: "language-source"
      }
    }
  }
}));

import { getCmsSnapshot, saveCalendarEvent } from "../../services/googleApi";

describe("googleApi integration", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("loads snapshot data from Apps Script", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          metrics: [],
          content: [],
          media: [],
          events: [],
          menu: [],
          statusCode: 200
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    vi.stubGlobal("fetch", fetchMock);

    const snapshot = await getCmsSnapshot();

    expect(snapshot.metrics).toEqual([]);
    expect(snapshot.content).toEqual([]);
    expect(snapshot.menu).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("surfaces backend validation errors for event saves", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: "End date must be the same as or after the start date.",
          statusCode: 400
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      saveCalendarEvent({
        title: "Invalid event",
        date: "2026-05-01T12:00:00.000Z",
        endDate: "2026-05-01T09:00:00.000Z",
        audience: "Students",
        status: "confirmed"
      })
    ).rejects.toThrow("End date must be the same as or after the start date.");
  });
});
