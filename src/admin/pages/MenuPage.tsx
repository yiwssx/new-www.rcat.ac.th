import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import Grid from "@mui/material/Grid2";
import AddIcon from "@mui/icons-material/Add";
import ArrowDownwardRoundedIcon from "@mui/icons-material/ArrowDownwardRounded";
import ArrowUpwardRoundedIcon from "@mui/icons-material/ArrowUpwardRounded";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import PageHeader from "../components/PageHeader";
import AdminPagination from "../components/AdminPagination";
import { useAuth } from "../../context/authSessionContext";
import {
  ADMIN_PAGE_SIZE_OPTIONS,
  adminListQueryKeys,
  adminMenuOrderQueryOptions,
  deleteAdminMenuItem,
  getAdminMenuList,
  getAdminPageAfterDelete,
  invalidateAdminListQueries,
  saveAdminMenuItem,
  saveAdminMenuOrder,
  useAdminListUrlState,
  useAdminMenuListQuery,
  useDebouncedValue,
  type AdminMenuListItem,
  type AdminMenuOrderItem
} from "../../features/admin-pagination";
import { appSwal, showBlockingLoading, showErrorResult, showSuccessResult } from "../../utils/swal";
import { ADMIN_READ_ONLY_NOTICE, canManageMenu } from "../utils/rbac";
import { invalidatePublicCmsData } from "../../services/publicCmsInvalidation";

interface MenuFormState {
  label: string;
  href: string;
  enabled: boolean;
  order: number;
  parentId: string;
}

const emptyForm: MenuFormState = {
  label: "",
  href: "/",
  enabled: true,
  order: 0,
  parentId: ""
};

const menuListUrlOptions = {
  defaultPageSize: 25,
  pageSizeOptions: ADMIN_PAGE_SIZE_OPTIONS,
  defaultSortBy: "order",
  defaultSortDirection: "asc",
  filterDefaults: { enabled: "all" }
} as const;

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

function orderSnapshot(items: readonly AdminMenuOrderItem[]) {
  return items
    .map(({ id, parentId, order, enabled, revision }) => ({ id, parentId, order, enabled, revision }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

function orderIsDirty(current: readonly AdminMenuOrderItem[], source: readonly AdminMenuOrderItem[]) {
  return JSON.stringify(orderSnapshot(current)) !== JSON.stringify(orderSnapshot(source));
}

function moveMenuSibling(items: AdminMenuOrderItem[], id: string, direction: -1 | 1) {
  const current = items.find((item) => item.id === id);

  if (!current) {
    return items;
  }

  const siblings = items
    .filter((item) => item.parentId === current.parentId)
    .sort((left, right) => left.order - right.order || left.label.localeCompare(right.label));
  const index = siblings.findIndex((item) => item.id === id);
  const nextIndex = index + direction;

  if (index < 0 || nextIndex < 0 || nextIndex >= siblings.length) {
    return items;
  }

  const nextSiblings = [...siblings];
  const [moved] = nextSiblings.splice(index, 1);

  if (!moved) {
    return items;
  }

  nextSiblings.splice(nextIndex, 0, moved);
  const nextOrderById = new Map(nextSiblings.map((item, itemIndex) => [item.id, itemIndex + 1]));
  return items.map((item) =>
    item.parentId === current.parentId ? { ...item, order: nextOrderById.get(item.id) ?? item.order } : item
  );
}

function flattenMenuOrder(items: readonly AdminMenuOrderItem[]) {
  const byParent = new Map<string | null, AdminMenuOrderItem[]>();

  items.forEach((item) => {
    const siblings = byParent.get(item.parentId) ?? [];
    siblings.push(item);
    byParent.set(item.parentId, siblings);
  });
  byParent.forEach((siblings) =>
    siblings.sort((left, right) => left.order - right.order || left.label.localeCompare(right.label))
  );

  const rows: Array<{ item: AdminMenuOrderItem; depth: number }> = [];
  const visited = new Set<string>();
  const visit = (parentId: string | null, depth: number) => {
    (byParent.get(parentId) ?? []).forEach((item) => {
      if (visited.has(item.id)) {
        return;
      }

      visited.add(item.id);
      rows.push({ item, depth });
      visit(item.id, depth + 1);
    });
  };

  visit(null, 0);
  items.forEach((item) => {
    if (!visited.has(item.id)) {
      rows.push({ item, depth: 0 });
    }
  });
  return rows;
}

export default function MenuPage() {
  const queryClient = useQueryClient();
  const { capabilities } = useAuth();
  const canManage = canManageMenu(capabilities);
  const {
    page,
    pageSize,
    q,
    filters,
    sortBy,
    sortDirection,
    setState: setListState,
    setPage,
    setPageSize,
    setSearch,
    setFilter
  } = useAdminListUrlState<"enabled">(menuListUrlOptions);
  const debouncedSearch = useDebouncedValue(q, 300);
  const listQuery = useAdminMenuListQuery({
    page,
    pageSize,
    q: debouncedSearch,
    enabled: filters.enabled === "all" ? "all" : filters.enabled === "true",
    sortBy,
    sortDirection
  });
  useEffect(() => {
    const responsePage = listQuery.data?.pagination.page;

    if (!listQuery.isPlaceholderData && responsePage && responsePage !== page) {
      setListState({ page: responsePage }, { replace: true });
    }
  }, [listQuery.data?.pagination.page, listQuery.isPlaceholderData, page, setListState]);
  const [orderingMode, setOrderingMode] = useState(false);
  const listTransitioning = !orderingMode && (listQuery.isPlaceholderData || debouncedSearch !== q);
  const orderQuery = useQuery({ ...adminMenuOrderQueryOptions(), enabled: orderingMode });
  const [orderDraft, setOrderDraft] = useState<AdminMenuOrderItem[] | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AdminMenuListItem | null>(null);
  const [form, setForm] = useState<MenuFormState>(emptyForm);

  const saveMutation = useMutation({ mutationFn: saveAdminMenuItem });
  const deleteMutation = useMutation({ mutationFn: deleteAdminMenuItem });
  const saveOrderMutation = useMutation({ mutationFn: saveAdminMenuOrder });
  const operationPending =
    saveMutation.isPending || deleteMutation.isPending || saveOrderMutation.isPending || listTransitioning;
  const activeOrderItems = useMemo(() => orderDraft ?? orderQuery.data ?? [], [orderDraft, orderQuery.data]);
  const orderRows = useMemo(() => flattenMenuOrder(activeOrderItems), [activeOrderItems]);
  const orderDirty = orderDraft !== null && orderIsDirty(orderDraft, orderQuery.data ?? []);

  async function invalidateMenuData() {
    await Promise.all([
      invalidateAdminListQueries(queryClient, "menu"),
      queryClient.invalidateQueries({ queryKey: adminListQueryKeys.order("menu") }),
      invalidatePublicCmsData(queryClient)
    ]);
  }

  async function openCreate(parentId = "") {
    if (!canManage || operationPending) {
      return;
    }

    try {
      const response = await getAdminMenuList({
        page: 1,
        pageSize: 1,
        ...(parentId ? { parentId } : { parentRoot: true }),
        sortBy: "order",
        sortDirection: "desc"
      });
      const nextOrder = (response.items[0]?.order ?? 0) + 1;
      setEditingItem(null);
      setForm({ ...emptyForm, parentId, order: nextOrder });
      setDialogOpen(true);
    } catch (error) {
      await showErrorResult("ไม่สามารถเตรียมเมนูใหม่ได้", error, "กรุณาลองอีกครั้ง");
    }
  }

  function openEdit(item: AdminMenuListItem) {
    if (!canManage || operationPending) {
      return;
    }

    setEditingItem(item);
    setForm({
      label: item.label,
      href: item.href,
      enabled: item.enabled,
      order: item.order,
      parentId: item.parentId ?? ""
    });
    setDialogOpen(true);
  }

  function closeDialog() {
    if (saveMutation.isPending) {
      return;
    }

    setDialogOpen(false);
    setEditingItem(null);
    setForm(emptyForm);
  }

  async function handleSaveItem() {
    if (!canManage || operationPending) {
      return;
    }

    const label = form.label.trim();
    const href = normalizeMenuHref(form.href);

    if (!label || !href) {
      await appSwal.fire({
        icon: "error",
        title: "ข้อมูลเมนูไม่ครบ",
        text: "ต้องระบุชื่อเมนูและเส้นทาง",
        confirmButtonText: "ตกลง"
      });
      return;
    }

    showBlockingLoading("กำลังบันทึกเมนู");

    try {
      await saveMutation.mutateAsync({
        id: editingItem?.id,
        revision: editingItem?.revision,
        label,
        href,
        enabled: form.enabled,
        parentId: form.parentId.trim() || null,
        order: editingItem?.order ?? form.order
      });
      await invalidateMenuData();
      if (!editingItem) {
        setPage(1);
      }
      await appSwal.close();
      closeDialog();
      await showSuccessResult("บันทึกเมนูสำเร็จ");
    } catch (error) {
      await appSwal.close();
      await showErrorResult("ไม่สามารถบันทึกเมนูได้", error, "กรุณาลองอีกครั้ง");
    }
  }

  async function handleDelete(item: AdminMenuListItem) {
    if (!canManage || operationPending) {
      return;
    }

    const confirmation = await appSwal.fire({
      title: "ลบรายการเมนู?",
      text: item.label,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "ลบ",
      cancelButtonText: "ยกเลิก"
    });

    if (!confirmation.isConfirmed) {
      return;
    }

    showBlockingLoading("กำลังลบเมนู");

    try {
      const currentPage = Number(new URLSearchParams(window.location.search).get("page")) || page;
      const nextPage =
        currentPage > 1 && (listQuery.data?.items.length ?? 0) <= 1
          ? currentPage - 1
          : listQuery.data?.pagination
            ? getAdminPageAfterDelete(listQuery.data.pagination)
            : currentPage;
      await deleteMutation.mutateAsync({ id: item.id, revision: item.revision });

      if (nextPage !== currentPage) {
        setPage(nextPage);
      }
      await invalidateMenuData();
      await appSwal.close();
      await showSuccessResult("ลบเมนูสำเร็จ");
    } catch (error) {
      await appSwal.close();
      await showErrorResult("ไม่สามารถลบเมนูได้", error, "กรุณาลองอีกครั้ง");
    }
  }

  async function handleSaveOrder() {
    if (!canManage || operationPending || !orderDirty) {
      return;
    }

    showBlockingLoading("กำลังบันทึกลำดับเมนู");

    try {
      const saved = await saveOrderMutation.mutateAsync(activeOrderItems);
      setOrderDraft(saved);
      await invalidateMenuData();
      await appSwal.close();
      await showSuccessResult("บันทึกลำดับเมนูสำเร็จ");
    } catch (error) {
      await appSwal.close();
      await showErrorResult("ไม่สามารถบันทึกลำดับเมนูได้", error, "กรุณาลองอีกครั้ง");
    }
  }

  function closeOrderingMode() {
    if (operationPending) {
      return;
    }

    setOrderDraft(null);
    setOrderingMode(false);
  }

  return (
    <Box>
      <PageHeader
        title="เมนู"
        description="จัดการเมนูเว็บไซต์สาธารณะ เมนูย่อย เส้นทาง และการแสดงผล"
        action={
          canManage ? (
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <Button
                variant="outlined"
                disabled={operationPending}
                onClick={() => {
                  if (orderingMode) {
                    closeOrderingMode();
                  } else {
                    setOrderDraft(null);
                    setOrderingMode(true);
                  }
                }}
              >
                {orderingMode ? "กลับรายการเมนู" : "จัดลำดับ"}
              </Button>
              {!orderingMode && (
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  disabled={operationPending}
                  onClick={() => void openCreate()}
                >
                  เพิ่มเมนูหลัก
                </Button>
              )}
            </Stack>
          ) : undefined
        }
      />

      {!canManage && (
        <Alert severity="info" sx={{ mb: 3 }}>
          {ADMIN_READ_ONLY_NOTICE}
        </Alert>
      )}

      {(orderingMode ? orderQuery.isFetching : listQuery.isFetching || listTransitioning) && (
        <LinearProgress sx={{ mb: 2 }} />
      )}
      {(orderingMode ? orderQuery.isError : listQuery.isError) && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {(orderingMode ? orderQuery.error : listQuery.error) instanceof Error
            ? (orderingMode ? orderQuery.error : listQuery.error)?.message
            : "ไม่สามารถโหลดรายการเมนูได้"}
        </Alert>
      )}

      {orderingMode ? (
        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Box>
                <Typography variant="h3">จัดลำดับเมนูทั้งหมด</Typography>
                <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                  โหลดเฉพาะข้อมูลลำดับขนาดเล็กเมื่อเปิดโหมดนี้ การเลื่อนทำงานภายในกลุ่มเมนูระดับเดียวกัน
                </Typography>
              </Box>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <Button
                  variant="contained"
                  startIcon={<SaveOutlinedIcon />}
                  disabled={!orderDirty || operationPending}
                  onClick={() => void handleSaveOrder()}
                >
                  {saveOrderMutation.isPending ? "กำลังบันทึก" : "บันทึกลำดับ"}
                </Button>
                <Button
                  variant="outlined"
                  disabled={!orderDirty || operationPending}
                  onClick={() => setOrderDraft(null)}
                >
                  คืนค่าลำดับ
                </Button>
                <Button color="inherit" disabled={operationPending} onClick={closeOrderingMode}>
                  ยกเลิกและกลับ
                </Button>
              </Stack>
              <Stack spacing={1}>
                {orderRows.map(({ item, depth }) => {
                  const siblings = activeOrderItems
                    .filter((candidate) => candidate.parentId === item.parentId)
                    .sort((left, right) => left.order - right.order);
                  const siblingIndex = siblings.findIndex((candidate) => candidate.id === item.id);

                  return (
                    <Box
                      key={item.id}
                      sx={{
                        ml: Math.min(depth, 4) * 2,
                        p: 1.5,
                        borderRadius: 2,
                        border: "1px solid rgba(31, 90, 44, 0.12)"
                      }}
                    >
                      <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                        <Box sx={{ minWidth: 0 }}>
                          <Typography fontWeight={900}>{item.label}</Typography>
                          <Typography color="text.secondary" variant="caption">
                            ลำดับ {item.order} {item.parentId ? `/ เมนูแม่ ${item.parentId}` : "/ เมนูหลัก"}
                          </Typography>
                        </Box>
                        <Stack direction="row" spacing={0.5}>
                          <Button
                            size="small"
                            startIcon={<ArrowUpwardRoundedIcon />}
                            disabled={siblingIndex <= 0 || operationPending}
                            onClick={() =>
                              setOrderDraft((current) => moveMenuSibling(current ?? orderQuery.data ?? [], item.id, -1))
                            }
                          >
                            ขึ้น
                          </Button>
                          <Button
                            size="small"
                            startIcon={<ArrowDownwardRoundedIcon />}
                            disabled={siblingIndex < 0 || siblingIndex >= siblings.length - 1 || operationPending}
                            onClick={() =>
                              setOrderDraft((current) => moveMenuSibling(current ?? orderQuery.data ?? [], item.id, 1))
                            }
                          >
                            ลง
                          </Button>
                        </Stack>
                      </Stack>
                    </Box>
                  );
                })}
                {!orderQuery.isLoading && !orderRows.length && (
                  <Typography color="text.secondary">ยังไม่มีรายการเมนู</Typography>
                )}
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent>
            <Grid container spacing={1.5} sx={{ mb: 2 }}>
              <Grid size={{ xs: 12, md: 8 }}>
                <TextField
                  label="ค้นหาเมนู"
                  value={q}
                  onChange={(event) => setSearch(event.target.value)}
                  size="small"
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <FormControl fullWidth size="small">
                  <InputLabel id="menu-enabled-filter-label">การแสดงผล</InputLabel>
                  <Select
                    labelId="menu-enabled-filter-label"
                    label="การแสดงผล"
                    value={filters.enabled}
                    onChange={(event) => setFilter("enabled", event.target.value)}
                  >
                    <MenuItem value="all">ทั้งหมด</MenuItem>
                    <MenuItem value="true">แสดง</MenuItem>
                    <MenuItem value="false">ซ่อน</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            <Stack
              spacing={1.25}
              aria-busy={listQuery.isFetching}
              sx={{ opacity: listTransitioning ? 0.55 : 1, transition: "opacity 120ms ease" }}
            >
              {(listQuery.data?.items ?? []).map((item) => (
                <Box key={item.id} sx={{ p: 2, borderRadius: 2, border: "1px solid rgba(31, 90, 44, 0.12)" }}>
                  <Stack
                    direction={{ xs: "column", md: "row" }}
                    spacing={1.5}
                    alignItems={{ xs: "flex-start", md: "center" }}
                    justifyContent="space-between"
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                        <Typography fontWeight={900}>{item.label}</Typography>
                        <Chip
                          size="small"
                          label={item.enabled ? "แสดง" : "ซ่อน"}
                          color={item.enabled ? "success" : "default"}
                        />
                        <Chip size="small" variant="outlined" label={`ลำดับ ${item.order}`} />
                      </Stack>
                      <Typography color="text.secondary" variant="body2" sx={{ mt: 0.5, overflowWrap: "anywhere" }}>
                        {item.href}
                      </Typography>
                      {item.parentId && (
                        <Typography color="text.secondary" variant="caption">
                          เมนูแม่: {item.parentId}
                        </Typography>
                      )}
                    </Box>
                    {canManage && (
                      <Stack direction="row" spacing={1}>
                        <Button
                          size="small"
                          startIcon={<AddIcon />}
                          disabled={operationPending}
                          onClick={() => void openCreate(item.id)}
                        >
                          เมนูย่อย
                        </Button>
                        <Button
                          size="small"
                          startIcon={<EditOutlinedIcon />}
                          disabled={operationPending}
                          onClick={() => openEdit(item)}
                        >
                          แก้ไข
                        </Button>
                        <Button
                          size="small"
                          color="error"
                          startIcon={<DeleteOutlineIcon />}
                          disabled={operationPending}
                          onClick={() => void handleDelete(item)}
                        >
                          ลบ
                        </Button>
                      </Stack>
                    )}
                  </Stack>
                </Box>
              ))}
              {!listQuery.isLoading && !listQuery.data?.items.length && (
                <Typography color="text.secondary">ไม่พบรายการเมนู</Typography>
              )}
            </Stack>

            {listQuery.data?.pagination && (
              <AdminPagination
                pagination={listQuery.data.pagination}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
                pageSizeOptions={ADMIN_PAGE_SIZE_OPTIONS}
                disabled={operationPending}
                isFetching={listQuery.isFetching}
              />
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onClose={closeDialog} fullWidth maxWidth="sm">
        <DialogTitle>
          {editingItem ? "แก้ไขรายการเมนู" : form.parentId ? "เพิ่มเมนูย่อย" : "เพิ่มรายการเมนู"}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="ชื่อเมนู"
              value={form.label}
              onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))}
              required
              fullWidth
            />
            <TextField
              label="เส้นทางหรือ URL"
              value={form.href}
              onChange={(event) => setForm((current) => ({ ...current, href: event.target.value }))}
              helperText="ใช้ /news, /announcements, /blog, slug เนื้อหา หรือ URL ภายนอก"
              required
              fullWidth
            />
            <TextField
              label="Menu ID แม่ (ไม่บังคับ)"
              value={form.parentId}
              onChange={(event) => setForm((current) => ({ ...current, parentId: event.target.value }))}
              helperText="เว้นว่างสำหรับเมนูหลัก"
              fullWidth
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
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button color="inherit" onClick={closeDialog} disabled={saveMutation.isPending}>
            ยกเลิก
          </Button>
          <Button
            variant="contained"
            disabled={!canManage || saveMutation.isPending}
            onClick={() => void handleSaveItem()}
          >
            {saveMutation.isPending ? "กำลังบันทึก" : "บันทึกรายการ"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
