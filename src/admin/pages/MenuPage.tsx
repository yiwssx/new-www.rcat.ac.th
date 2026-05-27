import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  LinearProgress,
  Stack,
  TextField,
  Tooltip,
  Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ArrowDownwardRoundedIcon from "@mui/icons-material/ArrowDownwardRounded";
import ArrowUpwardRoundedIcon from "@mui/icons-material/ArrowUpwardRounded";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import SubdirectoryArrowRightRoundedIcon from "@mui/icons-material/SubdirectoryArrowRightRounded";
import PageHeader from "../components/PageHeader";
import { getPublicMenuItems, savePublicMenuItems } from "../../features/cms-navigation";
import { PublicMenuItem } from "../../types";
import { appSwal } from "../../utils/swal";

interface MenuFormState {
  label: string;
  href: string;
  enabled: boolean;
}

const emptyForm: MenuFormState = {
  label: "",
  href: "/",
  enabled: true
};

const knownInternalRoutes = new Set([
  "",
  "news",
  "announcements",
  "departments",
  "contact",
  "blog",
  "content",
  "login",
  "admin"
]);

function cloneMenu(items: PublicMenuItem[]) {
  return JSON.parse(JSON.stringify(items)) as PublicMenuItem[];
}

function toFormState(item: PublicMenuItem): MenuFormState {
  return {
    label: item.label,
    href: item.href,
    enabled: item.enabled
  };
}

function updateMenuItem(
  items: PublicMenuItem[],
  id: string,
  updater: (item: PublicMenuItem) => PublicMenuItem
): PublicMenuItem[] {
  return items.map((item) => {
    if (item.id === id) {
      return updater(item);
    }

    return {
      ...item,
      children: item.children ? updateMenuItem(item.children, id, updater) : undefined
    };
  });
}

function removeMenuItem(items: PublicMenuItem[], id: string): PublicMenuItem[] {
  return items
    .filter((item) => item.id !== id)
    .map((item) => ({
      ...item,
      children: item.children ? removeMenuItem(item.children, id) : undefined
    }));
}

function moveMenuItem(items: PublicMenuItem[], id: string, direction: -1 | 1): PublicMenuItem[] {
  const index = items.findIndex((item) => item.id === id);

  if (index >= 0) {
    const nextIndex = index + direction;

    if (nextIndex < 0 || nextIndex >= items.length) {
      return items;
    }

    const nextItems = [...items];
    const [item] = nextItems.splice(index, 1);
    nextItems.splice(nextIndex, 0, item);
    return nextItems;
  }

  return items.map((item) => ({
    ...item,
    children: item.children ? moveMenuItem(item.children, id, direction) : undefined
  }));
}

function findMenuItem(items: PublicMenuItem[], id?: string): PublicMenuItem | undefined {
  if (!id) {
    return undefined;
  }

  for (const item of items) {
    if (item.id === id) {
      return item;
    }

    const childItem = findMenuItem(item.children ?? [], id);

    if (childItem) {
      return childItem;
    }
  }

  return undefined;
}

function slugifySegment(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}-]+/gu, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isExternalHref(value: string) {
  return /^(https?:\/\/|mailto:|tel:)/i.test(value);
}

function normalizeMenuHref(value: string) {
  const raw = value.trim();

  if (!raw) {
    return "/";
  }

  if (isExternalHref(raw) || raw.startsWith("#")) {
    return raw;
  }

  const normalized = raw.replace(/^\/+/, "");

  if (!normalized) {
    return "/";
  }

  const segments = normalized.split("/").filter(Boolean);
  const firstSegment = segments[0]?.toLowerCase() ?? "";

  if (knownInternalRoutes.has(firstSegment) || normalized.startsWith("content/")) {
    return `/${normalized}`;
  }

  const permalink = slugifySegment(segments[segments.length - 1] || normalized);
  return permalink ? `/content/${permalink}` : "/";
}

function createMenuItem(form: MenuFormState): PublicMenuItem {
  const label = form.label.trim();

  return {
    id: `menu-${crypto.randomUUID()}`,
    label,
    href: normalizeMenuHref(form.href),
    enabled: form.enabled
  };
}

interface MenuTreeProps {
  items: PublicMenuItem[];
  depth?: number;
  onAddChild: (parentId?: string) => void;
  onEdit: (id: string) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, direction: -1 | 1) => void;
}

function MenuTree({ items, depth = 0, onAddChild, onEdit, onRemove, onMove }: MenuTreeProps) {
  return (
    <Stack spacing={1.2}>
      {items.map((item) => (
        <Box key={item.id}>
          <Box
            sx={{
              p: 1.5,
              pl: 1.5 + depth * 2,
              borderRadius: 2,
              border: "1px solid rgba(31, 90, 44, 0.12)",
              bgcolor: item.enabled ? "background.paper" : "background.default"
            }}
          >
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={1.5}
              justifyContent="space-between"
              alignItems={{ xs: "stretch", md: "center" }}
            >
              <Stack direction="row" spacing={1.2} alignItems="flex-start" sx={{ minWidth: 0 }}>
                {depth > 0 && <SubdirectoryArrowRightRoundedIcon color="disabled" sx={{ mt: 0.2 }} />}
                <Box sx={{ minWidth: 0 }}>
                  <Typography fontWeight={900}>{item.label}</Typography>
                  <Typography color="text.secondary" variant="body2">
                    {item.href}
                  </Typography>
                  {!item.enabled && (
                    <Typography color="error" variant="caption">
                      ซ่อนจากเมนูสาธารณะ
                    </Typography>
                  )}
                </Box>
              </Stack>
              <Stack direction="row" spacing={0.5} justifyContent={{ xs: "flex-start", md: "flex-end" }}>
                <Tooltip title="เลื่อนขึ้น">
                  <IconButton aria-label="เลื่อนขึ้น" size="small" onClick={() => onMove(item.id, -1)}>
                    <ArrowUpwardRoundedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="เลื่อนลง">
                  <IconButton aria-label="เลื่อนลง" size="small" onClick={() => onMove(item.id, 1)}>
                    <ArrowDownwardRoundedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="เพิ่มเมนูย่อย">
                  <IconButton aria-label="เพิ่มเมนูย่อย" size="small" onClick={() => onAddChild(item.id)}>
                    <AddIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="แก้ไข">
                  <IconButton aria-label="แก้ไข" size="small" onClick={() => onEdit(item.id)}>
                    <EditOutlinedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="ลบ">
                  <IconButton aria-label="ลบ" size="small" color="error" onClick={() => onRemove(item.id)}>
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Stack>
          </Box>
          {item.children?.length ? (
            <Box sx={{ mt: 1.2 }}>
              <MenuTree
                items={item.children}
                depth={depth + 1}
                onAddChild={onAddChild}
                onEdit={onEdit}
                onRemove={onRemove}
                onMove={onMove}
              />
            </Box>
          ) : null}
        </Box>
      ))}
    </Stack>
  );
}

export default function MenuPage() {
  const queryClient = useQueryClient();
  const {
    data = [],
    error,
    isError,
    isLoading
  } = useQuery({
    queryKey: ["public-menu"],
    queryFn: getPublicMenuItems
  });
  const [items, setItems] = useState<PublicMenuItem[]>(cloneMenu(data));
  const [itemsSource, setItemsSource] = useState(data);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>();
  const [parentId, setParentId] = useState<string | undefined>();
  const [form, setForm] = useState<MenuFormState>(emptyForm);

  const editingItem = findMenuItem(items, editingId);

  if (itemsSource !== data) {
    setItemsSource(data);
    setItems(cloneMenu(data));
  }

  function handleAdd(parent?: string) {
    setParentId(parent);
    setEditingId(undefined);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function handleEdit(id: string) {
    const item = findMenuItem(items, id);

    if (!item) {
      return;
    }

    setEditingId(id);
    setParentId(undefined);
    setForm(toFormState(item));
    setDialogOpen(true);
  }

  function handleClose() {
    setDialogOpen(false);
    setEditingId(undefined);
    setParentId(undefined);
    setForm(emptyForm);
  }

  async function handleSaveItem() {
    const normalizedHref = normalizeMenuHref(form.href);

    if (!form.label.trim() || !normalizedHref) {
      await appSwal.fire({
        icon: "error",
        title: "ข้อมูลเมนูไม่ครบ",
        text: "ต้องระบุชื่อเมนูและเส้นทาง",
        confirmButtonText: "ตกลง"
      });
      return;
    }

    if (editingItem) {
      setItems((current) =>
        updateMenuItem(current, editingItem.id, (item) => ({
          ...item,
          label: form.label.trim(),
          href: normalizedHref,
          enabled: form.enabled
        }))
      );
    } else if (parentId) {
      const newItem = createMenuItem(form);
      setItems((current) =>
        updateMenuItem(current, parentId, (item) => ({
          ...item,
          children: [...(item.children ?? []), newItem]
        }))
      );
    } else {
      setItems((current) => [...current, createMenuItem(form)]);
    }

    handleClose();
  }

  async function handleRemove(id: string) {
    const item = findMenuItem(items, id);
    const result = await appSwal.fire({
      title: "ลบรายการเมนู?",
      text: item?.label || id,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "ลบ",
      cancelButtonText: "ยกเลิก"
    });

    if (!result.isConfirmed) {
      return;
    }

    setItems((current) => removeMenuItem(current, id));
  }

  async function handlePublishMenu() {
    try {
      const savedItems = await savePublicMenuItems(items);
      setItems(cloneMenu(savedItems));
      await queryClient.invalidateQueries({ queryKey: ["public-menu"] });
      await appSwal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "บันทึกเมนูแล้ว",
        showConfirmButton: false,
        timer: 1400,
        timerProgressBar: true
      });
    } catch (error) {
      await appSwal.fire({
        icon: "error",
        title: "ไม่สามารถบันทึกเมนูได้",
        text: error instanceof Error ? error.message : "กรุณาลองอีกครั้ง",
        confirmButtonText: "ตกลง"
      });
    }
  }

  function handleResetDraft() {
    setItems([]);
  }

  return (
    <Box>
      <PageHeader
        title="เมนู"
        description="จัดการเมนูเว็บไซต์สาธารณะ เมนูย่อย เส้นทาง และการแสดงผล"
        action={
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <Button variant="outlined" color="inherit" onClick={handleResetDraft}>
              ล้างแบบร่าง
            </Button>
            <Button variant="contained" startIcon={<SaveOutlinedIcon />} onClick={() => void handlePublishMenu()}>
              บันทึกเมนู
            </Button>
          </Stack>
        }
      />
      {isError && (
        <Typography color="error" sx={{ mb: 2 }}>
          {error instanceof Error ? error.message : "ไม่สามารถโหลดรายการเมนูได้ในขณะนี้"}
        </Typography>
      )}
      {isLoading && <LinearProgress sx={{ mb: 3 }} />}
      <Card>
        <CardContent>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={2}
            justifyContent="space-between"
            alignItems={{ xs: "stretch", md: "center" }}
            sx={{ mb: 2 }}
          >
            <Box>
              <Typography variant="h3">เมนูหลักสาธารณะ</Typography>
              <Typography color="text.secondary">เพิ่มเมนูระดับบน เพิ่มเมนูย่อย ซ่อนรายการ และจัดลำดับเมนู</Typography>
            </Box>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleAdd()}>
              เพิ่มเมนูหลัก
            </Button>
          </Stack>
          <MenuTree
            items={items}
            onAddChild={handleAdd}
            onEdit={handleEdit}
            onRemove={(id) => void handleRemove(id)}
            onMove={(id, direction) => setItems((current) => moveMenuItem(current, id, direction))}
          />
        </CardContent>
      </Card>
      <Dialog open={dialogOpen} onClose={handleClose} fullWidth maxWidth="sm">
        <DialogTitle>{editingItem ? "แก้ไขรายการเมนู" : parentId ? "เพิ่มเมนูย่อย" : "เพิ่มรายการเมนู"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.2} sx={{ pt: 1 }}>
            <TextField
              label="ชื่อเมนู"
              value={form.label}
              onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))}
              fullWidth
              required
            />
            <TextField
              label="เส้นทางหรือ URL"
              value={form.href}
              onChange={(event) => setForm((current) => ({ ...current, href: event.target.value }))}
              helperText="ใช้ /news, /announcements, /blog หรือ slug เนื้อหา เช่น my-post รองรับ URL ภายนอกด้วย"
              fullWidth
              required
            />
            <Stack direction="row" alignItems="center">
              <Checkbox
                checked={form.enabled}
                onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))}
              />
              <Typography>แสดงในเมนูสาธารณะ</Typography>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button color="inherit" onClick={handleClose}>
            ยกเลิก
          </Button>
          <Button variant="contained" onClick={() => void handleSaveItem()}>
            บันทึกรายการ
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
