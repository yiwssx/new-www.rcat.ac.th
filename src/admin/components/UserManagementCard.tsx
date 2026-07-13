import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
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
import ManageAccountsOutlinedIcon from "@mui/icons-material/ManageAccountsOutlined";
import SecurityOutlinedIcon from "@mui/icons-material/SecurityOutlined";
import { useAuth } from "../../context/authSessionContext";
import {
  deleteAdminUserProfileFromCloudflare,
  saveAdminUserProfileToCloudflare,
  type AdminUserProfile
} from "../../features/admin-write/cloudflareApi";
import {
  ADMIN_PAGE_SIZE_OPTIONS,
  getAdminPageAfterDelete,
  invalidateAdminListQueries,
  useAdminListUrlState,
  useAdminUserListQuery,
  useDebouncedValue
} from "../../features/admin-pagination";
import { ADMIN_READ_ONLY_NOTICE, canManageUsers, canSelfEditUserProfile, isReadOnlyAdminUser } from "../utils/rbac";
import { userRoleLabels } from "../../utils/thaiLabels";
import type { User } from "../../types";
import { appSwal, getSwalErrorText, showBlockingLoading, showErrorResult, showSuccessResult } from "../../utils/swal";
import { useQueryClient } from "@tanstack/react-query";
import AdminPagination from "./AdminPagination";

const cannotEditOtherUsersNotice = "บัญชีนี้ไม่มีสิทธิ์แก้ไขผู้ใช้อื่น";
const cannotDeleteSelfNotice = "ไม่สามารถลบบัญชีของตนเองได้";
const lastActiveAdminNotice = "ต้องมีผู้ดูแลระบบที่ใช้งานอย่างน้อยหนึ่งบัญชี";

const emptyDraft: Partial<AdminUserProfile> = {
  email: "",
  name: "",
  role: "viewer",
  status: "active"
};

const roleRows: Array<{ role: User["role"]; description: string }> = [
  {
    role: "admin",
    description: "จัดการผู้ใช้ เนื้อหา สื่อ เมนู การตั้งค่า และการเชื่อมต่อระบบได้ทั้งหมด"
  },
  {
    role: "editor",
    description: "จัดการเนื้อหา เอกสาร สไลด์ E-Service สื่อ และปฏิทินได้ แต่แก้ไขผู้ใช้อื่นหรือการตั้งค่าเว็บไซต์ไม่ได้"
  },
  {
    role: "viewer",
    description: "บัญชี viewer สามารถดูข้อมูลได้เท่านั้น"
  }
];

const userListUrlOptions = {
  defaultPageSize: 25,
  pageSizeOptions: ADMIN_PAGE_SIZE_OPTIONS,
  defaultSortBy: "role",
  defaultSortDirection: "asc",
  filterDefaults: { role: "all", status: "all" }
} as const;

function isSelfProfile(profile: Pick<AdminUserProfile, "email">, user: User | null | undefined) {
  return profile.email.trim().toLowerCase() === (user?.email ?? "").trim().toLowerCase();
}

function getSafeRevision(profile: AdminUserProfile) {
  return Number.isInteger(profile.revision) ? profile.revision : undefined;
}

export default function UserManagementCard() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const user = session?.user;
  const canManage = canManageUsers(user);
  const canSelfEdit = canSelfEditUserProfile(user);
  const readOnly = isReadOnlyAdminUser(user);
  const {
    page,
    pageSize,
    q,
    sortBy,
    sortDirection,
    filters,
    setState: setListState,
    setPage,
    setPageSize,
    setSearch,
    setFilter
  } = useAdminListUrlState<"role" | "status">(userListUrlOptions);
  const debouncedSearch = useDebouncedValue(q, 300);
  const usersQuery = useAdminUserListQuery({
    page,
    pageSize,
    q: debouncedSearch,
    sortBy,
    sortDirection,
    role: filters.role as AdminUserProfile["role"] | "all",
    status: filters.status as AdminUserProfile["status"] | "all"
  });
  const listTransitioning = usersQuery.isPlaceholderData || debouncedSearch !== q;
  const activeAdminsQuery = useAdminUserListQuery({
    page: 1,
    pageSize: 1,
    role: "admin",
    status: "active",
    sortBy: "email",
    sortDirection: "asc"
  });
  const selfProfileQuery = useAdminUserListQuery({
    page: 1,
    pageSize: 1,
    q: user?.email ?? "",
    sortBy: "email",
    sortDirection: "asc"
  });
  const users = usersQuery.data?.items ?? [];
  const pagination = usersQuery.data?.pagination;

  useEffect(() => {
    const responsePage = usersQuery.data?.pagination.page;

    if (!usersQuery.isPlaceholderData && responsePage && responsePage !== page) {
      setListState({ page: responsePage }, { replace: true });
    }
  }, [page, setListState, usersQuery.data?.pagination.page, usersQuery.isPlaceholderData]);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState("");
  const [draft, setDraft] = useState<Partial<AdminUserProfile>>(emptyDraft);
  const [savingUser, setSavingUser] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  const activeAdminCount = activeAdminsQuery.data?.pagination.totalItems ?? 0;
  const selfProfile =
    users.find((profile) => isSelfProfile(profile, user)) ??
    selfProfileQuery.data?.items.find((profile) => isSelfProfile(profile, user)) ??
    null;
  const editingUser =
    users.find((profile) => profile.id === editingId) ?? (selfProfile?.id === editingId ? selfProfile : null);
  const isCreating = editingId === "__new__";
  const canEditCurrentDraft = isCreating
    ? canManage
    : Boolean(editingUser && (canManage || (canSelfEdit && isSelfProfile(editingUser, user))));
  const showSelfEditOnlyNotice = !canManage && canSelfEdit && Boolean(selfProfile);
  const userOperationPending = savingUser || deletingUserId !== null || listTransitioning;

  function startCreate() {
    if (userOperationPending) {
      return;
    }

    setEditingId("__new__");
    setDraft(emptyDraft);
    setError("");
  }

  function startEdit(profile: AdminUserProfile) {
    if (userOperationPending) {
      return;
    }

    setEditingId(profile.id);
    setDraft(profile);
    setError("");
  }

  function stopEditing() {
    if (userOperationPending) {
      return;
    }

    setEditingId("");
    setDraft(emptyDraft);
  }

  async function saveDraft() {
    if (!canEditCurrentDraft) {
      setError(cannotEditOtherUsersNotice);
      return;
    }

    if (userOperationPending) {
      return;
    }

    setSavingUser(true);
    setError("");
    showBlockingLoading("กำลังบันทึกผู้ใช้");

    try {
      const payload =
        !canManage && editingUser
          ? {
              id: editingUser.id,
              name: draft.name,
              revision: getSafeRevision(editingUser)
            }
          : {
              ...draft,
              id: isCreating ? undefined : editingUser?.id,
              revision: editingUser ? getSafeRevision(editingUser) : undefined
            };
      await saveAdminUserProfileToCloudflare(payload);

      await appSwal.close();
      await invalidateAdminListQueries(queryClient, "users");

      if (isCreating) {
        setPage(1);
      }

      setEditingId("");
      setDraft(emptyDraft);
      await showSuccessResult("บันทึกผู้ใช้สำเร็จ");
    } catch (saveError) {
      await appSwal.close();
      setError(getSwalErrorText(saveError, "ไม่สามารถบันทึกผู้ใช้ได้"));
      await showErrorResult("ไม่สามารถบันทึกผู้ใช้ได้", saveError, "กรุณาลองอีกครั้ง");
    } finally {
      setSavingUser(false);
    }
  }

  async function deleteUser(profile: AdminUserProfile) {
    if (userOperationPending) {
      return;
    }

    if (isSelfProfile(profile, user)) {
      setError(cannotDeleteSelfNotice);
      return;
    }

    if (!canManage) {
      setError(cannotEditOtherUsersNotice);
      return;
    }

    if (profile.role === "admin" && profile.status === "active" && activeAdminCount <= 1) {
      setError(lastActiveAdminNotice);
      return;
    }

    setDeletingUserId(profile.id);
    setError("");
    showBlockingLoading("กำลังลบผู้ใช้");

    try {
      await deleteAdminUserProfileFromCloudflare({ id: profile.id, revision: getSafeRevision(profile) });
      await appSwal.close();
      await invalidateAdminListQueries(queryClient, "users");

      if (pagination) {
        const nextPage = getAdminPageAfterDelete(pagination);

        if (nextPage !== page) {
          setPage(nextPage);
        }
      }

      await showSuccessResult("ลบผู้ใช้สำเร็จ");
    } catch (deleteError) {
      await appSwal.close();
      setError(getSwalErrorText(deleteError, "ไม่สามารถลบผู้ใช้ได้"));
      await showErrorResult("ไม่สามารถลบผู้ใช้ได้", deleteError, "กรุณาลองอีกครั้ง");
    } finally {
      setDeletingUserId(null);
    }
  }

  return (
    <Card>
      <CardContent>
        <Stack spacing={2.5}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} justifyContent="space-between">
            <Stack direction="row" spacing={1.5} alignItems="flex-start">
              <ManageAccountsOutlinedIcon color="primary" />
              <Box>
                <Typography variant="h3">ผู้ใช้และสิทธิ์การเข้าถึง</Typography>
                <Typography color="text.secondary" sx={{ mt: 0.75 }}>
                  จัดการโปรไฟล์ผู้ใช้ของระบบผ่าน Cloudflare/D1 โดยใช้ Cloudflare Access เป็นผู้ยืนยันตัวตน
                </Typography>
              </Box>
            </Stack>
            <Chip
              color={canManage ? "success" : "default"}
              label={user?.role ? `บทบาทปัจจุบัน: ${userRoleLabels[user.role]}` : "ยังไม่มีเซสชันผู้ใช้"}
              sx={{ alignSelf: { xs: "flex-start", md: "center" } }}
            />
          </Stack>

          <Alert severity="info" icon={<SecurityOutlinedIcon />}>
            ระบบนี้ย้ายการจัดการผู้ใช้ออกจาก Apps Script แล้ว โปรไฟล์ผู้ใช้เก็บเฉพาะ metadata ใน Cloudflare D1
            ไม่มีรหัสผ่าน ไม่มี password reset และไม่บันทึกอีเมลจริงหรือข้อมูลลับลงใน Git
          </Alert>

          {readOnly && <Alert severity="warning">{ADMIN_READ_ONLY_NOTICE}</Alert>}
          {showSelfEditOnlyNotice && <Alert severity="warning">{cannotEditOtherUsersNotice}</Alert>}
          {error && <Alert severity="error">{error}</Alert>}

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "stretch", sm: "center" }}>
            {canManage && (
              <Button variant="contained" disabled={userOperationPending} onClick={startCreate}>
                เพิ่มผู้ใช้
              </Button>
            )}
            {!canManage && canSelfEdit && selfProfile && (
              <Button variant="outlined" disabled={userOperationPending} onClick={() => startEdit(selfProfile)}>
                แก้ไขบัญชีของฉัน
              </Button>
            )}
          </Stack>

          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                size="small"
                label="ค้นหาผู้ใช้"
                value={q}
                onChange={(event) => setSearch(event.target.value)}
                slotProps={{ htmlInput: { "aria-label": "ค้นหาผู้ใช้" } }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <FormControl fullWidth size="small">
                <InputLabel id="admin-user-list-role-filter-label">สิทธิ์</InputLabel>
                <Select
                  labelId="admin-user-list-role-filter-label"
                  label="สิทธิ์"
                  value={filters.role}
                  onChange={(event) => setFilter("role", event.target.value)}
                >
                  <MenuItem value="all">ทั้งหมด</MenuItem>
                  <MenuItem value="admin">admin</MenuItem>
                  <MenuItem value="editor">editor</MenuItem>
                  <MenuItem value="viewer">viewer</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <FormControl fullWidth size="small">
                <InputLabel id="admin-user-list-status-filter-label">สถานะ</InputLabel>
                <Select
                  labelId="admin-user-list-status-filter-label"
                  label="สถานะ"
                  value={filters.status}
                  onChange={(event) => setFilter("status", event.target.value)}
                >
                  <MenuItem value="all">ทั้งหมด</MenuItem>
                  <MenuItem value="active">ใช้งาน</MenuItem>
                  <MenuItem value="disabled">ปิดใช้งาน</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          {editingId && (
            <Box sx={{ p: 2, borderRadius: 2, border: "1px solid rgba(31, 90, 44, 0.12)" }}>
              <Stack spacing={2}>
                <Typography fontWeight={900}>{isCreating ? "เพิ่มผู้ใช้" : "แก้ไขผู้ใช้"}</Typography>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <TextField
                      fullWidth
                      label="ชื่อ"
                      value={draft.name ?? ""}
                      onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                      disabled={userOperationPending}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <TextField
                      fullWidth
                      disabled={userOperationPending || !canManage || !isCreating}
                      label="อีเมล"
                      value={draft.email ?? ""}
                      onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 2 }}>
                    <FormControl fullWidth disabled={userOperationPending || !canManage}>
                      <InputLabel id="admin-user-role-label">สิทธิ์</InputLabel>
                      <Select
                        labelId="admin-user-role-label"
                        label="สิทธิ์"
                        value={draft.role ?? "viewer"}
                        onChange={(event) =>
                          setDraft((current) => ({ ...current, role: event.target.value as AdminUserProfile["role"] }))
                        }
                      >
                        <MenuItem value="admin">admin</MenuItem>
                        <MenuItem value="editor">editor</MenuItem>
                        <MenuItem value="viewer">viewer</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid size={{ xs: 12, md: 2 }}>
                    <FormControl fullWidth disabled={userOperationPending || !canManage}>
                      <InputLabel id="admin-user-status-label">สถานะ</InputLabel>
                      <Select
                        labelId="admin-user-status-label"
                        label="สถานะ"
                        value={draft.status ?? "active"}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            status: event.target.value as AdminUserProfile["status"]
                          }))
                        }
                      >
                        <MenuItem value="active">active</MenuItem>
                        <MenuItem value="disabled">disabled</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>
                <Stack direction="row" spacing={1}>
                  <Button
                    variant="contained"
                    onClick={saveDraft}
                    disabled={!canEditCurrentDraft || userOperationPending}
                  >
                    {savingUser ? "กำลังบันทึก" : "บันทึกผู้ใช้"}
                  </Button>
                  <Button variant="outlined" onClick={stopEditing} disabled={userOperationPending}>
                    ยกเลิก
                  </Button>
                </Stack>
              </Stack>
            </Box>
          )}

          {listTransitioning && <LinearProgress sx={{ mb: 1 }} />}
          <Stack
            spacing={1.25}
            aria-busy={usersQuery.isFetching || listTransitioning}
            sx={{ opacity: listTransitioning ? 0.55 : 1, transition: "opacity 120ms ease" }}
          >
            {usersQuery.isLoading ? (
              <Stack direction="row" spacing={1} alignItems="center">
                <CircularProgress size={20} />
                <Typography color="text.secondary">กำลังโหลดผู้ใช้</Typography>
              </Stack>
            ) : (
              users.map((profile) => {
                const self = isSelfProfile(profile, user);
                const canEdit = canManage || (canSelfEdit && self);
                const deleteDisabled =
                  self || (profile.role === "admin" && profile.status === "active" && activeAdminCount <= 1);

                return (
                  <Box
                    key={profile.id}
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      border: "1px solid rgba(31, 90, 44, 0.12)",
                      bgcolor: self ? "primary.light" : "background.paper"
                    }}
                  >
                    <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} justifyContent="space-between">
                      <Box>
                        <Typography fontWeight={900}>{profile.name}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {profile.email}
                        </Typography>
                        <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                          <Chip size="small" label={userRoleLabels[profile.role]} />
                          <Chip size="small" label={profile.status === "active" ? "ใช้งาน" : "ปิดใช้งาน"} />
                          {self && <Chip size="small" color="primary" label="บัญชีของคุณ" />}
                        </Stack>
                      </Box>
                      <Stack direction="row" spacing={1} alignItems="center">
                        {canEdit ? (
                          <Button variant="outlined" disabled={userOperationPending} onClick={() => startEdit(profile)}>
                            แก้ไข
                          </Button>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            {readOnly ? "บัญชี viewer สามารถดูข้อมูลได้เท่านั้น" : cannotEditOtherUsersNotice}
                          </Typography>
                        )}
                        {canManage && (
                          <Button
                            color="error"
                            disabled={deleteDisabled || userOperationPending}
                            variant="outlined"
                            onClick={() => void deleteUser(profile)}
                          >
                            ลบผู้ใช้
                          </Button>
                        )}
                      </Stack>
                    </Stack>
                    {self && canManage && (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        {cannotDeleteSelfNotice}
                      </Typography>
                    )}
                    {profile.role === "admin" && profile.status === "active" && activeAdminCount <= 1 && (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        {lastActiveAdminNotice}
                      </Typography>
                    )}
                  </Box>
                );
              })
            )}
            {!usersQuery.isLoading && !users.length && (
              <Typography color="text.secondary">ไม่พบผู้ใช้ที่ตรงกับเงื่อนไข</Typography>
            )}
          </Stack>

          {usersQuery.isError && (
            <Alert severity="error">
              {usersQuery.error instanceof Error ? usersQuery.error.message : "ไม่สามารถโหลดรายการผู้ใช้ได้"}
            </Alert>
          )}

          {pagination && (
            <AdminPagination
              pagination={pagination}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={ADMIN_PAGE_SIZE_OPTIONS}
              disabled={userOperationPending}
              isFetching={usersQuery.isFetching}
            />
          )}

          <Box
            sx={{
              borderRadius: 2,
              border: "1px solid rgba(31, 90, 44, 0.12)",
              overflow: "hidden"
            }}
          >
            {roleRows.map((row, index) => (
              <Stack
                key={row.role}
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                sx={{
                  p: 1.5,
                  borderTop: index === 0 ? 0 : "1px solid rgba(31, 90, 44, 0.12)",
                  bgcolor: row.role === user?.role ? "primary.light" : "background.paper"
                }}
              >
                <Typography sx={{ minWidth: 120, fontWeight: 900 }}>{userRoleLabels[row.role]}</Typography>
                <Typography color="text.secondary">{row.description}</Typography>
              </Stack>
            ))}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}
