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
import { MediaAsset } from "../../types";
import {
  ContentBlock,
  ContentBlockType,
  createContentBlock
} from "../../utils/contentBlocks";

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
  { type: "heading", label: "หัวข้อ", helper: "หัวข้อย่อยสำหรับบทความยาว" },
  { type: "paragraph", label: "ย่อหน้า", helper: "เนื้อหาหลัก" },
  { type: "quote", label: "คำอ้างอิง", helper: "ข้อความเด่นหรือคำรับรอง" },
  { type: "checklist", label: "รายการตรวจสอบ", helper: "หัวข้อย่อยและขั้นตอน" },
  { type: "image", label: "รูปภาพ", helper: "รูปภาพเด่นจากคลังสื่อ" },
  { type: "video", label: "วิดีโอ", helper: "วิดีโอฝังจากคลังสื่อ" },
  { type: "button", label: "ปุ่ม", helper: "ลิงก์เรียกให้ดำเนินการ" },
  { type: "divider", label: "เส้นแบ่ง", helper: "เส้นแบ่งส่วนเนื้อหา" }
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
      <Typography fontWeight={900}>ตัวสร้างเนื้อหา</Typography>
      <Typography color="text.secondary" variant="body2">
        สร้างเนื้อหาด้วยบล็อกที่นำกลับมาใช้ได้ คล้ายการแก้ไขบล็อกของ WordPress
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
          ยังไม่มีบล็อก เริ่มจากบล็อกหัวข้อและย่อหน้าเพื่อสร้างรูปแบบบทความพื้นฐาน
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
                        aria-label="ย้ายบล็อกขึ้น"
                        onClick={() => moveBlock(block.id, "up")}
                      >
                        <ArrowUpwardOutlinedIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        disabled={isLast}
                        aria-label="ย้ายบล็อกลง"
                        onClick={() => moveBlock(block.id, "down")}
                      >
                        <ArrowDownwardOutlinedIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" color="error" aria-label="ลบบล็อก" onClick={() => removeBlock(block.id)}>
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  </Stack>

                  {block.type === "paragraph" && (
                    <TextField
                      label="ย่อหน้า"
                      value={block.text}
                      onChange={(event) =>
                        updateBlock(block.id, (current) =>
                          current.type === "paragraph" ? { ...current, text: event.target.value } : current
                        )
                      }
                      placeholder="เขียนข้อความย่อหน้า..."
                      minRows={4}
                      multiline
                      fullWidth
                    />
                  )}

                  {block.type === "heading" && (
                    <Fragment>
                      <TextField
                        label="ข้อความหัวข้อ"
                        value={block.text}
                        onChange={(event) =>
                          updateBlock(block.id, (current) =>
                            current.type === "heading" ? { ...current, text: event.target.value } : current
                          )
                        }
                        placeholder="ชื่อหัวข้อ"
                        fullWidth
                      />
                      <FormControl size="small" sx={{ width: 160 }}>
                        <InputLabel id={`heading-level-${block.id}`}>ระดับหัวข้อ</InputLabel>
                        <Select
                          labelId={`heading-level-${block.id}`}
                          label="ระดับหัวข้อ"
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
                        label="ข้อความอ้างอิง"
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
                        label="แหล่งอ้างอิง"
                        value={block.citation}
                        onChange={(event) =>
                          updateBlock(block.id, (current) =>
                            current.type === "quote" ? { ...current, citation: event.target.value } : current
                          )
                        }
                        placeholder="ชื่อ หน่วยงาน หรือแหล่งที่มา"
                        fullWidth
                      />
                    </Fragment>
                  )}

                  {block.type === "checklist" && (
                    <TextField
                      label="รายการตรวจสอบ"
                      value={normalizeChecklistInput(block.items)}
                      onChange={(event) =>
                        updateBlock(block.id, (current) =>
                          current.type === "checklist"
                            ? { ...current, items: parseChecklistInput(event.target.value) }
                            : current
                        )
                      }
                      helperText="หนึ่งรายการต่อหนึ่งบรรทัด"
                      minRows={4}
                      multiline
                      fullWidth
                    />
                  )}

                  {block.type === "image" && (
                    <Fragment>
                      <TextField
                        label="ไฟล์รูปภาพ"
                        select
                        value={block.mediaId}
                        onChange={(event) =>
                          updateBlock(block.id, (current) =>
                            current.type === "image" ? { ...current, mediaId: event.target.value } : current
                          )
                        }
                        fullWidth
                      >
                        <MenuItem value="">เลือกรูปภาพจากคลังสื่อ</MenuItem>
                        {imageAssets.map((asset) => (
                          <MenuItem key={asset.id} value={asset.id}>
                            {asset.name}
                          </MenuItem>
                        ))}
                      </TextField>
                      <TextField
                        label="คำบรรยาย"
                        value={block.caption}
                        onChange={(event) =>
                          updateBlock(block.id, (current) =>
                            current.type === "image" ? { ...current, caption: event.target.value } : current
                          )
                        }
                        placeholder="คำบรรยายรูปภาพ (ไม่บังคับ)"
                        fullWidth
                      />
                    </Fragment>
                  )}

                  {block.type === "video" && (
                    <Fragment>
                      <TextField
                        label="ไฟล์วิดีโอ"
                        select
                        value={block.mediaId}
                        onChange={(event) =>
                          updateBlock(block.id, (current) =>
                            current.type === "video" ? { ...current, mediaId: event.target.value } : current
                          )
                        }
                        fullWidth
                      >
                        <MenuItem value="">เลือกวิดีโอจากคลังสื่อ</MenuItem>
                        {videoAssets.map((asset) => (
                          <MenuItem key={asset.id} value={asset.id}>
                            {asset.name}
                          </MenuItem>
                        ))}
                      </TextField>
                      <TextField
                        label="คำบรรยาย"
                        value={block.caption}
                        onChange={(event) =>
                          updateBlock(block.id, (current) =>
                            current.type === "video" ? { ...current, caption: event.target.value } : current
                          )
                        }
                        placeholder="คำบรรยายวิดีโอ (ไม่บังคับ)"
                        fullWidth
                      />
                    </Fragment>
                  )}

                  {block.type === "button" && (
                    <Fragment>
                      <TextField
                        label="ข้อความปุ่ม"
                        value={block.label}
                        onChange={(event) =>
                          updateBlock(block.id, (current) =>
                            current.type === "button" ? { ...current, label: event.target.value } : current
                          )
                        }
                        fullWidth
                      />
                      <TextField
                        label="URL ของปุ่ม"
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
                        <InputLabel id={`button-variant-${block.id}`}>รูปแบบ</InputLabel>
                        <Select
                          labelId={`button-variant-${block.id}`}
                          label="รูปแบบ"
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
                          <MenuItem value="contained">ปุ่มทึบ</MenuItem>
                          <MenuItem value="outlined">ปุ่มเส้นขอบ</MenuItem>
                        </Select>
                      </FormControl>
                    </Fragment>
                  )}

                  {block.type === "divider" && (
                    <Box>
                      <Divider sx={{ mb: 1 }} />
                      <Typography color="text.secondary" variant="body2">
                        บล็อกเส้นแบ่งใช้แยกส่วนเนื้อหาด้วยภาพ
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
