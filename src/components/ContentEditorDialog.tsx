import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import InsertDriveFileOutlinedIcon from "@mui/icons-material/InsertDriveFileOutlined";
import OndemandVideoOutlinedIcon from "@mui/icons-material/OndemandVideoOutlined";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import ContentBlockBuilder from "./ContentBlockBuilder";
import { ContentItem, ContentStatus, ContentType, MediaAsset, MediaType } from "../types";
import type { MediaAssetInput } from "../services/googleApi";
import {
  ContentBlock,
  createContentBlock,
  extractMediaIdsFromContentBlocks,
  parseContentBodyToBlocks,
  serializeContentBlocksToBody
} from "../utils/contentBlocks";
import { formatFileSize, readFileAsBase64 } from "../utils/files";

const contentTypes: ContentType[] = ["page", "news", "program", "announcement", "blog"];
const contentStatuses: ContentStatus[] = ["draft", "review", "scheduled", "published"];
const mediaTypes: MediaType[] = ["image", "document", "sheet", "video"];
const contentTemplates = ["standard", "feature", "update"];

function createDraft(): ContentItem {
  return {
    id: `content-${Date.now()}`,
    title: "",
    slug: "",
    type: "page",
    status: "draft",
    owner: "",
    summary: "",
    body: "",
    category: "",
    tags: [],
    seoTitle: "",
    seoDescription: "",
    canonicalUrl: "",
    featured: false,
    readingMinutes: 1,
    template: "standard",
    featuredMediaId: "",
    mediaIds: [],
    updatedAt: new Date().toISOString(),
    publishAt: new Date().toISOString()
  };
}

function sanitizeSlugInput(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+/, "");
}

function finalizeSlug(value: string) {
  return sanitizeSlugInput(value).replace(/-+$/g, "");
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeCategoryList(value: string | undefined) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item, index, items) => items.indexOf(item) === index);
}

function normalizeCategoryValue(value: string | undefined) {
  return normalizeCategoryList(value).join(", ");
}

function categoryToSlugList(value: string | undefined) {
  return normalizeCategoryList(value)
    .map((item) => slugify(item))
    .filter(Boolean);
}

function normalizeMediaIds(value: ContentItem["mediaIds"]) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function normalizeTags(value: ContentItem["tags"] | string | undefined) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value
      .map((tag) => tag.trim())
      .filter(Boolean)
      .filter((tag, index, tags) => tags.indexOf(tag) === index);
  }

  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .filter((tag, index, tags) => tags.indexOf(tag) === index);
}

function inferMediaType(file: File): MediaType {
  if (file.type.startsWith("image/")) {
    return "image";
  }

  if (file.type.startsWith("video/")) {
    return "video";
  }

  if (file.type.includes("spreadsheet") || file.name.match(/\.(csv|xls|xlsx)$/i)) {
    return "sheet";
  }

  return "document";
}

function mediaIcon(type: MediaType) {
  if (type === "image") {
    return <ImageOutlinedIcon />;
  }

  if (type === "video") {
    return <OndemandVideoOutlinedIcon />;
  }

  return <InsertDriveFileOutlinedIcon />;
}

interface ContentEditorDialogProps {
  open: boolean;
  item: ContentItem | null;
  mediaAssets?: MediaAsset[];
  saving?: boolean;
  errorMessage?: string;
  onClose: () => void;
  onSave: (item: ContentItem) => void;
  onUploadMedia?: (input: MediaAssetInput) => Promise<MediaAsset>;
}

export default function ContentEditorDialog({
  open,
  item,
  mediaAssets = [],
  saving = false,
  errorMessage = "",
  onClose,
  onSave,
  onUploadMedia
}: ContentEditorDialogProps) {
  const [draft, setDraft] = useState<ContentItem>(() => item ?? createDraft());
  const [pendingDraft, setPendingDraft] = useState<ContentItem | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [uploadedAssets, setUploadedAssets] = useState<MediaAsset[]>([]);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadName, setUploadName] = useState("");
  const [uploadType, setUploadType] = useState<MediaType>("image");
  const [uploadError, setUploadError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [tagInputValue, setTagInputValue] = useState("");
  const [bodyBlocks, setBodyBlocks] = useState<ContentBlock[]>([createContentBlock("paragraph")]);
  const title = useMemo(() => (item ? "Edit content" : "Add new content"), [item]);
  const confirmTitle = item ? "Save content changes?" : "Create content?";
  const confirmButton = item ? "Save" : "Create";
  const availableMedia = useMemo(() => {
    const map = new Map<string, MediaAsset>();
    [...uploadedAssets, ...mediaAssets].forEach((asset) => map.set(asset.id, asset));
    return Array.from(map.values());
  }, [mediaAssets, uploadedAssets]);
  const categorySlugs = useMemo(() => categoryToSlugList(draft.category), [draft.category]);
  const selectedMediaIds = normalizeMediaIds(draft.mediaIds);
  const selectedMedia = availableMedia.filter((asset) => selectedMediaIds.includes(asset.id));
  const featuredMedia = availableMedia.find((asset) => asset.id === draft.featuredMediaId);

  useEffect(() => {
    const nextDraft = item ?? createDraft();
    setDraft({
      ...nextDraft,
      body: nextDraft.body ?? "",
      slug: sanitizeSlugInput(nextDraft.slug ?? ""),
      category: normalizeCategoryValue(nextDraft.category ?? ""),
      tags: normalizeTags(nextDraft.tags),
      seoTitle: nextDraft.seoTitle ?? "",
      seoDescription: nextDraft.seoDescription ?? "",
      canonicalUrl: nextDraft.canonicalUrl ?? "",
      featured: Boolean(nextDraft.featured),
      readingMinutes: Math.max(1, Number(nextDraft.readingMinutes) || 1),
      template: nextDraft.template ?? "standard",
      featuredMediaId: nextDraft.featuredMediaId ?? "",
      mediaIds: normalizeMediaIds(nextDraft.mediaIds)
    });
    setPendingDraft(null);
    setConfirming(false);
    setUploadFile(null);
    setUploadName("");
    setUploadType("image");
    setUploadError("");
    setUploading(false);
    setTagInputValue("");
    const parsedBlocks = parseContentBodyToBlocks(nextDraft.body);
    setBodyBlocks(parsedBlocks.length ? parsedBlocks : [createContentBlock("paragraph")]);
  }, [item, open]);

  function setDraftTags(nextTags: string[]) {
    setDraft((current) => ({
      ...current,
      tags: normalizeTags(nextTags),
      updatedAt: new Date().toISOString()
    }));
  }

  function commitTagInput(value: string) {
    const parsedTags = normalizeTags(value);

    if (!parsedTags.length) {
      return false;
    }

    setDraft((current) => ({
      ...current,
      tags: normalizeTags([...(current.tags ?? []), ...parsedTags]),
      updatedAt: new Date().toISOString()
    }));
    setTagInputValue("");
    return true;
  }

  function updateDraft<K extends keyof ContentItem>(key: K, value: ContentItem[K]) {
    setDraft((current) => ({
      ...current,
      [key]: value,
      updatedAt: new Date().toISOString()
    }));
  }

  function handleTitleChange(value: string) {
    setDraft((current) => ({
      ...current,
      title: value,
      slug: current.slug ? current.slug : sanitizeSlugInput(slugify(value)),
      updatedAt: new Date().toISOString()
    }));
  }

  function toggleMedia(asset: MediaAsset) {
    setDraft((current) => {
      const ids = normalizeMediaIds(current.mediaIds);
      const hasAsset = ids.includes(asset.id);
      const mediaIds = hasAsset ? ids.filter((id) => id !== asset.id) : [...ids, asset.id];
      const featuredMediaId =
        hasAsset && current.featuredMediaId === asset.id
          ? ""
          : current.featuredMediaId || (asset.type === "image" || asset.type === "video" ? asset.id : "");

      return {
        ...current,
        mediaIds,
        featuredMediaId,
        updatedAt: new Date().toISOString()
      };
    });
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setUploadFile(file);
    setUploadError("");

    if (file) {
      setUploadName(file.name.replace(/\.[^.]+$/, ""));
      setUploadType(inferMediaType(file));
    }
  }

  async function handleUploadMedia() {
    if (!uploadFile || !onUploadMedia) {
      setUploadError("Choose a file before uploading.");
      return;
    }

    try {
      setUploading(true);
      setUploadError("");
      const fileBase64 = await readFileAsBase64(uploadFile);
      const asset = await onUploadMedia({
        name: uploadName.trim() || uploadFile.name,
        type: uploadType,
        size: formatFileSize(uploadFile.size),
        owner: draft.owner.trim() || "CMS editor",
        fileName: uploadFile.name,
        fileBase64,
        mimeType: uploadFile.type
      });

      setUploadedAssets((current) => [asset, ...current.filter((item) => item.id !== asset.id)]);
      setDraft((current) => ({
        ...current,
        mediaIds: Array.from(new Set([...normalizeMediaIds(current.mediaIds), asset.id])),
        featuredMediaId: current.featuredMediaId || (asset.type === "image" || asset.type === "video" ? asset.id : ""),
        updatedAt: new Date().toISOString()
      }));
      setUploadFile(null);
      setUploadName("");
      setUploadType("image");
    } catch (currentError) {
      setUploadError(currentError instanceof Error ? currentError.message : "Unable to upload media.");
    } finally {
      setUploading(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const serializedBody = serializeContentBlocksToBody(bodyBlocks);
    const blockMediaIds = extractMediaIdsFromContentBlocks(bodyBlocks);
    const nextDraft = {
      ...draft,
      slug: finalizeSlug(draft.slug || slugify(draft.title)),
      body: serializedBody,
      category: normalizeCategoryValue(draft.category ?? ""),
      tags: normalizeTags(draft.tags),
      seoTitle: draft.seoTitle ?? "",
      seoDescription: draft.seoDescription ?? "",
      canonicalUrl: draft.canonicalUrl ?? "",
      featured: Boolean(draft.featured),
      readingMinutes: Math.max(1, Number(draft.readingMinutes) || 1),
      template: draft.template ?? "standard",
      featuredMediaId: draft.featuredMediaId ?? "",
      mediaIds: Array.from(new Set([...normalizeMediaIds(draft.mediaIds), ...blockMediaIds])),
      updatedAt: new Date().toISOString()
    };

    setPendingDraft(nextDraft);
    setConfirming(true);
  }

  function handleConfirmSave() {
    if (pendingDraft) {
      onSave(pendingDraft);
    }
  }

  function handleClose() {
    setConfirming(false);
    setPendingDraft(null);
    onClose();
  }

  function handleBodyBlocksChange(nextBlocks: ContentBlock[]) {
    setBodyBlocks(nextBlocks);
    const blockMediaIds = extractMediaIdsFromContentBlocks(nextBlocks);

    if (!blockMediaIds.length) {
      return;
    }

    setDraft((current) => ({
      ...current,
      mediaIds: Array.from(new Set([...normalizeMediaIds(current.mediaIds), ...blockMediaIds])),
      updatedAt: new Date().toISOString()
    }));
  }

  return (
    <Dialog open={open} onClose={saving || uploading ? undefined : handleClose} fullWidth maxWidth="lg">
      <form onSubmit={handleSubmit}>
        <DialogTitle>
          <Typography variant="h2" sx={{ fontSize: "1.45rem" }}>
            {confirming ? confirmTitle : title}
          </Typography>
          {!confirming && (
            <Typography color="text.secondary" variant="body2">
              Edit content, attach media, and set publishing details in one workspace.
            </Typography>
          )}
        </DialogTitle>
        <DialogContent dividers>
          {confirming && pendingDraft ? (
            <Stack spacing={1.5} sx={{ pt: 1 }}>
              {errorMessage && <Alert severity="error">{errorMessage}</Alert>}
              <Typography color="text.secondary">
                Confirm this record before saving.
              </Typography>
              <Typography fontWeight={900}>{pendingDraft.title}</Typography>
              <Typography color="text.secondary">
                {pendingDraft.type} / {pendingDraft.status} / {pendingDraft.owner}
              </Typography>
              {!!pendingDraft.category && (
                <Typography color="text.secondary">Category: {pendingDraft.category}</Typography>
              )}
              {!!categoryToSlugList(pendingDraft.category).length && (
                <Typography color="text.secondary">
                  Category slugs: {categoryToSlugList(pendingDraft.category).join(", ")}
                </Typography>
              )}
              {!!normalizeTags(pendingDraft.tags).length && (
                <Typography color="text.secondary">
                  Tags: {normalizeTags(pendingDraft.tags).join(", ")}
                </Typography>
              )}
              <Typography color="text.secondary">
                {normalizeMediaIds(pendingDraft.mediaIds).length} media item(s) attached.
              </Typography>
            </Stack>
          ) : (
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1fr) 330px" },
                gap: 2.5,
                pt: 1
              }}
            >
              <Stack spacing={2.2}>
                {errorMessage && <Alert severity="error">{errorMessage}</Alert>}
                <TextField
                  label="Title"
                  value={draft.title}
                  onChange={(event) => handleTitleChange(event.target.value)}
                  required
                  fullWidth
                />
                <TextField
                  label="Permalink slug"
                  value={draft.slug}
                  onChange={(event) => updateDraft("slug", sanitizeSlugInput(event.target.value))}
                  helperText="Use lowercase words with hyphens, for example: student-life-updates"
                  required
                  fullWidth
                />
                <ContentBlockBuilder
                  blocks={bodyBlocks}
                  mediaAssets={availableMedia}
                  onChange={handleBodyBlocksChange}
                />
                <TextField
                  label="Excerpt"
                  value={draft.summary}
                  onChange={(event) => updateDraft("summary", event.target.value)}
                  minRows={3}
                  multiline
                  fullWidth
                />
              </Stack>
              <Stack
                spacing={2}
                sx={{
                  p: 2,
                  border: "1px solid rgba(31, 90, 44, 0.14)",
                  borderRadius: 2,
                  bgcolor: "background.default",
                  alignSelf: "start"
                }}
              >
                <Typography fontWeight={900}>Publish</Typography>
                <FormControl fullWidth size="small">
                  <InputLabel id="content-type-label">Type</InputLabel>
                  <Select
                    labelId="content-type-label"
                    label="Type"
                    value={draft.type}
                    onChange={(event) => updateDraft("type", event.target.value as ContentType)}
                  >
                    {contentTypes.map((type) => (
                      <MenuItem key={type} value={type}>
                        {type}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl fullWidth size="small">
                  <InputLabel id="content-status-label">Status</InputLabel>
                  <Select
                    labelId="content-status-label"
                    label="Status"
                    value={draft.status}
                    onChange={(event) => updateDraft("status", event.target.value as ContentStatus)}
                  >
                    {contentStatuses.map((status) => (
                      <MenuItem key={status} value={status}>
                        {status}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField
                  label="Owner"
                  value={draft.owner}
                  onChange={(event) => updateDraft("owner", event.target.value)}
                  required
                  size="small"
                  fullWidth
                />
                <TextField
                  label="Publish date"
                  type="datetime-local"
                  value={draft.publishAt ? draft.publishAt.slice(0, 16) : ""}
                  onChange={(event) =>
                    updateDraft(
                      "publishAt",
                      event.target.value
                        ? new Date(event.target.value).toISOString()
                        : new Date().toISOString()
                    )
                  }
                  InputLabelProps={{ shrink: true }}
                  size="small"
                  fullWidth
                />
                <Divider />
                <Typography fontWeight={900}>Taxonomy</Typography>
                <TextField
                  label="Category"
                  value={draft.category ?? ""}
                  onChange={(event) => updateDraft("category", event.target.value)}
                  placeholder="e.g. Admissions, Research, Student Life"
                  helperText="Use commas to create multiple categories (WordPress style)."
                  size="small"
                  fullWidth
                />
                <TextField
                  label="Category slugs"
                  value={categorySlugs.join(", ")}
                  helperText="Auto-generated from category names."
                  size="small"
                  fullWidth
                  InputProps={{ readOnly: true }}
                />
                <Autocomplete
                  multiple
                  freeSolo
                  options={[]}
                  value={normalizeTags(draft.tags)}
                  inputValue={tagInputValue}
                  onChange={(_, nextValue) => {
                    setDraftTags(nextValue);
                  }}
                  onInputChange={(_, nextValue, reason) => {
                    if (reason === "reset") {
                      setTagInputValue("");
                      return;
                    }

                    if (nextValue.includes(",")) {
                      const segments = nextValue.split(",");
                      const completedTags = segments.slice(0, -1).join(",");
                      const pendingValue = segments[segments.length - 1] || "";

                      if (completedTags.trim()) {
                        commitTagInput(completedTags);
                      }

                      setTagInputValue(pendingValue.trimStart());
                      return;
                    }

                    setTagInputValue(nextValue);
                  }}
                  renderTags={(value, getTagProps) =>
                    value.map((option, index) => (
                      <Chip
                        {...getTagProps({ index })}
                        key={`${option}-${index}`}
                        label={option}
                        size="small"
                      />
                    ))
                  }
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Tags"
                      placeholder="Type tag and press Enter or comma"
                      helperText="Comma, Enter, or Tab adds a tag card."
                      size="small"
                      fullWidth
                      onKeyDown={(event) => {
                        if (event.key === "," || event.key === "Enter" || event.key === "Tab") {
                          if (commitTagInput(tagInputValue)) {
                            event.preventDefault();
                          }
                        }
                      }}
                      onBlur={() => {
                        commitTagInput(tagInputValue);
                      }}
                    />
                  )}
                />
                <FormControl fullWidth size="small">
                  <InputLabel id="content-template-label">Template</InputLabel>
                  <Select
                    labelId="content-template-label"
                    label="Template"
                    value={draft.template ?? "standard"}
                    onChange={(event) => updateDraft("template", event.target.value)}
                  >
                    {contentTemplates.map((template) => (
                      <MenuItem key={template} value={template}>
                        {template}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField
                  label="Reading time (minutes)"
                  type="number"
                  value={Math.max(1, Number(draft.readingMinutes) || 1)}
                  onChange={(event) =>
                    updateDraft("readingMinutes", Math.max(1, Number(event.target.value) || 1))
                  }
                  size="small"
                  fullWidth
                  inputProps={{ min: 1, step: 1 }}
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={Boolean(draft.featured)}
                      onChange={(event) => updateDraft("featured", event.target.checked)}
                      size="small"
                    />
                  }
                  label="Featured story"
                />
                <Divider />
                <Typography fontWeight={900}>SEO</Typography>
                <TextField
                  label="SEO title"
                  value={draft.seoTitle ?? ""}
                  onChange={(event) => updateDraft("seoTitle", event.target.value)}
                  size="small"
                  fullWidth
                />
                <TextField
                  label="SEO description"
                  value={draft.seoDescription ?? ""}
                  onChange={(event) => updateDraft("seoDescription", event.target.value)}
                  size="small"
                  minRows={2}
                  multiline
                  fullWidth
                />
                <TextField
                  label="Canonical URL"
                  value={draft.canonicalUrl ?? ""}
                  onChange={(event) => updateDraft("canonicalUrl", event.target.value)}
                  placeholder="https://example.edu/blog/post"
                  size="small"
                  fullWidth
                />
                <Divider />
                <Typography fontWeight={900}>Featured media</Typography>
                <Box
                  sx={{
                    minHeight: 120,
                    borderRadius: 2,
                    border: "1px dashed rgba(31, 90, 44, 0.22)",
                    display: "grid",
                    placeItems: "center",
                    overflow: "hidden",
                    bgcolor: "white"
                  }}
                >
                  {featuredMedia?.type === "image" && featuredMedia.previewUrl ? (
                    <Box
                      component="img"
                      src={featuredMedia.previewUrl}
                      alt={featuredMedia.name}
                      sx={{ width: "100%", height: 150, objectFit: "cover" }}
                    />
                  ) : featuredMedia ? (
                    <Stack spacing={0.75} alignItems="center" sx={{ p: 2, textAlign: "center" }}>
                      {mediaIcon(featuredMedia.type)}
                      <Typography fontWeight={800}>{featuredMedia.name}</Typography>
                    </Stack>
                  ) : (
                    <Typography color="text.secondary" variant="body2">
                      Select an image or video below.
                    </Typography>
                  )}
                </Box>
                <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                  {selectedMedia.map((asset) => (
                    <Chip
                      key={asset.id}
                      label={asset.name}
                      onDelete={() => toggleMedia(asset)}
                      size="small"
                      sx={{ maxWidth: "100%" }}
                    />
                  ))}
                  {!selectedMedia.length && (
                    <Typography color="text.secondary" variant="body2">
                      No media attached.
                    </Typography>
                  )}
                </Stack>
                <Divider />
                <Typography fontWeight={900}>Media library</Typography>
                <Stack spacing={1} sx={{ maxHeight: 260, overflowY: "auto", pr: 0.5 }}>
                  {availableMedia.map((asset) => {
                    const checked = selectedMediaIds.includes(asset.id);
                    return (
                      <Box
                        key={asset.id}
                        sx={{
                          display: "grid",
                          gridTemplateColumns: "auto 42px minmax(0, 1fr)",
                          gap: 1,
                          alignItems: "center",
                          p: 1,
                          borderRadius: 1.5,
                          bgcolor: checked ? "primary.light" : "white",
                          border: "1px solid rgba(31, 90, 44, 0.12)"
                        }}
                      >
                        <Checkbox checked={checked} onChange={() => toggleMedia(asset)} size="small" />
                        <Box
                          sx={{
                            width: 42,
                            height: 42,
                            borderRadius: 1,
                            display: "grid",
                            placeItems: "center",
                            bgcolor: "background.default",
                            color: "primary.main",
                            overflow: "hidden"
                          }}
                        >
                          {asset.type === "image" && asset.previewUrl ? (
                            <Box
                              component="img"
                              src={asset.previewUrl}
                              alt={asset.name}
                              sx={{ width: "100%", height: "100%", objectFit: "cover" }}
                            />
                          ) : (
                            mediaIcon(asset.type)
                          )}
                        </Box>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography fontWeight={800} noWrap>
                            {asset.name}
                          </Typography>
                          <Stack direction="row" spacing={0.75} alignItems="center">
                            <Typography color="text.secondary" variant="caption">
                              {asset.type}
                            </Typography>
                            {checked && (asset.type === "image" || asset.type === "video") && (
                              <Button
                                size="small"
                                onClick={() => updateDraft("featuredMediaId", asset.id)}
                                sx={{ minHeight: 0, p: 0, fontSize: "0.72rem" }}
                              >
                                Feature
                              </Button>
                            )}
                          </Stack>
                        </Box>
                      </Box>
                    );
                  })}
                  {!availableMedia.length && (
                    <Typography color="text.secondary" variant="body2">
                      Upload media or add items in the Media Library.
                    </Typography>
                  )}
                </Stack>
                <Divider />
                <Typography fontWeight={900}>Quick upload</Typography>
                {uploadError && <Alert severity="error">{uploadError}</Alert>}
                <Button component="label" variant="outlined" startIcon={<UploadFileOutlinedIcon />} disabled={uploading}>
                  Choose file
                  <input hidden type="file" accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.csv" onChange={handleFileChange} />
                </Button>
                {uploadFile && (
                  <Typography color="text.secondary" variant="body2">
                    {uploadFile.name} / {formatFileSize(uploadFile.size)}
                  </Typography>
                )}
                <TextField
                  label="Media title"
                  value={uploadName}
                  onChange={(event) => setUploadName(event.target.value)}
                  size="small"
                  fullWidth
                />
                <TextField
                  label="Type"
                  value={uploadType}
                  onChange={(event) => setUploadType(event.target.value as MediaType)}
                  size="small"
                  select
                  fullWidth
                >
                  {mediaTypes.map((type) => (
                    <MenuItem key={type} value={type}>
                      {type}
                    </MenuItem>
                  ))}
                </TextField>
                <Button
                  type="button"
                  variant="contained"
                  disabled={uploading || !uploadFile || !onUploadMedia}
                  onClick={() => void handleUploadMedia()}
                >
                  {uploading ? "Uploading" : "Upload and attach"}
                </Button>
              </Stack>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          {confirming ? (
            <>
              <Button type="button" onClick={() => setConfirming(false)} disabled={saving}>
                Back
              </Button>
              <Button
                type="button"
                variant="contained"
                startIcon={<SaveOutlinedIcon />}
                disabled={saving}
                onClick={handleConfirmSave}
              >
                {saving ? "Saving" : confirmButton}
              </Button>
            </>
          ) : (
            <>
              <Button type="button" onClick={handleClose} disabled={saving || uploading}>
                Cancel
              </Button>
              <Button type="submit" variant="contained" startIcon={<SaveOutlinedIcon />} disabled={saving || uploading}>
                Continue
              </Button>
            </>
          )}
        </DialogActions>
      </form>
    </Dialog>
  );
}
