import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import InsertDriveFileOutlinedIcon from "@mui/icons-material/InsertDriveFileOutlined";
import OndemandVideoOutlinedIcon from "@mui/icons-material/OndemandVideoOutlined";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import ResponsiveDialogActions from "../../design-system/components/ResponsiveDialogActions";
import { designTokens } from "../../design-system/tokens";
import { staticSurfaceSx } from "../../design-system/componentStyles";
import AdminPagination from "./AdminPagination";
import ContentBlockBuilder from "./ContentBlockBuilder";
import { ContentItem, ContentStatus, ContentType, MediaAsset, MediaType } from "../../types";
import { MAX_MEDIA_UPLOAD_BYTES } from "../../features/cms-media";
import type { MediaAssetInput } from "../../features/cms-media";
import { contentStatusLabels, contentTypeLabels, mediaTypeLabels } from "../../utils/thaiLabels";
import { CONTENT_TEMPLATE_LABELS, CONTENT_TEMPLATES, resolveContentTemplate } from "../../utils/contentTemplate";
import {
  ContentBlock,
  createContentBlock,
  extractMediaIdsFromContentBlocks,
  parseContentBodyToBlocks,
  serializeContentBlocksToBody
} from "../../utils/contentBlocks";
import { formatFileSize, readFileAsBase64 } from "../../utils/files";
import { fromLocalDateTimeInputValue, toLocalDateTimeInputValue } from "../../utils/calendar";
import { finalizeSlug, sanitizeSlugInput, slugify } from "../../utils/slug";
import {
  ADMIN_MEDIA_BY_IDS_MAX,
  ADMIN_MEDIA_PAGE_SIZE_OPTIONS,
  adminMediaListQueryOptions,
  getAdminMediaByIds,
  useDebouncedValue
} from "../../features/admin-pagination";
import {
  CMS_SESSION_EXPIRED_EVENT,
  CMS_SESSION_EXPIRED_MESSAGE,
  CMS_SESSION_NOTICE_KEY
} from "../../features/cms-auth/constants";
import { writeContentDraftRecovery, type ContentDraftRecoveryMode } from "../../features/cms-content/draftRecovery";

const contentTypes: ContentType[] = ["page", "news", "program", "announcement", "blog"];
const contentStatuses: ContentStatus[] = ["draft", "review", "scheduled", "published"];
const mediaTypes: MediaType[] = ["image", "document", "sheet", "video"];
type MediaLibraryFilter = MediaType | "all";
const emptyMediaAssets: MediaAsset[] = [];

type ContentMetadataPreset = {
  label: string;
  group: string;
  category: string;
  tags: string[];
  contentTypes?: ContentType[];
};

const contentMetadataPresets: ContentMetadataPreset[] = [
  {
    label: "จัดซื้อจัดจ้าง",
    group: "จัดซื้อจัดจ้าง",
    category: "จัดซื้อจัดจ้าง",
    tags: ["จัดซื้อ", "จัดจ้าง", "จัดซื้อจัดจ้าง", "procurement"],
    contentTypes: ["announcement"]
  },
  {
    label: "ประกวดราคา / TOR",
    group: "จัดซื้อจัดจ้าง",
    category: "จัดซื้อจัดจ้าง",
    tags: ["ประกวดราคา", "TOR", "จัดซื้อจัดจ้าง", "procurement"],
    contentTypes: ["announcement"]
  },
  {
    label: "สมัครงาน",
    group: "สมัครงาน / หางาน",
    category: "สมัครงาน",
    tags: ["สมัครงาน", "recruitment", "job"],
    contentTypes: ["announcement", "news"]
  },
  {
    label: "หางาน / ตำแหน่งงาน",
    group: "สมัครงาน / หางาน",
    category: "หางาน",
    tags: ["หางาน", "ตำแหน่งงาน", "jobs"],
    contentTypes: ["announcement", "news"]
  },
  {
    label: "ฝึกงาน",
    group: "สมัครงาน / หางาน",
    category: "ฝึกงาน",
    tags: ["ฝึกงาน", "job", "career"],
    contentTypes: ["announcement", "news"]
  },
  {
    label: "แนะแนวอาชีพ",
    group: "สมัครงาน / หางาน",
    category: "แนะแนวอาชีพ",
    tags: ["แนะแนวอาชีพ", "หางาน", "career"],
    contentTypes: ["announcement", "news", "blog"]
  },
  {
    label: "ผลงาน / ความสำเร็จ",
    group: "ผลงาน",
    category: "ผลงาน",
    tags: ["ผลงาน", "ความสำเร็จ", "achievement", "success"],
    contentTypes: ["news", "announcement", "blog", "page"]
  },
  {
    label: "รางวัล / เกียรติยศ",
    group: "ผลงาน",
    category: "รางวัล",
    tags: ["รางวัล", "เกียรติยศ", "award", "honor"],
    contentTypes: ["news", "announcement", "blog", "page"]
  },
  {
    label: "นวัตกรรม",
    group: "ผลงาน",
    category: "นวัตกรรม",
    tags: ["นวัตกรรม", "innovation", "highlight"],
    contentTypes: ["news", "blog", "page"]
  },
  {
    label: "ทวิภาคี / ความร่วมมือ",
    group: "ผลงาน",
    category: "ทวิภาคี",
    tags: ["ทวิภาคี", "ความร่วมมือ", "achievement"],
    contentTypes: ["news", "announcement", "blog", "page"]
  },
  {
    label: "เอกสารเผยแพร่",
    group: "เอกสาร",
    category: "เอกสาร",
    tags: ["เอกสาร", "document"],
    contentTypes: ["page", "announcement"]
  },
  {
    label: "ITA",
    group: "เอกสาร",
    category: "ITA",
    tags: ["ITA", "เอกสาร", "document"],
    contentTypes: ["page"]
  },
  {
    label: "แผนงาน / แผนปฏิบัติการ",
    group: "เอกสาร",
    category: "แผนงาน",
    tags: ["แผนงาน", "แผนปฏิบัติการ", "document"],
    contentTypes: ["page"]
  },
  {
    label: "ประกันคุณภาพ",
    group: "เอกสาร",
    category: "ประกันคุณภาพ",
    tags: ["ประกันคุณภาพ", "เอกสาร", "document"],
    contentTypes: ["page"]
  }
];

function createDraft(): ContentItem {
  return {
    id: "",
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

function normalizeEditorDraft(source: ContentItem): ContentItem {
  return {
    ...source,
    body: source.body ?? "",
    slug: sanitizeSlugInput(source.slug ?? ""),
    category: normalizeCategoryValue(source.category ?? ""),
    tags: normalizeTags(source.tags),
    seoTitle: source.seoTitle ?? "",
    seoDescription: source.seoDescription ?? "",
    canonicalUrl: source.canonicalUrl ?? "",
    featured: Boolean(source.featured),
    readingMinutes: Math.max(1, Number(source.readingMinutes) || 1),
    template: resolveContentTemplate(source),
    featuredMediaId: source.featuredMediaId ?? "",
    mediaIds: normalizeMediaIds(source.mediaIds)
  };
}

function createEditorDraft(item: ContentItem | null) {
  return normalizeEditorDraft(item ?? createDraft());
}

function createBodyBlocks(body: string | undefined) {
  const parsedBlocks = parseContentBodyToBlocks(body);
  return parsedBlocks.length ? parsedBlocks : [createContentBlock("paragraph")];
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
    .filter(Boolean)
    .filter((slug, index, slugs) => slugs.indexOf(slug) === index);
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

function getAvailableMetadataPresets(type: ContentType) {
  return contentMetadataPresets.filter((preset) => !preset.contentTypes || preset.contentTypes.includes(type));
}

function groupMetadataPresets(presets: ContentMetadataPreset[]) {
  return presets.reduce<Array<{ name: string; presets: ContentMetadataPreset[] }>>((groups, preset) => {
    const currentGroup = groups.find((group) => group.name === preset.group);

    if (currentGroup) {
      currentGroup.presets.push(preset);
      return groups;
    }

    return [...groups, { name: preset.group, presets: [preset] }];
  }, []);
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
  mode?: ContentDraftRecoveryMode;
  ownerUserId?: string;
  recovered?: boolean;
  recoveredTagInputValue?: string;
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
  mode = item ? "edit" : "create",
  ownerUserId = "",
  recovered = false,
  recoveredTagInputValue = "",
  mediaAssets = emptyMediaAssets,
  saving = false,
  errorMessage = "",
  onClose,
  onSave,
  onUploadMedia
}: ContentEditorDialogProps) {
  const [draftSource, setDraftSource] = useState(() => ({ item, mode, open, recovered, recoveredTagInputValue }));
  const [draft, setDraft] = useState<ContentItem>(() => createEditorDraft(item));
  const [slugIsUserControlled, setSlugIsUserControlled] = useState(() => Boolean(item?.slug));
  const [pendingDraft, setPendingDraft] = useState<ContentItem | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [uploadedAssets, setUploadedAssets] = useState<MediaAsset[]>([]);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadName, setUploadName] = useState("");
  const [uploadType, setUploadType] = useState<MediaType>("image");
  const [uploadError, setUploadError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [tagInputValue, setTagInputValue] = useState(() => (recovered ? recoveredTagInputValue : ""));
  const [bodyBlocks, setBodyBlocks] = useState<ContentBlock[]>(() => createBodyBlocks(item?.body));
  const [mediaPage, setMediaPage] = useState(1);
  const [mediaPageSize, setMediaPageSize] = useState(24);
  const [mediaSearch, setMediaSearch] = useState("");
  const [mediaFilter, setMediaFilter] = useState<MediaLibraryFilter>("all");
  const draftRef = useRef(draft);
  const bodyBlocksRef = useRef(bodyBlocks);
  const tagInputValueRef = useRef(tagInputValue);
  const dirtyRef = useRef(recovered);
  const lastRecoveryFingerprintRef = useRef("");
  const persistRecoveryRef = useRef<(force?: boolean) => boolean>(() => false);
  const debouncedMediaSearch = useDebouncedValue(mediaSearch, 300);
  const mediaListQuery = useQuery({
    ...adminMediaListQueryOptions({
      page: mediaPage,
      pageSize: mediaPageSize,
      q: debouncedMediaSearch,
      type: mediaFilter,
      sortBy: "updatedAt",
      sortDirection: "desc"
    }),
    enabled: open
  });
  const title = useMemo(() => (mode === "edit" ? "แก้ไขเนื้อหา" : "เพิ่มเนื้อหาใหม่"), [mode]);
  const confirmTitle = mode === "edit" ? "บันทึกการแก้ไขเนื้อหา?" : "สร้างเนื้อหา?";
  const confirmButton = mode === "edit" ? "บันทึก" : "สร้าง";
  const selectedMediaIds = useMemo(() => normalizeMediaIds(draft.mediaIds), [draft.mediaIds]);
  const allSelectedLookupIds = useMemo(
    () =>
      Array.from(
        new Set(
          [...selectedMediaIds, draft.featuredMediaId ?? "", ...extractMediaIdsFromContentBlocks(bodyBlocks)].filter(
            Boolean
          )
        )
      ),
    [bodyBlocks, draft.featuredMediaId, selectedMediaIds]
  );
  const selectedLookupIds = useMemo(
    () => allSelectedLookupIds.slice(0, ADMIN_MEDIA_BY_IDS_MAX),
    [allSelectedLookupIds]
  );
  const selectedMediaQuery = useQuery({
    queryKey: ["admin-media-by-ids", selectedLookupIds],
    queryFn: () => getAdminMediaByIds(selectedLookupIds),
    enabled: open && selectedLookupIds.length > 0
  });
  const pageMedia = mediaListQuery.data?.items ?? emptyMediaAssets;
  const selectedLookupMedia = selectedMediaQuery.data ?? emptyMediaAssets;
  const availableMedia = useMemo(() => {
    const map = new Map<string, MediaAsset>();
    [...mediaAssets, ...pageMedia, ...selectedLookupMedia, ...uploadedAssets].forEach((asset) =>
      map.set(asset.id, asset)
    );
    return Array.from(map.values());
  }, [mediaAssets, pageMedia, selectedLookupMedia, uploadedAssets]);
  const libraryMedia = useMemo(() => {
    const map = new Map<string, MediaAsset>();
    [...pageMedia, ...uploadedAssets].forEach((asset) => map.set(asset.id, asset));
    return Array.from(map.values());
  }, [pageMedia, uploadedAssets]);
  const categorySlugs = useMemo(() => categoryToSlugList(draft.category), [draft.category]);
  const draftTemplate = resolveContentTemplate(draft);
  const pendingDraftTemplate = pendingDraft ? resolveContentTemplate(pendingDraft) : "standard";
  const isDraftFacebookEmbed = draftTemplate === "facebook-embed";
  const isPendingDraftFacebookEmbed = pendingDraftTemplate === "facebook-embed";
  const metadataPresetGroups = useMemo(
    () => groupMetadataPresets(getAvailableMetadataPresets(draft.type)),
    [draft.type]
  );
  const selectedMedia = availableMedia.filter((asset) => selectedMediaIds.includes(asset.id));
  const featuredMedia = availableMedia.find((asset) => asset.id === draft.featuredMediaId);

  useEffect(() => {
    draftRef.current = draft;
    bodyBlocksRef.current = bodyBlocks;
    tagInputValueRef.current = tagInputValue;
  }, [bodyBlocks, draft, tagInputValue]);

  useEffect(() => {
    persistRecoveryRef.current = (force = false) => {
      if (!open || !ownerUserId || !dirtyRef.current) {
        return false;
      }

      const recoveryItem = {
        ...draftRef.current,
        body: serializeContentBlocksToBody(bodyBlocksRef.current)
      };
      const fingerprint = JSON.stringify({
        mode,
        ownerUserId,
        item: recoveryItem,
        tagInputValue: tagInputValueRef.current
      });

      if (!force && fingerprint === lastRecoveryFingerprintRef.current) {
        return true;
      }

      const saved = writeContentDraftRecovery({
        mode,
        ownerUserId,
        item: recoveryItem,
        tagInputValue: tagInputValueRef.current
      });

      if (saved) {
        lastRecoveryFingerprintRef.current = fingerprint;
      }

      return saved;
    };
  }, [mode, open, ownerUserId]);

  useEffect(() => {
    if (!open || !ownerUserId) {
      return;
    }

    const persistRecovery = () => persistRecoveryRef.current();
    const handleSessionExpired = () => {
      if (!dirtyRef.current) {
        return;
      }

      persistRecoveryRef.current(true);

      try {
        window.sessionStorage.setItem(
          CMS_SESSION_NOTICE_KEY,
          `${CMS_SESSION_EXPIRED_MESSAGE} ระบบเก็บฉบับร่างเนื้อหาไว้ในแท็บนี้แล้ว`
        );
      } catch {
        // The standard expiry notice remains available when draft notice storage is blocked.
      }
    };
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) {
        return;
      }

      persistRecoveryRef.current(true);
      event.preventDefault();
      event.returnValue = "";
    };
    const recoveryTimer = window.setInterval(persistRecovery, 1000);

    window.addEventListener(CMS_SESSION_EXPIRED_EVENT, handleSessionExpired);
    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("pagehide", persistRecovery);

    return () => {
      window.clearInterval(recoveryTimer);
      window.removeEventListener(CMS_SESSION_EXPIRED_EVENT, handleSessionExpired);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("pagehide", persistRecovery);
    };
  }, [open, ownerUserId]);

  if (
    draftSource.item !== item ||
    draftSource.mode !== mode ||
    draftSource.open !== open ||
    draftSource.recovered !== recovered ||
    draftSource.recoveredTagInputValue !== recoveredTagInputValue
  ) {
    const nextDraft = createEditorDraft(item);
    setDraftSource({ item, mode, open, recovered, recoveredTagInputValue });
    setDraft(nextDraft);
    setSlugIsUserControlled(Boolean(item?.slug));
    setPendingDraft(null);
    setConfirming(false);
    setDiscarding(false);
    setUploadFile(null);
    setUploadName("");
    setUploadType("image");
    setUploadError("");
    setUploading(false);
    setTagInputValue(recovered ? recoveredTagInputValue : "");
    setBodyBlocks(createBodyBlocks(nextDraft.body));
    setMediaPage(1);
    setMediaSearch("");
    setMediaFilter("all");
  }

  useEffect(() => {
    dirtyRef.current = recovered;
    lastRecoveryFingerprintRef.current = "";
  }, [draftSource, recovered]);

  function markDirty() {
    dirtyRef.current = true;
  }

  function setDraftTags(nextTags: string[]) {
    markDirty();
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

    markDirty();

    setDraft((current) => ({
      ...current,
      tags: normalizeTags([...(current.tags ?? []), ...parsedTags]),
      updatedAt: new Date().toISOString()
    }));
    setTagInputValue("");
    return true;
  }

  function updateDraft<K extends keyof ContentItem>(key: K, value: ContentItem[K]) {
    markDirty();
    setDraft((current) => ({
      ...current,
      [key]: value,
      updatedAt: new Date().toISOString()
    }));
  }

  function mergeCategoryValue(currentCategory: string | undefined, nextCategory: string) {
    return normalizeCategoryValue([currentCategory, nextCategory].filter(Boolean).join(", "));
  }

  function mergeTagsValue(currentTags: ContentItem["tags"] | undefined, nextTags: string[]) {
    return normalizeTags([...normalizeTags(currentTags), ...nextTags]);
  }

  function applyMetadataPreset(preset: ContentMetadataPreset) {
    markDirty();
    setDraft((current) => ({
      ...current,
      category: mergeCategoryValue(current.category, preset.category),
      tags: mergeTagsValue(current.tags, preset.tags),
      updatedAt: new Date().toISOString()
    }));
  }

  function handleTitleChange(value: string) {
    markDirty();
    setDraft((current) => ({
      ...current,
      title: value,
      slug: slugIsUserControlled ? current.slug : slugify(value),
      updatedAt: new Date().toISOString()
    }));
  }

  function handleSlugChange(value: string) {
    const nextSlug = sanitizeSlugInput(value);
    setSlugIsUserControlled(Boolean(nextSlug));
    updateDraft("slug", nextSlug);
  }

  function toggleMedia(asset: MediaAsset) {
    markDirty();
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

    if (file && file.size > MAX_MEDIA_UPLOAD_BYTES) {
      setUploadFile(null);
      setUploadName("");
      setUploadType("image");
      setUploadError("ไฟล์ต้องมีขนาดไม่เกิน 100 MB");
      event.target.value = "";
      return;
    }

    setUploadFile(file);
    setUploadError("");

    if (file) {
      setUploadName(file.name.replace(/\.[^.]+$/, ""));
      setUploadType(inferMediaType(file));
    }
  }

  async function handleUploadMedia() {
    if (!uploadFile || !onUploadMedia) {
      setUploadError("กรุณาเลือกไฟล์ก่อนอัปโหลด");
      return;
    }

    if (uploadFile.size > MAX_MEDIA_UPLOAD_BYTES) {
      setUploadFile(null);
      setUploadName("");
      setUploadType("image");
      setUploadError("ไฟล์ต้องมีขนาดไม่เกิน 100 MB");
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
        owner: draft.owner.trim() || "ผู้แก้ไข CMS",
        fileName: uploadFile.name,
        fileBase64,
        mimeType: uploadFile.type
      });

      markDirty();
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
      setUploadError(currentError instanceof Error ? currentError.message : "ไม่สามารถอัปโหลดสื่อได้");
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
      template: resolveContentTemplate(draft),
      featuredMediaId: draft.featuredMediaId ?? "",
      mediaIds: Array.from(new Set([...normalizeMediaIds(draft.mediaIds), ...blockMediaIds])),
      updatedAt: new Date().toISOString()
    };

    setPendingDraft(nextDraft);
    setConfirming(true);
    writeContentDraftRecovery({ mode, ownerUserId, item: nextDraft, tagInputValue });
  }

  function handleConfirmSave() {
    if (pendingDraft) {
      writeContentDraftRecovery({ mode, ownerUserId, item: pendingDraft, tagInputValue });
      onSave(pendingDraft);
    }
  }

  function handleClose() {
    if (dirtyRef.current) {
      setConfirming(false);
      setDiscarding(true);
      return;
    }

    setConfirming(false);
    setPendingDraft(null);
    onClose();
  }

  function handleConfirmDiscard() {
    dirtyRef.current = false;
    setDiscarding(false);
    setConfirming(false);
    setPendingDraft(null);
    onClose();
  }

  function handleBodyBlocksChange(nextBlocks: ContentBlock[]) {
    markDirty();
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
          <Typography component="span" variant="h2" sx={{ display: "block", fontSize: "1.45rem" }}>
            {discarding ? "ละทิ้งฉบับร่างที่ยังไม่บันทึก?" : confirming ? confirmTitle : title}
          </Typography>
          {!confirming && !discarding && (
            <Typography
              variant="body2"
              sx={{
                color: "text.secondary"
              }}
            >
              แก้ไขเนื้อหา แนบสื่อ และตั้งค่าการเผยแพร่ในพื้นที่ทำงานเดียว
            </Typography>
          )}
        </DialogTitle>
        <DialogContent dividers>
          {discarding ? (
            <Stack spacing={1.5} sx={{ pt: 1 }}>
              <Alert severity="warning">
                การละทิ้งจะลบฉบับร่างกู้คืนของเนื้อหานี้ออกจากแท็บนี้ การแก้ไขที่ยังไม่บันทึกจะไม่สามารถกู้คืนได้
              </Alert>
            </Stack>
          ) : confirming && pendingDraft ? (
            <Stack spacing={1.5} sx={{ pt: 1 }}>
              {errorMessage && <Alert severity="error">{errorMessage}</Alert>}
              <Typography
                sx={{
                  color: "text.secondary"
                }}
              >
                ตรวจสอบรายการนี้ก่อนบันทึก
              </Typography>
              <Typography
                sx={{
                  fontWeight: 900
                }}
              >
                {pendingDraft.title}
              </Typography>
              <Typography
                sx={{
                  color: "text.secondary"
                }}
              >
                {contentTypeLabels[pendingDraft.type]} / {contentStatusLabels[pendingDraft.status]} /{" "}
                {pendingDraft.owner}
              </Typography>
              <Chip
                label={CONTENT_TEMPLATE_LABELS[pendingDraftTemplate]}
                color={isPendingDraftFacebookEmbed ? "primary" : "default"}
                variant="outlined"
                sx={{ alignSelf: "start" }}
              />
              {isPendingDraftFacebookEmbed && (
                <Stack spacing={1}>
                  <Alert severity="info">รายการนี้จะแสดงเป็นโพสต์ Facebook แบบฝังในหน้าเว็บไซต์สาธารณะ</Alert>
                  {pendingDraft.canonicalUrl ? (
                    <Typography
                      sx={{
                        color: "text.secondary"
                      }}
                    >
                      {pendingDraft.canonicalUrl}
                    </Typography>
                  ) : (
                    <Alert severity="warning">ยังไม่มี URL หลักสำหรับฝังโพสต์ Facebook</Alert>
                  )}
                </Stack>
              )}
              {!!pendingDraft.category && (
                <Typography
                  sx={{
                    color: "text.secondary"
                  }}
                >
                  หมวดหมู่: {pendingDraft.category}
                </Typography>
              )}
              {!!categoryToSlugList(pendingDraft.category).length && (
                <Typography
                  sx={{
                    color: "text.secondary"
                  }}
                >
                  slug หมวดหมู่: {categoryToSlugList(pendingDraft.category).join(", ")}
                </Typography>
              )}
              {!!normalizeTags(pendingDraft.tags).length && (
                <Typography
                  sx={{
                    color: "text.secondary"
                  }}
                >
                  แท็ก: {normalizeTags(pendingDraft.tags).join(", ")}
                </Typography>
              )}
              <Typography
                sx={{
                  color: "text.secondary"
                }}
              >
                แนบสื่อแล้ว {normalizeMediaIds(pendingDraft.mediaIds).length} รายการ
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
                {recovered && (
                  <Alert severity="info">
                    กู้คืนฉบับร่างจากก่อนเข้าสู่ระบบอีกครั้งแล้ว กรุณาตรวจสอบข้อมูลก่อนบันทึก
                  </Alert>
                )}
                <TextField
                  label="ชื่อเรื่อง"
                  value={draft.title}
                  onChange={(event) => handleTitleChange(event.target.value)}
                  required
                  fullWidth
                />
                <TextField
                  label="slug ลิงก์ถาวร"
                  value={draft.slug}
                  onChange={(event) => handleSlugChange(event.target.value)}
                  helperText="ใช้คำคั่นด้วยขีดกลาง เช่น student-life-updates หรือข้อความภาษาไทย"
                  required
                  fullWidth
                />
                {isDraftFacebookEmbed ? (
                  <Stack spacing={1}>
                    <Alert severity="info">รายการนี้จะแสดงเป็นโพสต์ Facebook แบบฝังในหน้าเว็บไซต์สาธารณะ</Alert>
                    {!draft.canonicalUrl?.trim() && (
                      <Alert severity="warning">ยังไม่มี URL หลักสำหรับฝังโพสต์ Facebook</Alert>
                    )}
                  </Stack>
                ) : (
                  <ContentBlockBuilder
                    blocks={bodyBlocks}
                    mediaAssets={availableMedia}
                    onChange={handleBodyBlocksChange}
                  />
                )}
                <TextField
                  label="สรุปย่อ"
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
                  ...staticSurfaceSx,
                  p: 2,
                  bgcolor: "background.default",
                  alignSelf: "start"
                }}
              >
                <Typography
                  sx={{
                    fontWeight: 900
                  }}
                >
                  การเผยแพร่
                </Typography>
                <FormControl fullWidth size="small">
                  <InputLabel id="content-type-label">ประเภท</InputLabel>
                  <Select
                    labelId="content-type-label"
                    label="ประเภท"
                    value={draft.type}
                    onChange={(event) => updateDraft("type", event.target.value as ContentType)}
                  >
                    {contentTypes.map((type) => (
                      <MenuItem key={type} value={type}>
                        {contentTypeLabels[type]}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl fullWidth size="small">
                  <InputLabel id="content-status-label">สถานะ</InputLabel>
                  <Select
                    labelId="content-status-label"
                    label="สถานะ"
                    value={draft.status}
                    onChange={(event) => updateDraft("status", event.target.value as ContentStatus)}
                  >
                    {contentStatuses.map((status) => (
                      <MenuItem key={status} value={status}>
                        {contentStatusLabels[status]}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField
                  label="ผู้รับผิดชอบ"
                  value={draft.owner}
                  onChange={(event) => updateDraft("owner", event.target.value)}
                  required
                  size="small"
                  fullWidth
                />
                <TextField
                  label="วันที่เผยแพร่"
                  type="datetime-local"
                  value={toLocalDateTimeInputValue(draft.publishAt)}
                  onChange={(event) =>
                    updateDraft(
                      "publishAt",
                      fromLocalDateTimeInputValue(event.target.value) || new Date().toISOString()
                    )
                  }
                  slotProps={{ inputLabel: { shrink: true }, htmlInput: { step: 60 } }}
                  size="small"
                  fullWidth
                />
                <Divider />
                <Typography
                  sx={{
                    fontWeight: 900
                  }}
                >
                  หมวดหมู่และแท็ก
                </Typography>
                {!!metadataPresetGroups.length && (
                  <Box
                    sx={{
                      ...staticSurfaceSx,
                      p: 1.25,
                      bgcolor: "background.default"
                    }}
                  >
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 900
                      }}
                    >
                      ชุดหมวดหมู่และแท็กสำหรับการแสดงผลหน้าแรก
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        color: "text.secondary"
                      }}
                    >
                      เลือกชุดข้อมูลเพื่อช่วยให้เนื้อหาถูกจัดเข้า section หน้าแรกและค้นหาเจอได้ถูกต้อง
                    </Typography>
                    {metadataPresetGroups.map((group) => (
                      <Box key={group.name} sx={{ mt: 1 }}>
                        <Typography
                          variant="caption"
                          sx={{
                            fontWeight: 900,
                            color: "text.secondary"
                          }}
                        >
                          {group.name}
                        </Typography>
                        <Stack
                          direction="row"
                          spacing={0.75}
                          useFlexGap
                          sx={{
                            flexWrap: "wrap",
                            mt: 0.75
                          }}
                        >
                          {group.presets.map((preset) => (
                            <Chip
                              key={preset.label}
                              label={preset.label}
                              variant="outlined"
                              color="primary"
                              onClick={() => applyMetadataPreset(preset)}
                            />
                          ))}
                        </Stack>
                      </Box>
                    ))}
                  </Box>
                )}
                <TextField
                  label="หมวดหมู่"
                  value={draft.category ?? ""}
                  onChange={(event) => updateDraft("category", event.target.value)}
                  placeholder="เช่น รับสมัคร, วิจัย, ชีวิตผู้เรียน"
                  helperText="ใช้จุลภาคเพื่อสร้างหลายหมวดหมู่ เช่น จัดซื้อจัดจ้าง, สมัครงาน, ผลงาน, เอกสาร"
                  size="small"
                  fullWidth
                />
                <TextField
                  label="slug หมวดหมู่"
                  value={categorySlugs.join(", ")}
                  helperText="สร้างอัตโนมัติจากชื่อหมวดหมู่"
                  size="small"
                  fullWidth
                  slotProps={{ input: { readOnly: true } }}
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

                    markDirty();
                    setTagInputValue(nextValue);
                  }}
                  renderValue={(value, getItemProps) =>
                    value.map((option, index) => (
                      <Chip {...getItemProps({ index })} key={`${option}-${index}`} label={option} size="small" />
                    ))
                  }
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="แท็ก"
                      placeholder="พิมพ์แท็กแล้วกด Enter หรือจุลภาค"
                      helperText="จุลภาค Enter หรือ Tab จะเพิ่มแท็ก เช่น procurement, job, achievement, document"
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
                  <InputLabel id="content-template-label">เทมเพลต</InputLabel>
                  <Select
                    labelId="content-template-label"
                    label="เทมเพลต"
                    value={draftTemplate}
                    onChange={(event) => updateDraft("template", event.target.value)}
                  >
                    {CONTENT_TEMPLATES.map((template) => (
                      <MenuItem key={template} value={template}>
                        {CONTENT_TEMPLATE_LABELS[template]}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField
                  label="เวลาอ่าน (นาที)"
                  type="number"
                  value={Math.max(1, Number(draft.readingMinutes) || 1)}
                  onChange={(event) => updateDraft("readingMinutes", Math.max(1, Number(event.target.value) || 1))}
                  size="small"
                  fullWidth
                  slotProps={{ htmlInput: { min: 1, step: 1 } }}
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={Boolean(draft.featured)}
                      onChange={(event) => updateDraft("featured", event.target.checked)}
                      size="small"
                    />
                  }
                  label="เรื่องแนะนำ"
                />
                <Divider />
                <Typography
                  sx={{
                    fontWeight: 900
                  }}
                >
                  SEO
                </Typography>
                <TextField
                  label="ชื่อ SEO"
                  value={draft.seoTitle ?? ""}
                  onChange={(event) => updateDraft("seoTitle", event.target.value)}
                  size="small"
                  fullWidth
                />
                <TextField
                  label="คำอธิบาย SEO"
                  value={draft.seoDescription ?? ""}
                  onChange={(event) => updateDraft("seoDescription", event.target.value)}
                  size="small"
                  minRows={2}
                  multiline
                  fullWidth
                />
                <TextField
                  label="URL หลัก"
                  value={draft.canonicalUrl ?? ""}
                  onChange={(event) => updateDraft("canonicalUrl", event.target.value)}
                  placeholder="https://example.edu/blog/post"
                  size="small"
                  fullWidth
                />
                <Divider />
                <Typography
                  sx={{
                    fontWeight: 900
                  }}
                >
                  สื่อแนะนำ
                </Typography>
                <Box
                  sx={{
                    ...staticSurfaceSx,
                    minHeight: 120,
                    borderStyle: "dashed",
                    display: "grid",
                    placeItems: "center",
                    overflow: "hidden",
                    bgcolor: "white"
                  }}
                >
                  {featuredMedia?.type === "image" && (featuredMedia.thumbnailUrl || featuredMedia.previewUrl) ? (
                    <Box
                      component="img"
                      src={featuredMedia.thumbnailUrl || featuredMedia.previewUrl}
                      alt={featuredMedia.name}
                      loading="lazy"
                      sx={{
                        width: "100%",
                        height: 220,
                        objectFit: "contain",
                        display: "block",
                        bgcolor: "background.paper"
                      }}
                    />
                  ) : featuredMedia ? (
                    <Stack
                      spacing={0.75}
                      sx={{
                        alignItems: "center",
                        p: 2,
                        textAlign: "center"
                      }}
                    >
                      {mediaIcon(featuredMedia.type)}
                      <Typography
                        sx={{
                          fontWeight: 800
                        }}
                      >
                        {featuredMedia.name}
                      </Typography>
                    </Stack>
                  ) : (
                    <Typography
                      variant="body2"
                      sx={{
                        color: "text.secondary"
                      }}
                    >
                      เลือกรูปภาพหรือวิดีโอด้านล่าง
                    </Typography>
                  )}
                </Box>
                <Stack
                  direction="row"
                  spacing={0.75}
                  useFlexGap
                  sx={{
                    flexWrap: "wrap"
                  }}
                >
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
                    <Typography
                      variant="body2"
                      sx={{
                        color: "text.secondary"
                      }}
                    >
                      ยังไม่ได้แนบสื่อ
                    </Typography>
                  )}
                </Stack>
                <Divider />
                <Typography
                  sx={{
                    fontWeight: 900
                  }}
                >
                  คลังสื่อ
                </Typography>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                  <TextField
                    label="ค้นหาในคลังสื่อ"
                    value={mediaSearch}
                    onChange={(event) => {
                      setMediaSearch(event.target.value);
                      setMediaPage(1);
                    }}
                    size="small"
                    fullWidth
                  />
                  <TextField
                    label="ประเภทสื่อ"
                    value={mediaFilter}
                    onChange={(event) => {
                      setMediaFilter(event.target.value as MediaLibraryFilter);
                      setMediaPage(1);
                    }}
                    size="small"
                    select
                    fullWidth
                  >
                    <MenuItem value="all">ทั้งหมด</MenuItem>
                    {mediaTypes.map((type) => (
                      <MenuItem key={type} value={type}>
                        {mediaTypeLabels[type]}
                      </MenuItem>
                    ))}
                  </TextField>
                </Stack>
                {mediaListQuery.isFetching && <LinearProgress aria-label="กำลังโหลดคลังสื่อ" />}
                {mediaListQuery.isError && (
                  <Alert severity="warning">
                    {mediaListQuery.error instanceof Error ? mediaListQuery.error.message : "ไม่สามารถโหลดคลังสื่อได้"}
                  </Alert>
                )}
                {selectedMediaQuery.isError && (
                  <Alert severity="warning">
                    ไม่สามารถโหลดข้อมูลสื่อที่แนบไว้บางรายการได้ กรุณาลองค้นหาในคลังสื่ออีกครั้ง
                  </Alert>
                )}
                {allSelectedLookupIds.length > ADMIN_MEDIA_BY_IDS_MAX && (
                  <Alert severity="warning">
                    แสดงข้อมูลสื่อที่แนบไว้ได้สูงสุด {ADMIN_MEDIA_BY_IDS_MAX} รายการต่อครั้ง
                  </Alert>
                )}
                <Stack
                  spacing={1}
                  aria-busy={mediaListQuery.isFetching}
                  sx={{
                    maxHeight: 260,
                    overflowY: "auto",
                    pr: 0.5,
                    opacity: mediaListQuery.isPlaceholderData ? 0.55 : 1,
                    transition: "opacity 120ms ease"
                  }}
                >
                  {libraryMedia.map((asset) => {
                    const checked = selectedMediaIds.includes(asset.id);
                    return (
                      <Box
                        key={asset.id}
                        sx={{
                          ...staticSurfaceSx,
                          display: "grid",
                          gridTemplateColumns: "auto 42px minmax(0, 1fr)",
                          gap: 1,
                          alignItems: "center",
                          p: 1,
                          bgcolor: checked ? "primary.light" : "white"
                        }}
                      >
                        <Checkbox
                          checked={checked}
                          onChange={() => toggleMedia(asset)}
                          size="small"
                          slotProps={{ input: { "aria-label": `${checked ? "นำออก" : "แนบ"} ${asset.name}` } }}
                        />
                        <Box
                          sx={{
                            width: 42,
                            height: 42,
                            borderRadius: designTokens.radius.small,
                            display: "grid",
                            placeItems: "center",
                            bgcolor: "background.default",
                            color: "primary.main",
                            overflow: "hidden"
                          }}
                        >
                          {asset.type === "image" && (asset.thumbnailUrl || asset.previewUrl) ? (
                            <Box
                              component="img"
                              src={asset.thumbnailUrl || asset.previewUrl}
                              alt={asset.name}
                              loading="lazy"
                              sx={{ width: "100%", height: "100%", objectFit: "cover" }}
                            />
                          ) : (
                            mediaIcon(asset.type)
                          )}
                        </Box>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography
                            noWrap
                            sx={{
                              fontWeight: 800
                            }}
                          >
                            {asset.name}
                          </Typography>
                          <Stack
                            direction="row"
                            spacing={0.75}
                            sx={{
                              alignItems: "center"
                            }}
                          >
                            <Typography
                              variant="caption"
                              sx={{
                                color: "text.secondary"
                              }}
                            >
                              {mediaTypeLabels[asset.type]}
                            </Typography>
                            {checked && (asset.type === "image" || asset.type === "video") && (
                              <Button size="small" onClick={() => updateDraft("featuredMediaId", asset.id)}>
                                ตั้งเป็นสื่อแนะนำ
                              </Button>
                            )}
                          </Stack>
                        </Box>
                      </Box>
                    );
                  })}
                  {!mediaListQuery.isLoading && !libraryMedia.length && (
                    <Typography
                      variant="body2"
                      sx={{
                        color: "text.secondary"
                      }}
                    >
                      ไม่พบสื่อที่ตรงกับการค้นหา
                    </Typography>
                  )}
                </Stack>
                {mediaListQuery.data && (
                  <AdminPagination
                    pagination={{
                      ...mediaListQuery.data.pagination,
                      page: mediaPage,
                      pageSize: mediaPageSize
                    }}
                    pageSizeOptions={ADMIN_MEDIA_PAGE_SIZE_OPTIONS}
                    onPageChange={setMediaPage}
                    onPageSizeChange={(nextPageSize) => {
                      setMediaPageSize(nextPageSize);
                      setMediaPage(1);
                    }}
                    disabled={uploading}
                    isFetching={mediaListQuery.isFetching}
                  />
                )}
                <Divider />
                <Typography
                  sx={{
                    fontWeight: 900
                  }}
                >
                  อัปโหลดด่วน
                </Typography>
                {uploadError && <Alert severity="error">{uploadError}</Alert>}
                <Button
                  component="label"
                  variant="outlined"
                  startIcon={<UploadFileOutlinedIcon />}
                  disabled={uploading}
                >
                  เลือกไฟล์
                  <input
                    hidden
                    type="file"
                    accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.csv"
                    onChange={handleFileChange}
                  />
                </Button>
                <Typography
                  variant="body2"
                  sx={{
                    color: "text.secondary"
                  }}
                >
                  รองรับไฟล์ขนาดไม่เกิน 100 MB
                </Typography>
                {uploadFile && (
                  <Typography
                    variant="body2"
                    sx={{
                      color: "text.secondary"
                    }}
                  >
                    {uploadFile.name} / {formatFileSize(uploadFile.size)}
                  </Typography>
                )}
                <TextField
                  label="ชื่อสื่อ"
                  value={uploadName}
                  onChange={(event) => setUploadName(event.target.value)}
                  size="small"
                  fullWidth
                />
                <TextField
                  label="ประเภท"
                  value={uploadType}
                  onChange={(event) => setUploadType(event.target.value as MediaType)}
                  size="small"
                  select
                  fullWidth
                >
                  {mediaTypes.map((type) => (
                    <MenuItem key={type} value={type}>
                      {mediaTypeLabels[type]}
                    </MenuItem>
                  ))}
                </TextField>
                <Button
                  type="button"
                  variant="contained"
                  disabled={uploading || !uploadFile || !onUploadMedia}
                  onClick={() => void handleUploadMedia()}
                >
                  {uploading ? "กำลังอัปโหลด" : "อัปโหลดและแนบ"}
                </Button>
              </Stack>
            </Box>
          )}
        </DialogContent>
        <ResponsiveDialogActions>
          {discarding ? (
            <>
              <Button type="button" onClick={() => setDiscarding(false)}>
                กลับไปแก้ไข
              </Button>
              <Button type="button" color="error" variant="contained" onClick={handleConfirmDiscard}>
                ละทิ้งฉบับร่าง
              </Button>
            </>
          ) : confirming ? (
            <>
              <Button type="button" onClick={() => setConfirming(false)} disabled={saving}>
                กลับ
              </Button>
              <Button
                type="button"
                variant="contained"
                startIcon={<SaveOutlinedIcon />}
                disabled={saving}
                onClick={handleConfirmSave}
              >
                {saving ? "กำลังบันทึก" : confirmButton}
              </Button>
            </>
          ) : (
            <>
              <Button type="button" onClick={handleClose} disabled={saving || uploading}>
                ยกเลิก
              </Button>
              <Button type="submit" variant="contained" startIcon={<SaveOutlinedIcon />} disabled={saving || uploading}>
                ดำเนินการต่อ
              </Button>
            </>
          )}
        </ResponsiveDialogActions>
      </form>
    </Dialog>
  );
}
