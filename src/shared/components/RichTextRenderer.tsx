import { Fragment, ReactNode } from "react";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
import { RichTextDocument, RichTextMark, RichTextNode } from "../../utils/contentBlocks";
import { normalizeSafeHref } from "../../utils/safeUrl";
import { designTokens } from "../../design-system/tokens";
import FlagEmojiText from "./FlagEmojiText";

interface RichTextRendererProps {
  document: RichTextDocument;
}

function renderMarks(content: ReactNode, marks: RichTextMark[] | undefined, key: string): ReactNode {
  if (!marks?.length) {
    return content;
  }

  return marks.reduce<ReactNode>((child, mark, index) => {
    const markKey = `${key}-mark-${index}`;

    if (mark.type === "bold") {
      return <strong key={markKey}>{child}</strong>;
    }
    if (mark.type === "italic") {
      return <em key={markKey}>{child}</em>;
    }
    if (mark.type === "underline") {
      return <u key={markKey}>{child}</u>;
    }
    if (mark.type === "strike") {
      return <s key={markKey}>{child}</s>;
    }
    if (mark.type === "code") {
      return (
        <Box
          key={markKey}
          component="code"
          sx={{ px: 0.5, py: 0.15, borderRadius: 0.75, bgcolor: "action.hover", fontFamily: "monospace" }}
        >
          {child}
        </Box>
      );
    }
    if (mark.type === "link") {
      const href = normalizeSafeHref(mark.attrs?.href);
      if (href === "#") {
        return <Fragment key={markKey}>{child}</Fragment>;
      }
      return (
        <Box
          key={markKey}
          component="a"
          href={href}
          target="_blank"
          rel="noreferrer"
          sx={{ color: "primary.main", textDecoration: "underline", overflowWrap: "anywhere" }}
        >
          {child}
        </Box>
      );
    }
    if (mark.type === "textStyle" && mark.attrs?.color) {
      return (
        <Box key={markKey} component="span" sx={{ color: mark.attrs.color }}>
          {child}
        </Box>
      );
    }
    if (mark.type === "highlight" && mark.attrs?.color) {
      return (
        <Box key={markKey} component="mark" sx={{ bgcolor: mark.attrs.color, color: "inherit", px: 0.15 }}>
          {child}
        </Box>
      );
    }

    return <Fragment key={markKey}>{child}</Fragment>;
  }, content);
}

function renderChildren(node: RichTextNode, key: string) {
  return node.content?.map((child, index) => renderNode(child, `${key}-${index}`)) ?? null;
}

function renderNode(node: RichTextNode, key: string): ReactNode {
  if (node.type === "text") {
    return renderMarks(<FlagEmojiText text={node.text || ""} />, node.marks, key);
  }

  if (node.type === "hardBreak") {
    return <br key={key} />;
  }

  if (node.type === "horizontalRule") {
    return <Divider key={key} sx={{ my: 2 }} />;
  }

  const children = renderChildren(node, key);

  if (node.type === "doc") {
    return <Fragment key={key}>{children}</Fragment>;
  }

  if (node.type === "paragraph") {
    return (
      <Typography
        key={key}
        component="p"
        sx={{
          my: 1,
          whiteSpace: "pre-wrap",
          overflowWrap: "anywhere",
          textAlign: (node.attrs?.textAlign as "left" | "center" | "right" | "justify" | undefined) ?? undefined
        }}
      >
        {children}
      </Typography>
    );
  }

  if (node.type === "heading") {
    const level = Number(node.attrs?.level) || 2;
    const textAlign =
      (node.attrs?.textAlign as "left" | "center" | "right" | "justify" | undefined) ?? undefined;

    if (level === 3) {
      return (
        <Typography key={key} component="h3" variant="h4" sx={{ mt: 2.5, mb: 1, textAlign }}>
          {children}
        </Typography>
      );
    }

    if (level === 4) {
      return (
        <Typography key={key} component="h4" variant="h5" sx={{ mt: 2.25, mb: 1, textAlign }}>
          {children}
        </Typography>
      );
    }

    return (
      <Typography key={key} component="h2" variant="h3" sx={{ mt: 2.75, mb: 1.25, textAlign }}>
        {children}
      </Typography>
    );
  }

  if (node.type === "blockquote") {
    return (
      <Box
        key={key}
        component="blockquote"
        sx={{
          mx: 0,
          my: 1.5,
          pl: 2,
          py: 0.25,
          borderLeft: "4px solid",
          borderColor: "primary.main",
          bgcolor: "action.hover",
          borderRadius: `0 ${designTokens.radius.medium}px ${designTokens.radius.medium}px 0`
        }}
      >
        {children}
      </Box>
    );
  }

  if (node.type === "bulletList") {
    return (
      <Box key={key} component="ul" sx={{ my: 1.25, pl: 3.5 }}>
        {children}
      </Box>
    );
  }

  if (node.type === "orderedList") {
    const start = typeof node.attrs?.start === "number" ? node.attrs.start : undefined;
    return (
      <Box key={key} component="ol" start={start} sx={{ my: 1.25, pl: 3.5 }}>
        {children}
      </Box>
    );
  }

  if (node.type === "listItem") {
    return (
      <Box
        key={key}
        component="li"
        sx={{
          mb: 0.5,
          "& > p": { my: 0.25 },
          "& > ul, & > ol": { mt: 0.5, mb: 0.5 }
        }}
      >
        {children}
      </Box>
    );
  }

  if (node.type === "codeBlock") {
    return (
      <Box
        key={key}
        component="pre"
        sx={{
          my: 1.5,
          p: 1.5,
          overflowX: "auto",
          borderRadius: `${designTokens.radius.small}px`,
          bgcolor: "grey.900",
          color: "common.white",
          fontFamily: "monospace",
          whiteSpace: "pre-wrap"
        }}
      >
        <code>{children}</code>
      </Box>
    );
  }

  if (node.type === "table") {
    return (
      <Box key={key} sx={{ width: "100%", overflowX: "auto", my: 1.75 }}>
        <Box
          component="table"
          sx={{
            width: "100%",
            minWidth: 520,
            borderCollapse: "collapse",
            "& th, & td": {
              border: "1px solid",
              borderColor: "divider",
              p: 1,
              verticalAlign: "top"
            },
            "& th": {
              bgcolor: "action.hover",
              fontWeight: 800
            },
            "& p": {
              my: 0.25
            }
          }}
        >
          <tbody>{children}</tbody>
        </Box>
      </Box>
    );
  }

  if (node.type === "tableRow") {
    return <tr key={key}>{children}</tr>;
  }

  if (node.type === "tableHeader") {
    return <th key={key}>{children}</th>;
  }

  if (node.type === "tableCell") {
    return <td key={key}>{children}</td>;
  }

  return null;
}

export default function RichTextRenderer({ document }: RichTextRendererProps) {
  return <Box>{renderNode(document, "rich-text-root")}</Box>;
}
