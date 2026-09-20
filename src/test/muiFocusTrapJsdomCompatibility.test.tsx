import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("MUI FocusTrap compatibility with jsdom focus fixup", () => {
  it("unmounts a dialog safely after jsdom restores focus to the document viewport", async () => {
    const trigger = document.createElement("button");
    trigger.textContent = "trigger";
    document.body.appendChild(trigger);
    trigger.focus();
    trigger.remove();

    const { unmount } = render(
      <Dialog open aria-label="compatibility dialog">
        <DialogContent>
          <button type="button">inside dialog</button>
        </DialogContent>
      </Dialog>
    );

    expect(await screen.findByRole("dialog", { name: "compatibility dialog" })).toBeInTheDocument();
    expect(() => unmount()).not.toThrow();
  });
});
