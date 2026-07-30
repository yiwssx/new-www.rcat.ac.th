import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
import Grid from "@mui/material/Grid";
import { staticSurfaceSx } from "../../design-system/componentStyles";
import ManageAccountsOutlinedIcon from "@mui/icons-material/ManageAccountsOutlined";
import SecurityOutlinedIcon from "@mui/icons-material/SecurityOutlined";
import { useAuth } from "../../context/authSessionContext";
import {
  createAdminUserWithInvitationToCloudflare,
  deleteAdminUserProfileFromCloudflare,
  issueAdminUserInvitationFromCloudflare,
  issueAdminUserPasswordResetFromCloudflare,
  resetAdminUserMfaFromCloudflare,
  revokeAdminUserInvitationFromCloudflare,
  revokeAdminUserSessionsFromCloudflare,
  saveAdminUserProfileToCloudflare,
  setAdminUserMfaRequirementFromCloudflare,
  type AdminOneTimeToken,
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
import { ADMIN_READ_ONLY_NOTICE } from "../utils/rbac";
import { userRoleLabels } from "../../utils/thaiLabels";
import { appSwal, getSwalErrorText, showBlockingLoading, showErrorResult, showSuccessResult } from "../../utils/swal";
import AdminPagination from "./AdminPagination";

const emptyDraft: Partial<AdminUserProfile> = {
  email: "",
  name: "",
  username: null,
  role: "viewer",
  status: "active"
};

const userListUrlOptions = {
  defaultPageSize: 25,
  pageSizeOptions: ADMIN_PAGE_SIZE_OPTIONS,
  defaultSortBy: "role",
  defaultSortDirection: "asc",
  filterDefaults: { role: "all", status: "all" }
} as const;

interface OneTimeSecret {
  title: string;
  token: AdminOneTimeToken;
}

function safeRevision(profile: AdminUserProfile) {
  return Number.isInteger(profile.revision) ? Number(profile.revision) : 0;
}

function invitationLabel(profile: AdminUserProfile) {
  if (profile.invitationStatus === "pending") return "คำเชิญรอดำเนินการ";
  if (profile.invitationStatus === "expired") return "คำเชิญหมดอายุ";
  return "ไม่มีคำเชิญ";
}

export default function UserManagementCard() {
  const queryClient = useQueryClient();
  const { capabilities, hasCapability, session } = useAuth();
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
  const activeAdminsQuery = useAdminUserListQuery({
    page: 1,
    pageSize: 1,
    role: "admin",
    status: "active",
    sortBy: "email",
    sortDirection: "asc"
  });
  const [editingId, setEditingId] = useState("");
  const [draft, setDraft] = useState<Partial<AdminUserProfile>>(emptyDraft);
  const [pendingAction, setPendingAction] = useState("");
  const [error, setError] = useState("");
  const [oneTimeSecret, setOneTimeSecret] = useState<OneTimeSecret | null>(null);
  const listTransitioning = usersQuery.isPlaceholderData || debouncedSearch !== q;
  const users = usersQuery.data?.items ?? [];
  const pagination = usersQuery.data?.pagination;
  const activeAdminCount = activeAdminsQuery.data?.pagination.totalItems ?? 0;
  const editingUser = users.find((profile) => profile.id === editingId) ?? null;
  const isCreating = editingId === "__new__";
  const editingRoleStatusProtected =
    editingUser?.isRoot === true ||
    (editingUser?.role === "admin" && editingUser.status === "active" && activeAdminCount <= 1);
  const operationPending = Boolean(pendingAction) || listTransitioning;
  const canCreate = hasCapability("users.create");
  const canUpdate = hasCapability("users.update-any");
  const canDelete = hasCapability("users.delete");
  const canInvite = hasCapability("users.invite");
  const canResetPassword = hasCapability("users.reset-password");
  const canRevokeSessions = hasCapability("users.revoke-sessions");
  const canRequireMfa = hasCapability("users.mfa.require");
  const canResetMfa = hasCapability("users.mfa.reset");
  const hasMutationCapability = capabilities.some((capability) =>
    [
      "users.create",
      "users.update-any",
      "users.delete",
      "users.invite",
      "users.reset-password",
      "users.revoke-sessions",
      "users.mfa.require",
      "users.mfa.reset"
    ].includes(capability)
  );

  useEffect(() => {
    const responsePage = usersQuery.data?.pagination.page;

    if (!usersQuery.isPlaceholderData && responsePage && responsePage !== page) {
      setListState({ page: responsePage }, { replace: true });
    }
  }, [page, setListState, usersQuery.data?.pagination.page, usersQuery.isPlaceholderData]);

  useEffect(() => () => setOneTimeSecret(null), []);

  function startCreate() {
    if (!canCreate || operationPending) return;
    setEditingId("__new__");
    setDraft(emptyDraft);
    setError("");
  }

  function startEdit(profile: AdminUserProfile) {
    if (!canUpdate || operationPending) return;
    setEditingId(profile.id);
    setDraft(profile);
    setError("");
  }

  async function refreshUsers() {
    await invalidateAdminListQueries(queryClient, "users");
  }

  async function handleSave() {
    if (operationPending || (isCreating ? !canCreate : !canUpdate)) {
      return;
    }

    if (
      editingUser &&
      (draft.email !== editingUser.email ||
        (draft.username || null) !== (editingUser.username || null) ||
        draft.role !== editingUser.role ||
        draft.status !== editingUser.status) &&
      !(await confirmAction(
        "ยืนยันการแก้ไขข้อมูลเข้าสู่ระบบและสิทธิ์?",
        "อีเมล ชื่อผู้ใช้ บทบาท หรือสถานะมีผลต่อการเข้าสู่ระบบและการเข้าถึง CMS"
      ))
    ) {
      return;
    }

    setPendingAction("save");
    setError("");
    showBlockingLoading("กำลังบันทึกผู้ใช้");

    try {
      if (isCreating) {
        const result = await createAdminUserWithInvitationToCloudflare({
          email: draft.email ?? "",
          name: draft.name ?? "",
          role: draft.role ?? "viewer",
          username: draft.username || null
        });
        setOneTimeSecret({ title: "โทเค็นคำเชิญสำหรับผู้ใช้ใหม่", token: result.invitation });
      } else if (editingUser) {
        await saveAdminUserProfileToCloudflare({
          id: editingUser.id,
          email: draft.email,
          name: draft.name,
          username: draft.username,
          role: draft.role,
          status: draft.status,
          revision: safeRevision(editingUser)
        });
      }

      setEditingId("");
      setDraft(emptyDraft);
      await appSwal.close();
      await refreshUsers();

      if (isCreating) {
        setPage(1);
      }

      await showSuccessResult(
        isCreating ? "สร้างผู้ใช้แล้ว โปรดส่งโทเค็นคำเชิญให้ผู้ใช้ด้วยช่องทางที่ปลอดภัย" : "บันทึกผู้ใช้สำเร็จ"
      );
    } catch (currentError) {
      await appSwal.close();
      setError(getSwalErrorText(currentError, "ไม่สามารถบันทึกผู้ใช้ได้"));
      await showErrorResult("ไม่สามารถบันทึกผู้ใช้ได้", currentError, "กรุณาลองอีกครั้ง");
    } finally {
      setPendingAction("");
    }
  }

  async function confirmAction(title: string, text: string) {
    const result = await appSwal.fire({
      title,
      text,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "ยืนยัน",
      cancelButtonText: "ยกเลิก"
    });
    return result.isConfirmed;
  }

  async function runLifecycleAction(
    action: string,
    loadingText: string,
    successText: string,
    operation: () => Promise<void>
  ) {
    setPendingAction(action);
    setError("");
    showBlockingLoading(loadingText);

    try {
      await operation();
      await appSwal.close();
      await refreshUsers();
      await showSuccessResult(successText);
    } catch (currentError) {
      await appSwal.close();
      setError(getSwalErrorText(currentError, "ไม่สามารถดำเนินการกับผู้ใช้ได้"));
      await showErrorResult("ไม่สามารถดำเนินการกับผู้ใช้ได้", currentError, "กรุณาลองอีกครั้ง");
    } finally {
      setPendingAction("");
    }
  }

  async function issueInvitation(profile: AdminUserProfile) {
    await runLifecycleAction("invite", "กำลังออกคำเชิญ", "ออกคำเชิญสำเร็จ", async () => {
      const token = await issueAdminUserInvitationFromCloudflare(profile.id);
      setOneTimeSecret({ title: `โทเค็นคำเชิญสำหรับ ${profile.name}`, token });
    });
  }

  async function issuePasswordReset(profile: AdminUserProfile) {
    await runLifecycleAction("reset", "กำลังออกโทเค็นตั้งรหัสผ่าน", "ออกโทเค็นสำเร็จ", async () => {
      const token = await issueAdminUserPasswordResetFromCloudflare(profile.id);
      setOneTimeSecret({ title: `โทเค็นตั้งรหัสผ่านใหม่สำหรับ ${profile.name}`, token });
    });
  }

  async function deleteUser(profile: AdminUserProfile) {
    if (
      !canDelete ||
      operationPending ||
      profile.id === session?.user.id ||
      profile.isRoot ||
      (profile.role === "admin" && profile.status === "active" && activeAdminCount <= 1) ||
      !(await confirmAction("ลบผู้ใช้?", `ลบบัญชี ${profile.name} อย่างถาวร`))
    ) {
      return;
    }

    await runLifecycleAction("delete", "กำลังลบผู้ใช้", "ลบผู้ใช้สำเร็จ", async () => {
      await deleteAdminUserProfileFromCloudflare({ id: profile.id, revision: safeRevision(profile) });

      if (pagination) {
        const nextPage = getAdminPageAfterDelete(pagination);
        if (nextPage !== page) setPage(nextPage);
      }
    });
  }

  async function revokeInvitation(profile: AdminUserProfile) {
    if (!(await confirmAction("เพิกถอนคำเชิญ?", "โทเค็นคำเชิญที่ยังไม่ใช้จะใช้ไม่ได้ทันที"))) return;
    await runLifecycleAction("revoke-invite", "กำลังเพิกถอนคำเชิญ", "เพิกถอนคำเชิญสำเร็จ", async () => {
      await revokeAdminUserInvitationFromCloudflare(profile.id);
    });
  }

  async function revokeSessions(profile: AdminUserProfile) {
    if (!(await confirmAction("เพิกถอนเซสชันทั้งหมด?", `${profile.name} จะต้องเข้าสู่ระบบใหม่ทุกอุปกรณ์`))) return;
    await runLifecycleAction("revoke-sessions", "กำลังเพิกถอนเซสชัน", "เพิกถอนเซสชันสำเร็จ", async () => {
      await revokeAdminUserSessionsFromCloudflare(profile.id);
    });
  }

  async function toggleMfaRequirement(profile: AdminUserProfile) {
    const required = !profile.mfaRequired;
    if (
      (profile.isRoot && !required) ||
      !(await confirmAction(
        required ? "บังคับใช้ MFA?" : "ยกเลิกการบังคับใช้ MFA?",
        required
          ? "ผู้ใช้จะต้องตั้งค่า MFA เมื่อเข้าสู่ระบบครั้งถัดไป"
          : "การยกเลิกข้อกำหนดจะไม่ปิดปัจจัย MFA ที่ตั้งค่าไว้แล้ว"
      ))
    ) {
      return;
    }
    await runLifecycleAction("mfa-required", "กำลังปรับข้อกำหนด MFA", "ปรับข้อกำหนด MFA สำเร็จ", async () => {
      await setAdminUserMfaRequirementFromCloudflare(profile.id, required, safeRevision(profile));
    });
  }

  async function resetMfa(profile: AdminUserProfile) {
    if (
      profile.isRoot ||
      !(await confirmAction(
        "รีเซ็ตปัจจัย MFA?",
        "การตั้งค่าแอปยืนยันตัวตนและรหัสกู้คืนทั้งหมดจะถูกลบ เซสชันทั้งหมดจะถูกเพิกถอน และผู้ใช้ที่ถูกบังคับใช้ MFA ต้องลงทะเบียนใหม่"
      ))
    ) {
      return;
    }
    await runLifecycleAction("mfa-reset", "กำลังรีเซ็ต MFA", "รีเซ็ต MFA สำเร็จ", async () => {
      await resetAdminUserMfaFromCloudflare(profile.id);
    });
  }

  async function copyOneTimeToken() {
    if (oneTimeSecret) {
      await navigator.clipboard?.writeText(oneTimeSecret.token.token);
    }
  }

  return (
    <Card>
      <CardContent>
        <Stack spacing={2.5}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={2}
            sx={{
              justifyContent: "space-between"
            }}
          >
            <Stack
              direction="row"
              spacing={1.5}
              sx={{
                alignItems: "flex-start"
              }}
            >
              <ManageAccountsOutlinedIcon color="primary" />
              <Box>
                <Typography variant="h3">ผู้ใช้และวงจรชีวิตบัญชี</Typography>
                <Typography
                  sx={{
                    color: "text.secondary",
                    mt: 0.75
                  }}
                >
                  จัดการบัญชี คำเชิญ การตั้งรหัสผ่าน เซสชัน และ MFA ผ่านนโยบายของเซิร์ฟเวอร์
                </Typography>
              </Box>
            </Stack>
            <Chip label={`บทบาทปัจจุบัน: ${session?.user.role ?? "-"}`} />
          </Stack>

          <Alert severity="info" icon={<SecurityOutlinedIcon />}>
            การควบคุมในหน้านี้แสดงตามความสามารถจากเซิร์ฟเวอร์ การอนุญาตขั้นสุดท้ายยังตรวจสอบที่ Worker ทุกครั้ง
          </Alert>
          {!hasMutationCapability && <Alert severity="warning">{ADMIN_READ_ONLY_NOTICE}</Alert>}
          {error && (
            <Alert severity="error" aria-live="assertive">
              {error}
            </Alert>
          )}

          {oneTimeSecret && (
            <Card variant="outlined">
              <CardContent>
                <Stack spacing={1.5}>
                  <Alert severity="warning">
                    {oneTimeSecret.title} จะแสดงเพียงครั้งเดียว โปรดส่งด้วยช่องทางที่ปลอดภัยและอย่าบันทึกในระบบ
                  </Alert>
                  <TextField
                    label="โทเค็นสำหรับส่งด้วยตนเอง"
                    value={oneTimeSecret.token.token}
                    slotProps={{ input: { readOnly: true } }}
                    fullWidth
                  />
                  <Typography
                    sx={{
                      color: "text.secondary"
                    }}
                  >
                    หมดอายุ: {oneTimeSecret.token.expiresAt}
                  </Typography>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                    <Button variant="outlined" onClick={() => void copyOneTimeToken()}>
                      คัดลอก
                    </Button>
                    <Button variant="contained" onClick={() => setOneTimeSecret(null)}>
                      ฉันได้ส่งหรือจัดเก็บโทเค็นแล้ว
                    </Button>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          )}

          {canCreate && (
            <Button
              variant="contained"
              disabled={operationPending}
              onClick={startCreate}
              sx={{ alignSelf: "flex-start" }}
            >
              เพิ่มผู้ใช้
            </Button>
          )}

          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                size="small"
                label="ค้นหาผู้ใช้"
                value={q}
                onChange={(event) => setSearch(event.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <FormControl fullWidth size="small">
                <InputLabel id="admin-user-list-role-filter-label">บทบาท</InputLabel>
                <Select
                  labelId="admin-user-list-role-filter-label"
                  label="บทบาท"
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
            <Box
              sx={{
                ...staticSurfaceSx,
                p: 2
              }}
            >
              <Stack spacing={2}>
                <Typography
                  sx={{
                    fontWeight: 900
                  }}
                >
                  {isCreating ? "เพิ่มผู้ใช้" : "แก้ไขผู้ใช้"}
                </Typography>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <TextField
                      fullWidth
                      label="ชื่อ"
                      value={draft.name ?? ""}
                      onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <TextField
                      fullWidth
                      label="อีเมล"
                      value={draft.email ?? ""}
                      onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <TextField
                      fullWidth
                      label="ชื่อผู้ใช้ (ไม่บังคับ)"
                      value={draft.username ?? ""}
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, username: event.target.value || null }))
                      }
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <FormControl fullWidth>
                      <InputLabel id="admin-user-role-label">บทบาท</InputLabel>
                      <Select
                        labelId="admin-user-role-label"
                        label="บทบาท"
                        value={draft.role ?? "viewer"}
                        onChange={(event) =>
                          setDraft((current) => ({ ...current, role: event.target.value as AdminUserProfile["role"] }))
                        }
                        disabled={editingRoleStatusProtected}
                      >
                        <MenuItem value="admin">admin</MenuItem>
                        <MenuItem value="editor">editor</MenuItem>
                        <MenuItem value="viewer">viewer</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  {!isCreating && (
                    <Grid size={{ xs: 12, md: 6 }}>
                      <FormControl fullWidth>
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
                          disabled={editingRoleStatusProtected}
                        >
                          <MenuItem value="active">active</MenuItem>
                          <MenuItem value="disabled">disabled</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                  )}
                </Grid>
                {editingRoleStatusProtected && (
                  <Alert severity="info">
                    ไม่สามารถเปลี่ยนบทบาทหรือสถานะของ Root หรือผู้ดูแลระบบที่ใช้งานอยู่คนสุดท้าย
                  </Alert>
                )}
                <Stack direction="row" spacing={1}>
                  <Button variant="contained" onClick={() => void handleSave()} disabled={operationPending}>
                    บันทึก
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => {
                      setEditingId("");
                      setDraft(emptyDraft);
                    }}
                    disabled={operationPending}
                  >
                    ยกเลิก
                  </Button>
                </Stack>
              </Stack>
            </Box>
          )}

          {listTransitioning && <LinearProgress />}
          {usersQuery.isLoading ? (
            <Stack
              direction="row"
              spacing={1}
              sx={{
                alignItems: "center"
              }}
            >
              <CircularProgress size={20} />
              <Typography>กำลังโหลดผู้ใช้</Typography>
            </Stack>
          ) : (
            <Stack spacing={1.5}>
              {users.map((profile) => {
                const self = profile.id === session?.user.id;
                const lastAdmin = profile.role === "admin" && profile.status === "active" && activeAdminCount <= 1;
                const rootProtected = profile.isRoot === true;
                const canRevokeRootSessions = rootProtected && self && session?.user.isRoot === true;

                return (
                  <Box
                    key={profile.id}
                    sx={{
                      ...staticSurfaceSx,
                      p: 2,
                      bgcolor: self ? "primary.light" : "background.paper"
                    }}
                  >
                    <Stack spacing={1.5}>
                      <Stack
                        direction={{ xs: "column", md: "row" }}
                        spacing={1}
                        sx={{
                          justifyContent: "space-between"
                        }}
                      >
                        <Box>
                          <Typography
                            sx={{
                              fontWeight: 900
                            }}
                          >
                            {profile.name} {rootProtected ? "(Root)" : ""}
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{
                              color: "text.secondary"
                            }}
                          >
                            {profile.email} · {profile.username ?? "ไม่มีชื่อผู้ใช้"}
                          </Typography>
                        </Box>
                        <Stack
                          direction="row"
                          spacing={0.75}
                          useFlexGap
                          sx={{
                            flexWrap: "wrap"
                          }}
                        >
                          <Chip size="small" label={userRoleLabels[profile.role]} />
                          <Chip size="small" label={profile.status === "active" ? "ใช้งาน" : "ปิดใช้งาน"} />
                          <Chip size="small" label={invitationLabel(profile)} />
                          {self && <Chip size="small" color="primary" label="บัญชีของคุณ" />}
                        </Stack>
                      </Stack>
                      <Typography
                        variant="body2"
                        sx={{
                          color: "text.secondary"
                        }}
                      >
                        credential: {profile.credentialConfigured ? "พร้อม" : "ยังไม่ตั้งค่า"} · MFA:
                        {profile.mfaConfigured ? " ตั้งค่าแล้ว" : " ยังไม่ตั้งค่า"} · บังคับ:
                        {profile.mfaRequired ? " ใช่" : " ไม่"} · รหัสกู้คืน: {profile.recoveryCodesRemaining ?? 0}
                      </Typography>
                      {profile.invitationExpiresAt && (
                        <Typography variant="body2">คำเชิญหมดอายุ: {profile.invitationExpiresAt}</Typography>
                      )}
                      {profile.lastLoginAt && (
                        <Typography variant="body2">เข้าสู่ระบบล่าสุด: {profile.lastLoginAt}</Typography>
                      )}
                      <Stack
                        direction={{ xs: "column", sm: "row" }}
                        spacing={1}
                        useFlexGap
                        sx={{
                          flexWrap: "wrap"
                        }}
                      >
                        {canUpdate && (
                          <Button variant="outlined" onClick={() => startEdit(profile)} disabled={operationPending}>
                            แก้ไข
                          </Button>
                        )}
                        {canInvite && !rootProtected && !profile.credentialConfigured && (
                          <Button
                            variant="outlined"
                            onClick={() => void issueInvitation(profile)}
                            disabled={operationPending}
                          >
                            ออก/ออกใหม่คำเชิญ
                          </Button>
                        )}
                        {canInvite && profile.invitationStatus === "pending" && !rootProtected && (
                          <Button
                            variant="outlined"
                            color="warning"
                            onClick={() => void revokeInvitation(profile)}
                            disabled={operationPending}
                          >
                            เพิกถอนคำเชิญ
                          </Button>
                        )}
                        {canResetPassword &&
                          !rootProtected &&
                          profile.credentialConfigured &&
                          profile.status === "active" && (
                            <Button
                              variant="outlined"
                              onClick={() => void issuePasswordReset(profile)}
                              disabled={operationPending}
                            >
                              ออกโทเค็นตั้งรหัสผ่าน
                            </Button>
                          )}
                        {canRevokeSessions && (!rootProtected || canRevokeRootSessions) && (
                          <Button
                            variant="outlined"
                            onClick={() => void revokeSessions(profile)}
                            disabled={operationPending}
                          >
                            เพิกถอนเซสชัน
                          </Button>
                        )}
                        {canRequireMfa && (
                          <Button
                            variant="outlined"
                            onClick={() => void toggleMfaRequirement(profile)}
                            disabled={operationPending || (rootProtected && profile.mfaRequired)}
                          >
                            {profile.mfaRequired ? "ยกเลิกบังคับ MFA" : "บังคับใช้ MFA"}
                          </Button>
                        )}
                        {canResetMfa && profile.mfaConfigured && (
                          <Button
                            variant="outlined"
                            color="warning"
                            onClick={() => void resetMfa(profile)}
                            disabled={operationPending || rootProtected}
                            title={rootProtected ? "การรีเซ็ต MFA ของ Root ต้องทำโดย Root พร้อมหลักฐานเพิ่มเติม" : ""}
                          >
                            รีเซ็ต MFA
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            variant="outlined"
                            color="error"
                            onClick={() => void deleteUser(profile)}
                            disabled={operationPending || self || rootProtected || lastAdmin}
                          >
                            ลบผู้ใช้
                          </Button>
                        )}
                      </Stack>
                      {rootProtected && (
                        <Alert severity="info">การดำเนินการที่มีผลต่อ Root ถูกจำกัดตามนโยบายของเซิร์ฟเวอร์</Alert>
                      )}
                    </Stack>
                  </Box>
                );
              })}
              {!users.length && (
                <Typography
                  sx={{
                    color: "text.secondary"
                  }}
                >
                  ไม่พบผู้ใช้
                </Typography>
              )}
            </Stack>
          )}

          {usersQuery.isError && <Alert severity="error">ไม่สามารถโหลดรายการผู้ใช้ได้</Alert>}
          {pagination && (
            <AdminPagination
              pagination={pagination}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={ADMIN_PAGE_SIZE_OPTIONS}
              disabled={operationPending}
              isFetching={usersQuery.isFetching}
            />
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
