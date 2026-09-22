import { ChangeEvent, MouseEvent, useEffect, useRef, useState } from "react";
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
import { StarterKit } from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import { Color, TextStyle } from "@tiptap/extension-text-style";
import { TableKit } from "@tiptap/extension-table";
import { RichTextDocument, normalizeRichTextDocument } from "../../utils/contentBlocks";
import { normalizeSafeHref } from "../../utils/safeUrl";
import { designTokens } from "../../design-system/tokens";
import RichTextMediaPickerDialog from "./RichTextMediaPickerDialog";
import type { RichTextExternalInsertRequest, RichTextMediaInsertKind } from "./richTextInsert";

interface RichTextEditorProps {
  value: RichTextDocument;
  onChange: (value: RichTextDocument) => void;
  onInsertBlock?: (request: RichTextExternalInsertRequest) => void;
}

interface ToolbarButtonProps {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

type InternalInsertCommand = "table" | "horizontalRule";

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

export default function RichTextEditor({ value, onChange, onInsertBlock }: RichTextEditorProps) {
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
      StarterKit.configure({
        heading: {
          levels: [2, 3, 4]
        }
      }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
        alignments: ["left", "center", "right", "justify"]
      }),
      TableKit.configure({
        table: {
          resizable: true
        }
      })
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

  const openLinkDialog = () => {
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
            active={editor.isActive("underline")}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          />
          <ToolbarButton
            label="S"
            active={editor.isActive("strike")}
            onClick={() => editor.chain().focus().toggleStrike().run()}
          />
          <ColorInput
            label="สี"
            value={String(editor.getAttributes("textStyle").color || designTokens.color.textPrimary)}
            onChange={(event) => editor.chain().focus().setColor(event.target.value).run()}
          />
          <ColorInput
            label="ไฮไลต์"
            value={String(editor.getAttributes("highlight").color || designTokens.color.brandAccentSoft)}
            onChange={(event) => editor.chain().focus().setHighlight({ color: event.target.value }).run()}
          />
          <Divider flexItem orientation="vertical" />

          <ToolbarButton
            label="≡"
            active={editor.isActive({ textAlign: "left" })}
            onClick={() => editor.chain().focus().setTextAlign("left").run()}
          />
          <ToolbarButton
            label="≣"
            active={editor.isActive({ textAlign: "center" })}
            onClick={() => editor.chain().focus().setTextAlign("center").run()}
          />
          <ToolbarButton
            label="≡→"
            active={editor.isActive({ textAlign: "right" })}
            onClick={() => editor.chain().focus().setTextAlign("right").run()}
          />
          <ToolbarButton
            label="☰"
            active={editor.isActive("bulletList")}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          />
          <ToolbarButton
            label="1."
            active={editor.isActive("orderedList")}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          />
          <ToolbarButton
            label="❝"
            active={editor.isActive("blockquote")}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
          />
          <Divider flexItem orientation="vertical" />

          <ToolbarButton label="ลิงก์" active={editor.isActive("link")} onClick={openLinkDialog} />
          {editor.isActive("link") && (
            <ToolbarButton label="ยกเลิกลิงก์" onClick={() => editor.chain().focus().unsetLink().run()} />
          )}
          <Button type="button" size="small" variant="outlined" onClick={handleInsertMenuOpen}>
            แทรก ▾
          </Button>

          {editor.isActive("table") && (
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
