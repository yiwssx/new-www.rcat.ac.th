import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import FloatingMessengerButton from "../public/components/FloatingMessengerButton";

const messengerProps = {
  enabled: true,
  href: "https://m.me/rcat",
  label: "สอบถามข้อมูล"
};

afterEach(() => {
  window.history.replaceState({}, "", "/");
});

describe("FloatingMessengerButton dismissal", () => {
  it("hides the messenger control after the close button is pressed", () => {
    const { rerender } = render(<FloatingMessengerButton {...messengerProps} />);

    fireEvent.click(screen.getByRole("button", { name: "ปิดปุ่มแชท" }));

    expect(screen.queryByRole("link", { name: "สอบถามข้อมูลผ่าน Messenger" })).not.toBeInTheDocument();

    rerender(<FloatingMessengerButton {...messengerProps} />);

    expect(screen.queryByRole("link", { name: "สอบถามข้อมูลผ่าน Messenger" })).not.toBeInTheDocument();
  });

  it("shows the messenger control again after navigating to another route", () => {
    const { rerender } = render(<FloatingMessengerButton {...messengerProps} />);

    fireEvent.click(screen.getByRole("button", { name: "ปิดปุ่มแชท" }));
    window.history.pushState({}, "", "/news");

    rerender(<FloatingMessengerButton {...messengerProps} />);

    expect(screen.getByRole("link", { name: "สอบถามข้อมูลผ่าน Messenger" })).toBeInTheDocument();

    window.history.pushState({}, "", "/");
    rerender(<FloatingMessengerButton {...messengerProps} />);

    expect(screen.getByRole("link", { name: "สอบถามข้อมูลผ่าน Messenger" })).toBeInTheDocument();
  });

  it("shows the messenger control again after remounting, matching a page refresh", () => {
    const firstRender = render(<FloatingMessengerButton {...messengerProps} />);

    fireEvent.click(screen.getByRole("button", { name: "ปิดปุ่มแชท" }));
    firstRender.unmount();

    render(<FloatingMessengerButton {...messengerProps} />);

    expect(screen.getByRole("link", { name: "สอบถามข้อมูลผ่าน Messenger" })).toBeInTheDocument();
  });
});
