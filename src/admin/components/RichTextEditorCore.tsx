import { ChangeEvent, MouseEvent, useEffect, useRef, useState } from "react";
import type { Extensions } from "@tiptap/core";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { EditorContent, useEditor } from "@tiptap/react";
import { Bold } from "@tiptap/extension-bold";
import { Document } from "@tiptap/extension-document";
import { HardBreak } from "@tiptap/extension-hard-break";
import { Heading } from "@tiptap/extension-heading";
import { Italic } from "@tiptap/extension-italic";
import { Paragraph } from "@tiptap/extension-paragraph";
import { Text } from "@tiptap/extension-text";
import { UndoRedo } from "@tiptap/extensions";
import { RichTextDocument, normalizeRichTextDocument } from "../../utils/contentBlocks";
import { normalizeSafeHref } from "../../utils/safeUrl";
import { designTokens } from "../../design-system/tokens";
import RichTextMediaPickerDialog from "./RichTextMediaPickerDialog";
import type { RichTextExternalInsertRequest, RichTextMediaInsertKind } from "./richTextInsert";

export interface RichTextEditorCoreProps {
  value: RichTextDocument;
  onChange: (value: RichTextDocument) => void;
  onInsertBlock?: (request: RichTextExternalInsertRequest) => void;
  additionalExtensions?: Extensions;
  advancedSupportEnabled?: boolean;
  pendingAdvancedCommand?: PendingAdvancedCommand | null;
  onRequestAdvancedSupport?: (request: PendingAdvancedCommand) => void;
  onAdvancedCommandApplied?: () => void;
}

interface ToolbarButtonProps {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

type InternalInsertCommand = "table" | "horizontalRule";

export type AdvancedEditorCommand =
  | { type: "underline" }
  | { type: "strike" }
  | { type: "color"; value: string }
  | { type: "highlight"; value: string }
  | { type: "textAlign"; value: "left" | "center" | "right" | "justify" }
  | { type: "bulletList" }
  | { type: "orderedList" }
  | { type: "blockquote" }
  | { type: "linkDialog" }
  | { type: "table" }
  | { type: "horizontalRule" };

export interface PendingAdvancedCommand {
  command: AdvancedEditorCommand;
  selection: { from: number; to: number };
}

function ToolbarButton({ label, active = false, disabled = false, onClick }: ToolbarButtonProps) {
  return (
    <Button
      type="button"
      size="small"
      variant={active ? "contained" : "outlined"}
      disabled={disabled}
      onClick={onClick}
      sx={{ minWidth: 36, px: 1 }}
    >
      {label}
    </Button>
  );
}

function ColorInput({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <Tooltip title={label}>
      <Box
        component="label"
        sx={{
          display: "inline-flex",
          alignItems: "center",
          gap: 0.75,
          height: 30,
          px: 1,
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 1,
          cursor: "pointer",
          bgcolor: "background.paper",
          fontSize: "0.75rem",
          fontWeight: 700
        }}
      >
        {label}
        <Box
          component="input"
          type="color"
          value={value}
          onChange={onChange}
          sx={{
            width: 22,
            height: 22,
            p: 0,
            border: 0,
            bgcolor: "transparent",
            cursor: "pointer"
          }}
        />
      </Box>
    </Tooltip>
  );
}

export default function RichTextEditorCore({
  value,
  onChange,
  onInsertBlock,
  additionalExtensions = [],
  advancedSupportEnabled = false,
  pendingAdvancedCommand = null,
  onRequestAdvancedSupport,
  onAdvancedCommandApplied
}: RichTextEditorCoreProps) {
  const [insertAnchor, setInsertAnchor] = useState<HTMLElement | null>(null);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkHref, setLinkHref] = useState("");
  const [linkText, setLinkText] = useState("");
  const [linkError, setLinkError] = useState("");
  const [mediaPickerKind, setMediaPickerKind] = useState<RichTextMediaInsertKind | null>(null);
  const [slashOpen, setSlashOpen] = useState(false);
  const slashFromRef = useRef<number | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      Bold,
      Document,
      HardBreak,
      Heading.configure({
        levels: [2, 3, 4]
      }),
      UndoRedo,
      Italic,
      Paragraph,
      Text,
      ...additionalExtensions
    ],
    content: value,
    editorProps: {
      attributes: {
        class: "rcat-rich-text-editor",
        "aria-label": "ตัวแก้ไขเนื้อหาแบบ Rich Text"
      },
      handleKeyDown(view, event) {
        if (event.key === "Escape") {
          setSlashOpen(false);
          slashFromRef.current = null;
          return false;
        }

        if (event.key === "/" && view.state.selection.empty) {
          const parent = view.state.selection.$from.parent;

          if (parent.type.name === "paragraph" && parent.textContent.length === 0) {
            slashFromRef.current = view.state.selection.from;
            setSlashOpen(true);
          }
        }

        return false;
      }
    },
    onCreate: ({ editor: currentEditor }) => {
      if (!advancedSupportEnabled || pendingAdvancedCommand === null) {
        return;
      }

      const { command, selection } = pendingAdvancedCommand;
      const chain = currentEditor.chain().focus().setTextSelection(selection);

      switch (command.type) {
        case "underline":
          chain.toggleUnderline().run();
          break;
        case "strike":
          chain.toggleStrike().run();
          break;
        case "color":
          chain.setColor(command.value).run();
          break;
        case "highlight":
          chain.setHighlight({ color: command.value }).run();
          break;
        case "textAlign":
          chain.setTextAlign(command.value).run();
          break;
        case "bulletList":
          chain.toggleBulletList().run();
          break;
        case "orderedList":
          chain.toggleOrderedList().run();
          break;
        case "blockquote":
          chain.toggleBlockquote().run();
          break;
        case "table":
          chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
          break;
        case "horizontalRule":
          chain.setHorizontalRule().run();
          break;
        case "linkDialog": {
          const { from, to } = currentEditor.state.selection;
          setLinkHref(String(currentEditor.getAttributes("link").href || ""));
          setLinkText(from === to ? "" : currentEditor.state.doc.textBetween(from, to, " "));
          setLinkError("");
          setLinkDialogOpen(true);
          break;
        }
      }

      onAdvancedCommandApplied?.();
    },
    onUpdate: ({ editor: currentEditor }) => {
      onChange(normalizeRichTextDocument(currentEditor.getJSON()));
    }
  });

  useEffect(() => {
    if (!editor) {
      return;
    }

    const current = normalizeRichTextDocument(editor.getJSON());
    if (JSON.stringify(current) !== JSON.stringify(value)) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [editor, value]);

  if (!editor) {
    return (
      <Box sx={{ p: 2, border: "1px solid", borderColor: "divider", borderRadius: 1.5 }}>
        <Typography variant="body2" color="text.secondary">
          กำลังเตรียมตัวแก้ไขเนื้อหา…
        </Typography>
      </Box>
    );
  }

  const clearSlashTrigger = () => {
    const from = slashFromRef.current;

    if (from !== null) {
      const to = editor.state.selection.from;
      const triggerText = to > from ? editor.state.doc.textBetween(from, to, "") : "";

      if (triggerText.startsWith("/")) {
        editor.chain().focus().deleteRange({ from, to }).run();
      }
    }

    slashFromRef.current = null;
    setSlashOpen(false);
  };

  const requestAdvancedCommand = (command: AdvancedEditorCommand) => {
    onRequestAdvancedSupport?.({
      command,
      selection: { from: editor.state.selection.from, to: editor.state.selection.to }
    });
  };

  const openLinkDialog = () => {
    if (!advancedSupportEnabled) {
      requestAdvancedCommand({ type: "linkDialog" });
      setInsertAnchor(null);
      return;
    }

    const { from, to } = editor.state.selection;
    const selectedText = from === to ? "" : editor.state.doc.textBetween(from, to, " ");

    setLinkHref(String(editor.getAttributes("link").href || ""));
    setLinkText(selectedText);
    setLinkError("");
    setLinkDialogOpen(true);
    setInsertAnchor(null);
  };

  const applyLink = () => {
    const normalizedHref = normalizeSafeHref(linkHref);

    if (normalizedHref === "#") {
      setLinkError("URL ต้องเป็น https://, http://, mailto:, tel:, ลิงก์ภายใน /path หรือ #anchor");
      return;
    }

    if (editor.isActive("link")) {
      editor.chain().focus().extendMarkRange("link").setLink({ href: normalizedHref }).run();
    } else if (!editor.state.selection.empty) {
      editor.chain().focus().setLink({ href: normalizedHref }).run();
    } else {
      const label = linkText.trim() || linkHref.trim();

      editor
        .chain()
        .focus()
        .insertContent({
          type: "text",
          text: label,
          marks: [{ type: "link", attrs: { href: normalizedHref } }]
        })
        .run();
    }

    setLinkDialogOpen(false);
    setLinkError("");
  };

  const openMediaPicker = (kind: RichTextMediaInsertKind, fromSlash = false) => {
    if (fromSlash) {
      clearSlashTrigger();
    }

    setInsertAnchor(null);
    setMediaPickerKind(kind);
  };

  const runInternalInsert = (command: InternalInsertCommand, fromSlash = false) => {
    if (fromSlash) {
      clearSlashTrigger();
    }

    setInsertAnchor(null);

    if (!advancedSupportEnabled) {
      requestAdvancedCommand({ type: command });
      return;
    }

    if (command === "table") {
      editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
      return;
    }

    editor.chain().focus().setHorizontalRule().run();
  };

  const runExternalInsert = (
    request: Extract<RichTextExternalInsertRequest, { type: "facebookPost" | "button" }>,
    fromSlash = false
  ) => {
    if (fromSlash) {
      clearSlashTrigger();
    }

    setInsertAnchor(null);
    onInsertBlock?.(request);
  };

  const runSlashFormatting = (command: "heading" | "bulletList" | "orderedList" | "blockquote") => {
    clearSlashTrigger();

    if (command === "heading") {
      editor.chain().focus().setHeading({ level: 2 }).run();
      return;
    }

    if (!advancedSupportEnabled) {
      requestAdvancedCommand({ type: command });
      return;
    }

    if (command === "bulletList") {
      editor.chain().focus().toggleBulletList().run();
      return;
    }

    if (command === "orderedList") {
      editor.chain().focus().toggleOrderedList().run();
      return;
    }

    editor.chain().focus().toggleBlockquote().run();
  };

  const handleInsertMenuOpen = (event: MouseEvent<HTMLButtonElement>) => {
    setInsertAnchor(event.currentTarget);
  };

  return (
    <>
      <Box
        sx={{
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 1.5,
          overflow: "hidden",
          bgcolor: "background.paper"
        }}
      >
        <Stack
          direction="row"
          spacing={0.75}
          useFlexGap
          sx={{
            flexWrap: "wrap",
            alignItems: "center",
            p: 1,
            bgcolor: "action.hover",
            borderBottom: "1px solid",
            borderColor: "divider"
          }}
        >
          <ToolbarButton
            label="↶"
            disabled={!editor.can().undo()}
            onClick={() => editor.chain().focus().undo().run()}
          />
          <ToolbarButton
            label="↷"
            disabled={!editor.can().redo()}
            onClick={() => editor.chain().focus().redo().run()}
          />
          <Divider flexItem orientation="vertical" />

          <ToolbarButton
            label="P"
            active={editor.isActive("paragraph")}
            onClick={() => editor.chain().focus().setParagraph().run()}
          />
          {[2, 3, 4].map((level) => (
            <ToolbarButton
              key={level}
              label={`H${level}`}
              active={editor.isActive("heading", { level })}
              onClick={() =>
                editor
                  .chain()
                  .focus()
                  .toggleHeading({ level: level as 2 | 3 | 4 })
                  .run()
              }
            />
          ))}
          <Divider flexItem orientation="vertical" />

          <ToolbarButton
            label="B"
            active={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
          />
          <ToolbarButton
            label="I"
            active={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          />
          <ToolbarButton
            label="U"
            active={advancedSupportEnabled && editor.isActive("underline")}
            onClick={() =>
              advancedSupportEnabled
                ? editor.chain().focus().toggleUnderline().run()
                : requestAdvancedCommand({ type: "underline" })
            }
          />
          <ToolbarButton
            label="S"
            active={advancedSupportEnabled && editor.isActive("strike")}
            onClick={() =>
              advancedSupportEnabled
                ? editor.chain().focus().toggleStrike().run()
                : requestAdvancedCommand({ type: "strike" })
            }
          />
          <ColorInput
            label="สี"
            value={String(editor.getAttributes("textStyle").color || designTokens.color.textPrimary)}
            onChange={(event) =>
              advancedSupportEnabled
                ? editor.chain().focus().setColor(event.target.value).run()
                : requestAdvancedCommand({ type: "color", value: event.target.value })
            }
          />
          <ColorInput
            label="ไฮไลต์"
            value={String(editor.getAttributes("highlight").color || designTokens.color.brandAccentSoft)}
            onChange={(event) =>
              advancedSupportEnabled
                ? editor.chain().focus().setHighlight({ color: event.target.value }).run()
                : requestAdvancedCommand({ type: "highlight", value: event.target.value })
            }
          />
          <Divider flexItem orientation="vertical" />

          <ToolbarButton
            label="≡"
            active={advancedSupportEnabled && editor.isActive({ textAlign: "left" })}
            onClick={() =>
              advancedSupportEnabled
                ? editor.chain().focus().setTextAlign("left").run()
                : requestAdvancedCommand({ type: "textAlign", value: "left" })
            }
          />
          <ToolbarButton
            label="≣"
            active={advancedSupportEnabled && editor.isActive({ textAlign: "center" })}
            onClick={() =>
              advancedSupportEnabled
                ? editor.chain().focus().setTextAlign("center").run()
                : requestAdvancedCommand({ type: "textAlign", value: "center" })
            }
          />
          <ToolbarButton
            label="≡→"
            active={advancedSupportEnabled && editor.isActive({ textAlign: "right" })}
            onClick={() =>
              advancedSupportEnabled
                ? editor.chain().focus().setTextAlign("right").run()
                : requestAdvancedCommand({ type: "textAlign", value: "right" })
            }
          />
          <ToolbarButton
            label="☰"
            active={advancedSupportEnabled && editor.isActive("bulletList")}
            onClick={() =>
              advancedSupportEnabled
                ? editor.chain().focus().toggleBulletList().run()
                : requestAdvancedCommand({ type: "bulletList" })
            }
          />
          <ToolbarButton
            label="1."
            active={advancedSupportEnabled && editor.isActive("orderedList")}
            onClick={() =>
              advancedSupportEnabled
                ? editor.chain().focus().toggleOrderedList().run()
                : requestAdvancedCommand({ type: "orderedList" })
            }
          />
          <ToolbarButton
            label="❝"
            active={advancedSupportEnabled && editor.isActive("blockquote")}
            onClick={() =>
              advancedSupportEnabled
                ? editor.chain().focus().toggleBlockquote().run()
                : requestAdvancedCommand({ type: "blockquote" })
            }
          />
          <Divider flexItem orientation="vertical" />

          <ToolbarButton
            label="ลิงก์"
            active={advancedSupportEnabled && editor.isActive("link")}
            onClick={openLinkDialog}
          />
          {advancedSupportEnabled && editor.isActive("link") && (
            <ToolbarButton label="ยกเลิกลิงก์" onClick={() => editor.chain().focus().unsetLink().run()} />
          )}
          <Button type="button" size="small" variant="outlined" onClick={handleInsertMenuOpen}>
            แทรก ▾
          </Button>

          {advancedSupportEnabled && editor.isActive("table") && (
            <>
              <Divider flexItem orientation="vertical" />
              <ToolbarButton label="+แถว" onClick={() => editor.chain().focus().addRowAfter().run()} />
              <ToolbarButton label="+คอลัมน์" onClick={() => editor.chain().focus().addColumnAfter().run()} />
              <ToolbarButton label="ลบแถว" onClick={() => editor.chain().focus().deleteRow().run()} />
              <ToolbarButton label="ลบคอลัมน์" onClick={() => editor.chain().focus().deleteColumn().run()} />
              <ToolbarButton label="ลบตาราง" onClick={() => editor.chain().focus().deleteTable().run()} />
            </>
          )}
        </Stack>

        <Menu anchorEl={insertAnchor} open={Boolean(insertAnchor)} onClose={() => setInsertAnchor(null)}>
          <MenuItem onClick={openLinkDialog}>ลิงก์</MenuItem>
          <Divider />
          <MenuItem disabled={!onInsertBlock} onClick={() => openMediaPicker("image")}>
            รูปภาพจากคลังสื่อ
          </MenuItem>
          <MenuItem disabled={!onInsertBlock} onClick={() => openMediaPicker("video")}>
            วิดีโอจากคลังสื่อ
          </MenuItem>
          <MenuItem disabled={!onInsertBlock} onClick={() => openMediaPicker("pdf")}>
            PDF จากคลังสื่อ
          </MenuItem>
          <MenuItem disabled={!onInsertBlock} onClick={() => openMediaPicker("file")}>
            ไฟล์แนบจากคลังสื่อ
          </MenuItem>
          <Divider />
          <MenuItem disabled={!onInsertBlock} onClick={() => runExternalInsert({ type: "facebookPost" })}>
            Facebook / Reels
          </MenuItem>
          <MenuItem disabled={!onInsertBlock} onClick={() => runExternalInsert({ type: "button" })}>
            ปุ่ม CTA
          </MenuItem>
          <MenuItem onClick={() => runInternalInsert("table")}>ตาราง 3 × 3</MenuItem>
          <MenuItem onClick={() => runInternalInsert("horizontalRule")}>เส้นแบ่ง</MenuItem>
        </Menu>

        {slashOpen && (
          <Paper
            elevation={0}
            sx={{
              m: 1,
              p: 1,
              border: "1px solid",
              borderColor: "divider",
              bgcolor: "background.paper"
            }}
          >
            <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 0.75 }}>
              คำสั่ง / — เลือกสิ่งที่ต้องการแทรก
            </Typography>
            <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: "wrap" }}>
              <Button size="small" variant="outlined" onClick={() => runSlashFormatting("heading")}>
                หัวข้อ H2
              </Button>
              <Button size="small" variant="outlined" onClick={() => runSlashFormatting("bulletList")}>
                Bullet list
              </Button>
              <Button size="small" variant="outlined" onClick={() => runSlashFormatting("orderedList")}>
                Numbered list
              </Button>
              <Button size="small" variant="outlined" onClick={() => runSlashFormatting("blockquote")}>
                Quote
              </Button>
              <Button
                size="small"
                variant="outlined"
                disabled={!onInsertBlock}
                onClick={() => openMediaPicker("image", true)}
              >
                รูปภาพ
              </Button>
              <Button
                size="small"
                variant="outlined"
                disabled={!onInsertBlock}
                onClick={() => openMediaPicker("pdf", true)}
              >
                PDF
              </Button>
              <Button size="small" variant="outlined" onClick={() => runInternalInsert("table", true)}>
                ตาราง
              </Button>
              <Button
                size="small"
                variant="outlined"
                disabled={!onInsertBlock}
                onClick={() => runExternalInsert({ type: "facebookPost" }, true)}
              >
                Facebook
              </Button>
              <Button
                size="small"
                variant="outlined"
                disabled={!onInsertBlock}
                onClick={() => runExternalInsert({ type: "button" }, true)}
              >
                ปุ่ม
              </Button>
            </Stack>
          </Paper>
        )}

        <Box
          sx={{
            "& .rcat-rich-text-editor": {
              minHeight: 280,
              p: 2,
              outline: "none",
              lineHeight: 1.75
            },
            "& .rcat-rich-text-editor p": {
              my: 1
            },
            "& .rcat-rich-text-editor h2, & .rcat-rich-text-editor h3, & .rcat-rich-text-editor h4": {
              mt: 2,
              mb: 1,
              lineHeight: 1.3
            },
            "& .rcat-rich-text-editor blockquote": {
              mx: 0,
              my: 1.5,
              pl: 2,
              borderLeft: "4px solid",
              borderColor: "primary.main"
            },
            "& .rcat-rich-text-editor table": {
              width: "100%",
              borderCollapse: "collapse",
              my: 1.5
            },
            "& .rcat-rich-text-editor th, & .rcat-rich-text-editor td": {
              border: "1px solid",
              borderColor: "divider",
              p: 1,
              verticalAlign: "top"
            },
            "& .rcat-rich-text-editor th": {
              bgcolor: "action.hover",
              fontWeight: 800
            },
            "& .rcat-rich-text-editor a": {
              color: "primary.main",
              textDecoration: "underline"
            },
            "& .rcat-rich-text-editor pre": {
              overflowX: "auto",
              p: 1.5,
              borderRadius: `${designTokens.radius.small}px`,
              bgcolor: "grey.900",
              color: "common.white"
            }
          }}
        >
          <EditorContent editor={editor} />
        </Box>
      </Box>

      <Dialog open={linkDialogOpen} onClose={() => setLinkDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editor.isActive("link") ? "แก้ไขลิงก์" : "เพิ่มลิงก์"}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.5}>
            {linkError && <Alert severity="error">{linkError}</Alert>}
            {editor.state.selection.empty && !editor.isActive("link") && (
              <TextField
                label="ข้อความที่แสดง"
                value={linkText}
                onChange={(event) => setLinkText(event.target.value)}
                placeholder="เช่น อ่านรายละเอียด"
                fullWidth
                autoFocus
              />
            )}
            {!editor.state.selection.empty && <Alert severity="info">ลิงก์จะถูกนำไปใช้กับข้อความที่เลือกอยู่</Alert>}
            <TextField
              label="URL"
              value={linkHref}
              onChange={(event) => {
                setLinkHref(event.target.value);
                setLinkError("");
              }}
              placeholder="https://example.org หรือ /path"
              fullWidth
              autoFocus={editor.state.selection.empty === false || editor.isActive("link")}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          {editor.isActive("link") && (
            <Button
              type="button"
              color="error"
              onClick={() => {
                editor.chain().focus().extendMarkRange("link").unsetLink().run();
                setLinkDialogOpen(false);
              }}
            >
              ลบลิงก์
            </Button>
          )}
          <Box sx={{ flex: 1 }} />
          <Button type="button" onClick={() => setLinkDialogOpen(false)}>
            ยกเลิก
          </Button>
          <Button type="button" variant="contained" onClick={applyLink}>
            บันทึกลิงก์
          </Button>
        </DialogActions>
      </Dialog>

      {mediaPickerKind && (
        <RichTextMediaPickerDialog
          open
          kind={mediaPickerKind}
          onClose={() => setMediaPickerKind(null)}
          onSelect={(asset) => {
            const kind = mediaPickerKind;
            setMediaPickerKind(null);
            onInsertBlock?.({ type: kind, asset });
          }}
        />
      )}
    </>
  );
}
