import { Fragment } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography
} from "@mui/material";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import ArrowDownwardOutlinedIcon from "@mui/icons-material/ArrowDownwardOutlined";
import ArrowUpwardOutlinedIcon from "@mui/icons-material/ArrowUpwardOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DragIndicatorOutlinedIcon from "@mui/icons-material/DragIndicatorOutlined";
import { MediaAsset } from "../types";
import {
  ContentBlock,
  ContentBlockType,
  createContentBlock
} from "../utils/contentBlocks";

interface ContentBlockBuilderProps {
  blocks: ContentBlock[];
  mediaAssets: MediaAsset[];
  onChange: (blocks: ContentBlock[]) => void;
}

interface BlockTemplateOption {
  type: ContentBlockType;
  label: string;
  helper: string;
}

const blockTemplateOptions: BlockTemplateOption[] = [
  { type: "heading", label: "Heading", helper: "Section headings for long posts" },
  { type: "paragraph", label: "Paragraph", helper: "Main body content" },
  { type: "quote", label: "Quote", helper: "Highlights and testimonials" },
  { type: "checklist", label: "Checklist", helper: "Bullet points and steps" },
  { type: "image", label: "Image", helper: "Feature images from media library" },
  { type: "video", label: "Video", helper: "Embedded video from media library" },
  { type: "button", label: "Button", helper: "Strong CTA links" },
  { type: "divider", label: "Divider", helper: "Visual section separator" }
];

function normalizeChecklistInput(items: string[]) {
  return items.join("\n");
}

function parseChecklistInput(value: string) {
  return value
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item, index, items) => items.indexOf(item) === index);
}

function labelForBlockType(type: ContentBlockType) {
  const match = blockTemplateOptions.find((item) => item.type === type);
  return match ? match.label : type;
}

export default function ContentBlockBuilder({ blocks, mediaAssets, onChange }: ContentBlockBuilderProps) {
  const addBlock = (type: ContentBlockType) => {
    onChange([...blocks, createContentBlock(type)]);
  };

  const updateBlock = (id: string, updater: (block: ContentBlock) => ContentBlock) => {
    onChange(blocks.map((block) => (block.id === id ? updater(block) : block)));
  };

  const moveBlock = (id: string, direction: "up" | "down") => {
    const currentIndex = blocks.findIndex((block) => block.id === id);
    if (currentIndex === -1) {
      return;
    }

    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= blocks.length) {
      return;
    }

    const nextBlocks = [...blocks];
    const [moved] = nextBlocks.splice(currentIndex, 1);
    nextBlocks.splice(targetIndex, 0, moved);
    onChange(nextBlocks);
  };

  const removeBlock = (id: string) => {
    onChange(blocks.filter((block) => block.id !== id));
  };

  const imageAssets = mediaAssets.filter((asset) => asset.type === "image");
  const videoAssets = mediaAssets.filter((asset) => asset.type === "video");

  return (
    <Stack spacing={1.5}>
      <Typography fontWeight={900}>Content builder</Typography>
      <Typography color="text.secondary" variant="body2">
        Build post content using reusable blocks, similar to WordPress block editing.
      </Typography>

      <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
        {blockTemplateOptions.map((option) => (
          <Tooltip key={option.type} title={option.helper}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<AddOutlinedIcon />}
              onClick={() => addBlock(option.type)}
            >
              {option.label}
            </Button>
          </Tooltip>
        ))}
      </Stack>

      {!blocks.length && (
        <Alert severity="info">
          No blocks yet. Start with Heading + Paragraph blocks for a classic WordPress-like post flow.
        </Alert>
      )}

      <Stack spacing={1.25}>
        {blocks.map((block, index) => {
          const isFirst = index === 0;
          const isLast = index === blocks.length - 1;

          return (
            <Card key={block.id} variant="outlined" sx={{ borderRadius: 2 }}>
              <CardContent sx={{ p: 1.75 }}>
                <Stack spacing={1.25}>
                  <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="center">
                    <Stack direction="row" spacing={0.75} alignItems="center">
                      <DragIndicatorOutlinedIcon fontSize="small" color="disabled" />
                      <Chip label={`${index + 1}. ${labelForBlockType(block.type)}`} size="small" />
                    </Stack>
                    <Stack direction="row" spacing={0.25}>
                      <IconButton
                        size="small"
                        disabled={isFirst}
                        aria-label="Move block up"
                        onClick={() => moveBlock(block.id, "up")}
                      >
                        <ArrowUpwardOutlinedIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        disabled={isLast}
                        aria-label="Move block down"
                        onClick={() => moveBlock(block.id, "down")}
                      >
                        <ArrowDownwardOutlinedIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" color="error" aria-label="Delete block" onClick={() => removeBlock(block.id)}>
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  </Stack>

                  {block.type === "paragraph" && (
                    <TextField
                      label="Paragraph"
                      value={block.text}
                      onChange={(event) =>
                        updateBlock(block.id, (current) =>
                          current.type === "paragraph" ? { ...current, text: event.target.value } : current
                        )
                      }
                      placeholder="Write paragraph text..."
                      minRows={4}
                      multiline
                      fullWidth
                    />
                  )}

                  {block.type === "heading" && (
                    <Fragment>
                      <TextField
                        label="Heading text"
                        value={block.text}
                        onChange={(event) =>
                          updateBlock(block.id, (current) =>
                            current.type === "heading" ? { ...current, text: event.target.value } : current
                          )
                        }
                        placeholder="Section title"
                        fullWidth
                      />
                      <FormControl size="small" sx={{ width: 160 }}>
                        <InputLabel id={`heading-level-${block.id}`}>Heading level</InputLabel>
                        <Select
                          labelId={`heading-level-${block.id}`}
                          label="Heading level"
                          value={String(block.level)}
                          onChange={(event) =>
                            updateBlock(block.id, (current) =>
                              current.type === "heading"
                                ? { ...current, level: Number(event.target.value) as 2 | 3 | 4 }
                                : current
                            )
                          }
                        >
                          <MenuItem value="2">H2</MenuItem>
                          <MenuItem value="3">H3</MenuItem>
                          <MenuItem value="4">H4</MenuItem>
                        </Select>
                      </FormControl>
                    </Fragment>
                  )}

                  {block.type === "quote" && (
                    <Fragment>
                      <TextField
                        label="Quote text"
                        value={block.text}
                        onChange={(event) =>
                          updateBlock(block.id, (current) =>
                            current.type === "quote" ? { ...current, text: event.target.value } : current
                          )
                        }
                        minRows={3}
                        multiline
                        fullWidth
                      />
                      <TextField
                        label="Citation"
                        value={block.citation}
                        onChange={(event) =>
                          updateBlock(block.id, (current) =>
                            current.type === "quote" ? { ...current, citation: event.target.value } : current
                          )
                        }
                        placeholder="Name, office, or source"
                        fullWidth
                      />
                    </Fragment>
                  )}

                  {block.type === "checklist" && (
                    <TextField
                      label="Checklist items"
                      value={normalizeChecklistInput(block.items)}
                      onChange={(event) =>
                        updateBlock(block.id, (current) =>
                          current.type === "checklist"
                            ? { ...current, items: parseChecklistInput(event.target.value) }
                            : current
                        )
                      }
                      helperText="One item per line."
                      minRows={4}
                      multiline
                      fullWidth
                    />
                  )}

                  {block.type === "image" && (
                    <Fragment>
                      <TextField
                        label="Image asset"
                        select
                        value={block.mediaId}
                        onChange={(event) =>
                          updateBlock(block.id, (current) =>
                            current.type === "image" ? { ...current, mediaId: event.target.value } : current
                          )
                        }
                        fullWidth
                      >
                        <MenuItem value="">Select image from media library</MenuItem>
                        {imageAssets.map((asset) => (
                          <MenuItem key={asset.id} value={asset.id}>
                            {asset.name}
                          </MenuItem>
                        ))}
                      </TextField>
                      <TextField
                        label="Caption"
                        value={block.caption}
                        onChange={(event) =>
                          updateBlock(block.id, (current) =>
                            current.type === "image" ? { ...current, caption: event.target.value } : current
                          )
                        }
                        placeholder="Optional image caption"
                        fullWidth
                      />
                    </Fragment>
                  )}

                  {block.type === "video" && (
                    <Fragment>
                      <TextField
                        label="Video asset"
                        select
                        value={block.mediaId}
                        onChange={(event) =>
                          updateBlock(block.id, (current) =>
                            current.type === "video" ? { ...current, mediaId: event.target.value } : current
                          )
                        }
                        fullWidth
                      >
                        <MenuItem value="">Select video from media library</MenuItem>
                        {videoAssets.map((asset) => (
                          <MenuItem key={asset.id} value={asset.id}>
                            {asset.name}
                          </MenuItem>
                        ))}
                      </TextField>
                      <TextField
                        label="Caption"
                        value={block.caption}
                        onChange={(event) =>
                          updateBlock(block.id, (current) =>
                            current.type === "video" ? { ...current, caption: event.target.value } : current
                          )
                        }
                        placeholder="Optional video caption"
                        fullWidth
                      />
                    </Fragment>
                  )}

                  {block.type === "button" && (
                    <Fragment>
                      <TextField
                        label="Button label"
                        value={block.label}
                        onChange={(event) =>
                          updateBlock(block.id, (current) =>
                            current.type === "button" ? { ...current, label: event.target.value } : current
                          )
                        }
                        fullWidth
                      />
                      <TextField
                        label="Button URL"
                        value={block.href}
                        onChange={(event) =>
                          updateBlock(block.id, (current) =>
                            current.type === "button" ? { ...current, href: event.target.value } : current
                          )
                        }
                        placeholder="https://example.edu/admissions"
                        fullWidth
                      />
                      <FormControl size="small" sx={{ width: 180 }}>
                        <InputLabel id={`button-variant-${block.id}`}>Style</InputLabel>
                        <Select
                          labelId={`button-variant-${block.id}`}
                          label="Style"
                          value={block.variant}
                          onChange={(event) =>
                            updateBlock(block.id, (current) =>
                              current.type === "button"
                                ? {
                                    ...current,
                                    variant: event.target.value === "outlined" ? "outlined" : "contained"
                                  }
                                : current
                            )
                          }
                        >
                          <MenuItem value="contained">Contained</MenuItem>
                          <MenuItem value="outlined">Outlined</MenuItem>
                        </Select>
                      </FormControl>
                    </Fragment>
                  )}

                  {block.type === "divider" && (
                    <Box>
                      <Divider sx={{ mb: 1 }} />
                      <Typography color="text.secondary" variant="body2">
                        Divider block separates content sections visually.
                      </Typography>
                    </Box>
                  )}
                </Stack>
              </CardContent>
            </Card>
          );
        })}
      </Stack>
    </Stack>
  );
}
