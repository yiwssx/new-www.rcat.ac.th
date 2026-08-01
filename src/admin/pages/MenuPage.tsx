import { useMemo, useState } from "react";
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
  DialogContent,
  DialogTitle,
  FormControl,
  FormHelperText,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import Grid from "@mui/material/Grid";
import AddIcon from "@mui/icons-material/Add";
import ArrowDownwardRoundedIcon from "@mui/icons-material/ArrowDownwardRounded";
import ArrowUpwardRoundedIcon from "@mui/icons-material/ArrowUpwardRounded";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import AccountTreeRoundedIcon from "@mui/icons-material/AccountTreeRounded";
import ResponsiveDialogActions from "../../design-system/components/ResponsiveDialogActions";
import { staticSurfaceSx } from "../../design-system/componentStyles";
import PageHeader from "../components/PageHeader";
import { useAuth } from "../../context/authSessionContext";
import {
  adminListQueryKeys,
  adminMenuOrderQueryOptions,
  deleteAdminMenuItem,
  saveAdminMenuItem,
  saveAdminMenuOrder,
  type AdminMenuOrderItem
} from "../../features/admin-pagination";
import { getPublicMenuItemsFromCloudflare } from "../../features/admin-write/cloudflareApi";
import type { PublicMenuItem } from "../../features/cms-navigation/types";
import { appSwal, showBlockingLoading, showErrorResult, showSuccessResult } from "../../utils/swal";
import { ADMIN_READ_ONLY_NOTICE, canManageMenu } from "../utils/rbac";
import { invalidatePublicCmsData } from "../../services/publicCmsInvalidation";
import {
  filterMenuTree,
  findPublicMenuItem,
  flattenMenuOrder,
  flattenPublicMenu,
  getNextSiblingOrder,
  moveMenuSibling,
  normalizeMenuHref,
  orderIsDirty,
  parentMenuOptions,
  type MenuVisibilityFilter
} from "./menuPageModel";

interface MenuFormState {
  label: string;
  href: string;
  enabled: boolean;
  order: number;
  parentId: string;
}

interface EditingMenuItem {
  id: string;
  label: string;
  href: string;
  enabled: boolean;
  order: number;
  parentId: string | null;
  revision: number;
  hasChildren: boolean;
}

const emptyForm: MenuFormState = {
  label: "",
  href: "/",
  enabled: true,
  order: 1,
  parentId: ""
};

const menuTreeQueryKey = ["admin-menu-tree"] as const;

function createOrderMap(items: readonly AdminMenuOrderItem[]) {
  return new Map(items.map((item) => [item.id, item]));
}

export default function MenuPage() {
  const queryClient = useQueryClient();
  const { capabilities } = useAuth();
  const canManage = canManageMenu(capabilities);
  const [orderingMode, setOrderingMode] = useState(false);
  const [orderDraft, setOrderDraft] = useState<AdminMenuOrderItem[] | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<EditingMenuItem | null>(null);
  const [form, setForm] = useState<MenuFormState>(emptyForm);
  const [search, setSearch] = useState("");
  const [visibility, setVisibility] = useState<MenuVisibilityFilter>("all");

  const treeQuery = useQuery({
    queryKey: menuTreeQueryKey,
    queryFn: getPublicMenuItemsFromCloudflare
  });
  const orderQuery = useQuery(adminMenuOrderQueryOptions());

  const saveMutation = useMutation({ mutationFn: saveAdminMenuItem });
  const deleteMutation = useMutation({ mutationFn: deleteAdminMenuItem });
  const saveOrderMutation = useMutation({ mutationFn: saveAdminMenuOrder });
  const operationPending = saveMutation.isPending || deleteMutation.isPending || saveOrderMutation.isPending;

  const menuTree = treeQuery.data ?? [];
  const orderItems = orderQuery.data ?? [];
  const orderMap = useMemo(() => createOrderMap(orderItems), [orderItems]);
  const labelById = useMemo(() => new Map(orderItems.map((item) => [item.id, item.label])), [orderItems]);
  const filteredTree = useMemo(() => filterMenuTree(menuTree, search, visibility), [menuTree, search, visibility]);
  const menuRows = useMemo(() => flattenPublicMenu(filteredTree), [filteredTree]);
  const parentOptions = useMemo(() => parentMenuOptions(menuTree), [menuTree]);
  const activeOrderItems = useMemo(() => orderDraft ?? orderItems, [orderDraft, orderItems]);
  const orderRows = useMemo(() => flattenMenuOrder(activeOrderItems), [activeOrderItems]);
  const orderDirty = orderDraft !== null && orderIsDirty(orderDraft, orderItems);
  const loading = treeQuery.isLoading || orderQuery.isLoading;
  const fetching = treeQuery.isFetching || orderQuery.isFetching;
  const loadError = treeQuery.error ?? orderQuery.error;

  async function invalidateMenuData() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: menuTreeQueryKey }),
      queryClient.invalidateQueries({ queryKey: adminListQueryKeys.order("menu") }),
      invalidatePublicCmsData(queryClient)
    ]);
  }

  function openCreate(parentId = "") {
    if (!canManage || operationPending) {
      return;
    }

    setEditingItem(null);
    setForm({
      ...emptyForm,
      parentId,
      order: getNextSiblingOrder(orderItems, parentId || null)
    });
    setDialogOpen(true);
  }

  async function openEdit(item: PublicMenuItem) {
    if (!canManage || operationPending) {
      return;
    }

    const metadata = orderMap.get(item.id);
    if (!metadata) {
      await showErrorResult("ไม่สามารถเปิดรายการเมนูได้", new Error("ไม่พบข้อมูลลำดับของเมนู"), "กรุณาลองใหม่อีกครั้ง");
      return;
    }

    setEditingItem({
      id: item.id,
      label: item.label,
      href: item.href,
      enabled: item.enabled,
      order: metadata.order,
      parentId: metadata.parentId,
      revision: metadata.revision,
      hasChildren: Boolean(item.children?.length)
    });
    setForm({
      label: item.label,
      href: item.href,
      enabled: item.enabled,
      order: metadata.order,
      parentId: metadata.parentId ?? ""
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
      await appSwal.close();
      closeDialog();
      await showSuccessResult("บันทึกเมนูสำเร็จ");
    } catch (error) {
      await appSwal.close();
      await showErrorResult("ไม่สามารถบันทึกเมนูได้", error, "กรุณาลองอีกครั้ง");
    }
  }

  async function handleDelete(item: PublicMenuItem) {
    if (!canManage || operationPending) {
      return;
    }

    const metadata = orderMap.get(item.id);
    if (!metadata) {
      await showErrorResult("ไม่สามารถลบเมนูได้", new Error("ไม่พบ revision ของเมนู"), "กรุณาโหลดหน้าใหม่");
      return;
    }

    const confirmation = await appSwal.fire({
      title: "ลบรายการเมนู?",
      text: item.children?.length ? `${item.label} มีเมนูย่อยอยู่ ต้องย้ายหรือลบเมนูย่อยก่อน` : item.label,
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
      await deleteMutation.mutateAsync({ id: item.id, revision: metadata.revision });
      await invalidateMenuData();
      await appSwal.close();
      await showSuccessResult("ลบเมนูสำเร็จ");
    } catch (error) {
      await appSwal.close();
      await showErrorResult("ไม่สามารถลบเมนูได้", error, "หากเมนูนี้มีเมนูย่อย ให้ย้ายหรือลบเมนูย่อยก่อน");
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
      setOrderDraft(null);
      await appSwal.close();
      await showSuccessResult("บันทึกลำดับเมนูสำเร็จ");
    } catch (error) {
      await appSwal.close();
      await showErrorResult("ไม่สามารถบันทึกลำดับเมนูได้", error, "กรุณาลองอีกครั้ง");
    }
  }

  function toggleOrderingMode() {
    if (operationPending) {
      return;
    }

    setOrderDraft(null);
    setOrderingMode((current) => !current);
  }

  return (
    <Box>
      <PageHeader
        title="เมนู"
        description="จัดการเมนูเว็บไซต์แบบลำดับชั้น โดยแสดงเมนูย่อยอยู่ใต้เมนูหลักและซ่อนรหัสภายในที่ไม่จำเป็น"
        action={
          canManage ? (
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <Button variant="outlined" disabled={operationPending} onClick={toggleOrderingMode}>
                {orderingMode ? "กลับรายการเมนู" : "จัดลำดับ"}
              </Button>
              {!orderingMode && (
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  disabled={operationPending || loading}
                  onClick={() => openCreate()}
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

      {fetching && <LinearProgress sx={{ mb: 2 }} />}
      {loadError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {loadError instanceof Error ? loadError.message : "ไม่สามารถโหลดรายการเมนูได้"}
        </Alert>
      )}

      {orderingMode ? (
        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Box>
                <Typography variant="h3">จัดลำดับเมนู</Typography>
                <Typography sx={{ color: "text.secondary", mt: 0.5 }}>
                  ปุ่มขึ้น/ลงจะเลื่อนเฉพาะเมนูที่อยู่ภายใต้เมนูแม่เดียวกัน โดยไม่แสดงรหัส Menu ID
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
                <Button color="inherit" disabled={operationPending} onClick={toggleOrderingMode}>
                  ยกเลิกและกลับ
                </Button>
              </Stack>

              <Stack spacing={1}>
                {orderRows.map(({ item, depth }) => {
                  const siblings = activeOrderItems
                    .filter((candidate) => candidate.parentId === item.parentId)
                    .sort((left, right) => left.order - right.order || left.label.localeCompare(right.label));
                  const siblingIndex = siblings.findIndex((candidate) => candidate.id === item.id);
                  const parentLabel = item.parentId ? (labelById.get(item.parentId) ?? "เมนูแม่") : null;

                  return (
                    <Box
                      key={item.id}
                      sx={{
                        ...staticSurfaceSx,
                        ml: Math.min(depth, 5) * 2,
                        p: 1.5,
                        borderLeft: depth ? "4px solid" : undefined,
                        borderLeftColor: depth ? "primary.light" : undefined
                      }}
                    >
                      <Stack direction="row" spacing={1} sx={{ alignItems: "center", justifyContent: "space-between" }}>
                        <Box sx={{ minWidth: 0 }}>
                          <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: "center", flexWrap: "wrap" }}>
                            <Typography sx={{ fontWeight: 900 }}>{item.label}</Typography>
                            <Chip
                              size="small"
                              variant={depth ? "outlined" : "filled"}
                              label={depth ? "เมนูย่อย" : "เมนูหลัก"}
                              color={depth ? "default" : "primary"}
                            />
                            <Chip size="small" variant="outlined" label={`ลำดับ ${item.order}`} />
                          </Stack>
                          {parentLabel && (
                            <Typography variant="caption" sx={{ color: "text.secondary" }}>
                              ภายใต้ {parentLabel}
                            </Typography>
                          )}
                        </Box>

                        <Stack direction="row" spacing={0.5}>
                          <Button
                            size="small"
                            startIcon={<ArrowUpwardRoundedIcon />}
                            disabled={siblingIndex <= 0 || operationPending}
                            onClick={() =>
                              setOrderDraft((current) => moveMenuSibling(current ?? orderItems, item.id, -1))
                            }
                          >
                            ขึ้น
                          </Button>
                          <Button
                            size="small"
                            startIcon={<ArrowDownwardRoundedIcon />}
                            disabled={siblingIndex < 0 || siblingIndex >= siblings.length - 1 || operationPending}
                            onClick={() =>
                              setOrderDraft((current) => moveMenuSibling(current ?? orderItems, item.id, 1))
                            }
                          >
                            ลง
                          </Button>
                        </Stack>
                      </Stack>
                    </Box>
                  );
                })}

                {!loading && !orderRows.length && (
                  <Typography sx={{ color: "text.secondary" }}>ยังไม่มีรายการเมนู</Typography>
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
                  value={search}
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
                    value={visibility}
                    onChange={(event) => setVisibility(event.target.value as MenuVisibilityFilter)}
                  >
                    <MenuItem value="all">ทั้งหมด</MenuItem>
                    <MenuItem value="enabled">แสดง</MenuItem>
                    <MenuItem value="disabled">ซ่อน</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            <Stack spacing={1.25} aria-busy={fetching}>
              {menuRows.map(({ item, depth, parentLabel }) => {
                const metadata = orderMap.get(item.id);

                return (
                  <Box
                    key={item.id}
                    sx={{
                      ...staticSurfaceSx,
                      ml: Math.min(depth, 5) * 2.25,
                      p: depth ? 1.5 : 2,
                      borderLeft: depth ? "4px solid" : undefined,
                      borderLeftColor: depth ? "primary.light" : undefined,
                      bgcolor: depth ? "background.default" : "background.paper"
                    }}
                  >
                    <Stack
                      direction={{ xs: "column", md: "row" }}
                      spacing={1.5}
                      sx={{ alignItems: { xs: "flex-start", md: "center" }, justifyContent: "space-between" }}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: "center", flexWrap: "wrap" }}>
                          {depth > 0 && <AccountTreeRoundedIcon fontSize="small" color="action" />}
                          <Typography sx={{ fontWeight: 900 }}>{item.label}</Typography>
                          <Chip
                            size="small"
                            label={depth ? "เมนูย่อย" : "เมนูหลัก"}
                            color={depth ? "default" : "primary"}
                            variant={depth ? "outlined" : "filled"}
                          />
                          <Chip
                            size="small"
                            label={item.enabled ? "แสดง" : "ซ่อน"}
                            color={item.enabled ? "success" : "default"}
                          />
                          {metadata && <Chip size="small" variant="outlined" label={`ลำดับ ${metadata.order}`} />}
                        </Stack>

                        {parentLabel && (
                          <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 0.25 }}>
                            ภายใต้ {parentLabel}
                          </Typography>
                        )}

                        <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5, overflowWrap: "anywhere" }}>
                          {item.href}
                        </Typography>
                      </Box>

                      {canManage && (
                        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
                          <Button
                            size="small"
                            startIcon={<AddIcon />}
                            disabled={operationPending}
                            onClick={() => openCreate(item.id)}
                          >
                            เพิ่มเมนูย่อย
                          </Button>
                          <Button
                            size="small"
                            startIcon={<EditOutlinedIcon />}
                            disabled={operationPending || !metadata}
                            onClick={() => void openEdit(item)}
                          >
                            แก้ไข
                          </Button>
                          <Button
                            size="small"
                            color="error"
                            startIcon={<DeleteOutlineIcon />}
                            disabled={operationPending || !metadata || Boolean(item.children?.length)}
                            onClick={() => void handleDelete(item)}
                          >
                            ลบ
                          </Button>
                        </Stack>
                      )}
                    </Stack>
                  </Box>
                );
              })}

              {!loading && !menuRows.length && (
                <Typography sx={{ color: "text.secondary" }}>ไม่พบรายการเมนู</Typography>
              )}
            </Stack>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onClose={closeDialog} fullWidth maxWidth="sm">
        <DialogTitle>{editingItem ? "แก้ไขรายการเมนู" : form.parentId ? "เพิ่มเมนูย่อย" : "เพิ่มเมนูหลัก"}</DialogTitle>
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
              helperText="ระบบจะไม่เติม /content/ ให้อัตโนมัติ เช่น /admission จะคงเป็น /admission และ URL ภายนอกจะคงค่าเดิม"
              required
              fullWidth
            />

            <FormControl fullWidth disabled={Boolean(editingItem?.hasChildren)}>
              <InputLabel id="menu-parent-label">เมนูแม่</InputLabel>
              <Select
                labelId="menu-parent-label"
                label="เมนูแม่"
                value={form.parentId}
                onChange={(event) => setForm((current) => ({ ...current, parentId: String(event.target.value) }))}
              >
                <MenuItem value="">ไม่มี — เป็นเมนูหลัก</MenuItem>
                {parentOptions
                  .filter((option) => option.id !== editingItem?.id)
                  .map((option) => (
                    <MenuItem key={option.id} value={option.id}>
                      {`${"— ".repeat(Math.min(option.depth, 4))}${option.label}`}
                    </MenuItem>
                  ))}
              </Select>
              <FormHelperText>
                {editingItem?.hasChildren
                  ? "เมนูนี้มีเมนูย่อยอยู่ จึงยังไม่สามารถย้ายไปใต้เมนูแม่อื่นได้"
                  : "เลือกจากชื่อเมนู ระบบจะจัดการรหัสเชื่อมโยงภายในให้เอง"}
              </FormHelperText>
            </FormControl>

            <Stack direction="row" sx={{ alignItems: "center" }}>
              <Checkbox
                checked={form.enabled}
                onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))}
              />
              <Typography>แสดงในเมนูสาธารณะ</Typography>
            </Stack>
          </Stack>
        </DialogContent>
        <ResponsiveDialogActions>
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
        </ResponsiveDialogActions>
      </Dialog>
    </Box>
  );
}
