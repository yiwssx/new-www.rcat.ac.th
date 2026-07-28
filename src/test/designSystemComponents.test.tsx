import type { ReactNode } from "react";
import { Button, IconButton, TextField, ThemeProvider } from "@mui/material";
import CloseOutlinedIcon from "@mui/icons-material/CloseOutlined";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import ActionBar from "../design-system/components/ActionBar";
import FormActions from "../design-system/components/FormActions";
import PageHeader from "../design-system/components/PageHeader";
import ResponsiveDialogActions from "../design-system/components/ResponsiveDialogActions";
import SectionHeader from "../design-system/components/SectionHeader";
import SemanticStatusChip from "../design-system/components/SemanticStatusChip";
import { focusRingShadow, focusRingStyles, focusVisibleSx } from "../design-system/componentStyles";
import { designTokens } from "../design-system/tokens";
import PublicErrorState from "../public/components/PublicErrorState";
import PublicLoadingState from "../public/components/PublicLoadingState";
import EmptyState from "../shared/components/EmptyState";
import { theme } from "../theme";

afterEach(cleanup);

function withTheme(children: ReactNode) {
  return render(<ThemeProvider theme={theme}>{children}</ThemeProvider>);
}

function styleOverride(component: string, slot: string, ownerState: Record<string, unknown> = {}) {
  const components = theme.components as unknown as Record<
    string,
    {
      styleOverrides?: Record<
        string,
        Record<string, unknown> | ((input: { ownerState: Record<string, unknown> }) => Record<string, unknown>)
      >;
    }
  >;
  const styleOverrides = components[component]?.styleOverrides;
  const override = styleOverrides?.[slot];
  return typeof override === "function" ? override({ ownerState }) : override;
}

function hexToRgb(value: string) {
  const hex = value.replace("#", "");
  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);
  return `rgb(${red}, ${green}, ${blue})`;
}

describe("design-system theme policy", () => {
  it("owns interactive component dimensions and stable surfaces", () => {
    expect(theme.components?.MuiButton?.defaultProps?.disableElevation).toBe(true);
    expect(styleOverride("MuiButton", "root")?.minHeight).toBe(designTokens.control.comfortableHeight);
    expect(styleOverride("MuiButton", "sizeSmall")?.minHeight).toBe(designTokens.control.compactHeight);
    expect(styleOverride("MuiIconButton", "root")?.width).toBe(designTokens.control.iconButtonTarget);
    expect(styleOverride("MuiOutlinedInput", "root")?.minHeight).toBe(designTokens.control.inputHeight);
    expect(styleOverride("MuiCard", "root")?.borderRadius).toBe(designTokens.radius.medium);
    expect(styleOverride("MuiCard", "root")?.boxShadow).toBe(designTokens.elevation.low);
    expect(styleOverride("MuiPaper", "elevation8")?.boxShadow).toBe(designTokens.elevation.overlay);
    expect(styleOverride("MuiDialogActions", "root")?.flexWrap).toBe("wrap");
    expect(styleOverride("MuiChip", "root")?.borderRadius).toBe(designTokens.radius.pill);
  });

  it("applies canonical contextual focus and secondary accent roles", () => {
    expect(focusRingStyles.boxShadow).toBe(focusRingShadow);
    expect(focusRingShadow).toContain(designTokens.color.focusSeparation);
    expect(focusRingShadow).toContain(designTokens.color.focusRing);
    expect(focusVisibleSx).toEqual({
      "&:focus-visible, &:focus-visible:hover": focusRingStyles
    });
    expect(styleOverride("MuiButton", "containedSecondary")?.color).toBe(designTokens.color.textOnAccent);
    expect(styleOverride("MuiButton", "outlinedSecondary")?.color).toBe(designTokens.color.accentForeground);
    expect(styleOverride("MuiButton", "outlinedSecondary")?.borderColor).toBe(designTokens.color.accentForeground);
    expect(styleOverride("MuiButton", "textSecondary")?.color).toBe(designTokens.color.accentForeground);
    expect(styleOverride("MuiChip", "filledSecondary")?.color).toBe(designTokens.color.textOnAccent);
    expect(styleOverride("MuiChip", "outlinedSecondary")?.color).toBe(designTokens.color.accentForeground);
    expect(styleOverride("MuiChip", "outlinedSecondary")?.borderColor).toBe(designTokens.color.accentForeground);
  });

  it("preserves IconButton color roles while keeping inherited top-bar controls white", () => {
    withTheme(
      <div style={{ color: "rgb(255, 255, 255)" }}>
        <IconButton color="inherit" aria-label="Facebook">
          <CloseOutlinedIcon />
        </IconButton>
        <IconButton aria-label="ค่าเริ่มต้น">
          <CloseOutlinedIcon />
        </IconButton>
        <IconButton color="primary" aria-label="หลัก">
          <CloseOutlinedIcon />
        </IconButton>
        <IconButton color="error" aria-label="ข้อผิดพลาด">
          <CloseOutlinedIcon />
        </IconButton>
      </div>
    );

    const inheritedButton = screen.getByRole("button", { name: "Facebook" });
    expect(getComputedStyle(inheritedButton).color).toBe("inherit");
    expect(getComputedStyle(inheritedButton.parentElement as Element).color).toBe("rgb(255, 255, 255)");
    expect(getComputedStyle(screen.getByRole("button", { name: "ค่าเริ่มต้น" })).color).toBe(
      hexToRgb(designTokens.color.textSecondary)
    );
    expect(getComputedStyle(screen.getByRole("button", { name: "หลัก" })).color).toBe(
      hexToRgb(theme.palette.primary.main)
    );
    expect(getComputedStyle(screen.getByRole("button", { name: "ข้อผิดพลาด" })).color).toBe(
      hexToRgb(theme.palette.error.main)
    );
    expect(styleOverride("MuiIconButton", "root", { color: "inherit" })).not.toHaveProperty("color");
    expect(styleOverride("MuiIconButton", "root", { color: "default" })?.color).toBe(designTokens.color.textSecondary);
    expect(styleOverride("MuiIconButton", "root", { color: "primary" })).not.toHaveProperty("color");
    expect(styleOverride("MuiIconButton", "root", { color: "error" })).not.toHaveProperty("color");
    expect(
      styleOverride("MuiIconButton", "root", { color: "inherit" })?.["&:focus-visible, &:focus-visible:hover"]
    ).toEqual(focusRingStyles);
  });

  it("keeps table text readable without character-by-character heading breaks", () => {
    expect(styleOverride("MuiTableCell", "root")).toMatchObject({
      overflowWrap: "break-word",
      wordBreak: "normal"
    });
    expect(styleOverride("MuiTableCell", "head")).toMatchObject({
      overflowWrap: "normal",
      wordBreak: "normal",
      whiteSpace: "normal"
    });
  });

  it("keeps buttons, IconButtons, and fields accessible by default", () => {
    withTheme(
      <>
        <Button size="small">บันทึก</Button>
        <IconButton size="small" aria-label="ปิด">
          <CloseOutlinedIcon />
        </IconButton>
        <TextField label="ชื่อเรื่อง" />
      </>
    );

    expect(screen.getByRole("button", { name: "บันทึก" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ปิด" })).toHaveAccessibleName("ปิด");
    expect(screen.getByRole("textbox", { name: "ชื่อเรื่อง" })).toBeInTheDocument();
  });
});

describe("shared design-system primitives", () => {
  it("preserves heading hierarchy and wraps long Thai content", () => {
    const longThaiTitle = "แนวทางการบริหารจัดการเนื้อหาสำหรับวิทยาลัยเกษตรและเทคโนโลยีที่มีข้อความภาษาไทยยาวต่อเนื่อง";
    withTheme(
      <>
        <PageHeader title={longThaiTitle} description="คำอธิบายหน้า" action={<Button>สร้างรายการ</Button>} />
        <SectionHeader title="หัวข้อส่วน" description="รายละเอียดส่วน" action={<Button>ดูทั้งหมด</Button>} />
      </>
    );

    expect(screen.getByRole("heading", { level: 1, name: longThaiTitle })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "หัวข้อส่วน" })).toBeInTheDocument();
    expect(screen.getByText(longThaiTitle)).toHaveStyle({ overflowWrap: "anywhere" });
  });

  it("provides predictable responsive action groups and dialog actions", () => {
    withTheme(
      <>
        <ActionBar primary={<Button>ค้นหา</Button>} secondary={<Button>ล้างตัวกรอง</Button>} />
        <FormActions primary={<Button>บันทึก</Button>} secondary={<Button>ยกเลิก</Button>} />
        <ResponsiveDialogActions>
          <Button>ปิด</Button>
          <Button>ยืนยัน</Button>
        </ResponsiveDialogActions>
      </>
    );

    expect(screen.getByRole("region", { name: "เครื่องมือและตัวกรอง" })).toBeInTheDocument();
    expect(screen.getByText("ยกเลิก").compareDocumentPosition(screen.getByText("บันทึก"))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
    expect(document.querySelector('[data-design-system-primitive="responsive-dialog-actions"]')).toBeInTheDocument();
  });

  it("keeps status, empty, loading, and error feedback semantic", () => {
    withTheme(
      <>
        <SemanticStatusChip label="เผยแพร่แล้ว" status="published" />
        <EmptyState title="ยังไม่มีข้อมูล" description="เพิ่มข้อมูลเพื่อเริ่มต้น" />
        <PublicLoadingState variant="simple" />
        <PublicErrorState />
      </>
    );

    expect(screen.getByText("เผยแพร่แล้ว").closest("[data-semantic-status]")).toHaveAttribute(
      "data-semantic-status",
      "published"
    );
    expect(screen.getByRole("region", { name: "ยังไม่มีข้อมูล" })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Preparing page" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("ไม่สามารถโหลดข้อมูลได้");
    expect(document.querySelector('[data-cls-region="public-loading"] [tabindex]')).not.toBeInTheDocument();
  });
});
