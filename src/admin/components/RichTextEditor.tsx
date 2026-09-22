import { ChangeEvent, useEffect } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { EditorContent, useEditor } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import { Color, TextStyle } from "@tiptap/extension-text-style";
import { TableKit } from "@tiptap/extension-table";
import {
  RichTextDocument,
  normalizeRichTextDocument
} from "../../utils/contentBlocks";
import { designTokens } from "../../design-system/tokens";

interface RichTextEditorProps {
  value: RichTextDocument;
  onChange: (value: RichTextDocument) => void;
}

interface ToolbarButtonProps {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
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

export default function RichTextEditor({ value, onChange }: RichTextEditorProps) {
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

  const setLink = () => {
    const previousUrl = String(editor.getAttributes("link").href || "");
    const href = window.prompt("URL ลิงก์", previousUrl || "https://");

    if (href === null) {
      return;
    }

    const normalized = href.trim();
    if (!normalized) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange("link").setLink({ href: normalized }).run();
  };

  return (
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
        <ToolbarButton label="↶" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()} />
        <ToolbarButton label="↷" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()} />
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
            onClick={() => editor.chain().focus().toggleHeading({ level: level as 2 | 3 | 4 }).run()}
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
          value={String(editor.getAttributes("textStyle").color || "#1f2937")}
          onChange={(event) => editor.chain().focus().setColor(event.target.value).run()}
        />
        <ColorInput
          label="ไฮไลต์"
          value={String(editor.getAttributes("highlight").color || "#fff59d")}
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

        <ToolbarButton label="ลิงก์" active={editor.isActive("link")} onClick={setLink} />
        {editor.isActive("link") && (
          <ToolbarButton label="ยกเลิกลิงก์" onClick={() => editor.chain().focus().unsetLink().run()} />
        )}
        <ToolbarButton
          label="ตาราง"
          onClick={() =>
            editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
          }
        />
        {editor.isActive("table") && (
          <>
            <ToolbarButton label="+แถว" onClick={() => editor.chain().focus().addRowAfter().run()} />
            <ToolbarButton label="+คอลัมน์" onClick={() => editor.chain().focus().addColumnAfter().run()} />
            <ToolbarButton label="ลบแถว" onClick={() => editor.chain().focus().deleteRow().run()} />
            <ToolbarButton label="ลบคอลัมน์" onClick={() => editor.chain().focus().deleteColumn().run()} />
            <ToolbarButton label="ลบตาราง" onClick={() => editor.chain().focus().deleteTable().run()} />
          </>
        )}
      </Stack>

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
  );
}
