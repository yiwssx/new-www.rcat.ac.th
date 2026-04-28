import {
  useState } from "react";
import { useQuery,
  useQueryClient } from "@tanstack/react-query";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography
} from "@mui/material";
import Grid from "@mui/material/Grid2";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import ManageAccountsOutlinedIcon from "@mui/icons-material/ManageAccountsOutlined";
import RestartAltOutlinedIcon from "@mui/icons-material/RestartAltOutlined";
import { useAuth } from "../context/AuthContext";
import {
  deleteUserAccount,
  getUserAccounts,
  resetUserAccounts,
  saveUserAccount
} from "../services/users";
import { User, UserAccount } from "../types";
import { appSwal } from "../utils/swal";
import { userRoleLabels, userStatusLabels } from "../utils/thaiLabels";

type UserRole = User["role"];
type UserStatus = UserAccount["status"];

interface UserFormState {
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  password: string;
}

const roleOptions: UserRole[] = ["admin", "editor", "viewer"];
const statusOptions: UserStatus[] = ["active", "disabled"];

const emptyForm: UserFormState = {
  name: "",
  email: "",
  role: "editor",
  status: "active",
  password: ""
};

function toFormState(user: UserAccount): UserFormState {
  return {
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    password: ""
  };
}

export default function UserManagementCard() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = session?.user.role === "admin";
  const usersQuery = useQuery({
    queryKey: ["cms-users"],
    queryFn: getUserAccounts,
    enabled: isAdmin
  });
  const users = usersQuery.data ?? [];
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | undefined>();
  const [form, setForm] = useState<UserFormState>(emptyForm);

  const editingUser = users.find((user) => user.id === editingUserId);
  const isEditing = Boolean(editingUser);

  function handleCreate() {
    setEditingUserId(undefined);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function handleEdit(user: UserAccount) {
    setEditingUserId(user.id);
    setForm(toFormState(user));
    setDialogOpen(true);
  }

  function handleClose() {
    setDialogOpen(false);
    setEditingUserId(undefined);
    setForm(emptyForm);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.email.trim()) {
      await appSwal.fire({
        icon: "error",
        title: "ข้อมูลผู้ใช้ไม่ครบ",
        text: "ต้องระบุชื่อและอีเมล",
        confirmButtonText: "ตกลง"
      });
      return;
    }

    if (!isEditing && form.password.length < 6) {
      await appSwal.fire({
        icon: "error",
        title: "ต้องระบุรหัสผ่าน",
        text: "ผู้ใช้ใหม่ต้องมีรหัสผ่านอย่างน้อย 6 ตัวอักษร",
        confirmButtonText: "ตกลง"
      });
      return;
    }

    if (isEditing && form.password && form.password.length < 6) {
      await appSwal.fire({
        icon: "error",
        title: "รหัสผ่านสั้นเกินไป",
        text: "ใช้รหัสผ่านอย่างน้อย 6 ตัวอักษร หรือเว้นว่างเพื่อใช้รหัสผ่านเดิม",
        confirmButtonText: "ตกลง"
      });
      return;
    }

    try {
      await saveUserAccount(
        {
          id: editingUserId,
          name: form.name,
          email: form.email,
          role: form.role,
          status: form.status,
          password: form.password || undefined
        },
        session?.user
      );
      await queryClient.invalidateQueries({ queryKey: ["cms-users"] });
      handleClose();
      await appSwal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: isEditing ? "อัปเดตผู้ใช้แล้ว" : "เพิ่มผู้ใช้แล้ว",
        showConfirmButton: false,
        timer: 1400,
        timerProgressBar: true
      });
    } catch (error) {
      await appSwal.fire({
        icon: "error",
        title: "ไม่สามารถบันทึกผู้ใช้ได้",
        text: error instanceof Error ? error.message : "กรุณาตรวจสอบข้อมูลผู้ใช้",
        confirmButtonText: "ตกลง"
      });
    }
  }

  async function handleRemove(user: UserAccount) {
    if (session?.user.id === user.id) {
      await appSwal.fire({
        icon: "error",
        title: "ไม่สามารถลบบัญชีของตนเองได้",
        text: "กรุณาเข้าสู่ระบบด้วยผู้ดูแลระบบอีกบัญชีก่อนลบบัญชีนี้",
        confirmButtonText: "ตกลง"
      });
      return;
    }

    const result = await appSwal.fire({
      title: "ลบผู้ใช้?",
      text: user.email,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "ลบ",
      cancelButtonText: "ยกเลิก"
    });

    if (!result.isConfirmed) {
      return;
    }

    try {
      await deleteUserAccount(user.id, session?.user);
      await queryClient.invalidateQueries({ queryKey: ["cms-users"] });
      await appSwal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "ลบผู้ใช้แล้ว",
        showConfirmButton: false,
        timer: 1400,
        timerProgressBar: true
      });
    } catch (error) {
      await appSwal.fire({
        icon: "error",
        title: "ไม่สามารถลบผู้ใช้ได้",
        text: error instanceof Error ? error.message : "กรุณาลองอีกครั้ง",
        confirmButtonText: "ตกลง"
      });
    }
  }

  async function handleResetUsers() {
    const result = await appSwal.fire({
      title: "รีเซ็ตผู้ใช้?",
      text: "การดำเนินการนี้จะกู้คืนบัญชีผู้ใช้เริ่มต้นที่ตั้งค่าไว้",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "รีเซ็ต",
      cancelButtonText: "ยกเลิก"
    });

    if (!result.isConfirmed) {
      return;
    }

    await resetUserAccounts(session?.user);
    await queryClient.invalidateQueries({ queryKey: ["cms-users"] });
    await appSwal.fire({
      toast: true,
      position: "top-end",
      icon: "success",
      title: "รีเซ็ตผู้ใช้แล้ว",
      showConfirmButton: false,
      timer: 1400,
      timerProgressBar: true
    });
  }

  return (
    <>
      <Card>
        <CardContent>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={2}
            justifyContent="space-between"
            alignItems={{ xs: "stretch", md: "center" }}
            sx={{ mb: 2 }}
          >
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <ManageAccountsOutlinedIcon color="primary" />
              <Box>
                <Typography variant="h3">ผู้ใช้</Typography>
                <Typography color="text.secondary">
                  {isAdmin
                    ? "เพิ่ม แก้ไข ปิดใช้งาน และลบบัญชีผู้ใช้ CMS"
                    : "เฉพาะบัญชีผู้ดูแลระบบเท่านั้นที่จัดการผู้ใช้ CMS ได้"}
                </Typography>
              </Box>
            </Stack>
            {isAdmin && (
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <Button
                  variant="outlined"
                  color="inherit"
                  startIcon={<RestartAltOutlinedIcon />}
                  onClick={() => void handleResetUsers()}
                >
                  รีเซ็ตผู้ใช้
                </Button>
                <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreate}>
                  เพิ่มผู้ใช้
                </Button>
              </Stack>
            )}
          </Stack>
          {isAdmin ? (
            <Grid container spacing={1.5}>
              {usersQuery.isLoading && (
                <Grid size={{ xs: 12 }}>
                  <Typography color="text.secondary">กำลังโหลดรายชื่อผู้ใช้...</Typography>
                </Grid>
              )}
              {usersQuery.isError && (
                <Grid size={{ xs: 12 }}>
                  <Typography color="error">
                    {usersQuery.error instanceof Error ? usersQuery.error.message : "ไม่สามารถโหลดผู้ใช้ได้"}
                  </Typography>
                </Grid>
              )}
              {users.map((user) => (
                <Grid size={{ xs: 12, md: 6, xl: 4 }} key={user.id}>
                  <Box
                    sx={{
                      height: "100%",
                      p: 2,
                      borderRadius: 2,
                      border: "1px solid rgba(31, 90, 44, 0.12)",
                      bgcolor: user.status === "active" ? "background.paper" : "background.default"
                    }}
                  >
                    <Stack direction="row" spacing={1.5} alignItems="flex-start">
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography fontWeight={900} noWrap>
                          {user.name}
                        </Typography>
                        <Typography color="text.secondary" variant="body2" noWrap>
                          {user.email}
                        </Typography>
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1.2 }}>
                          <Chip label={userRoleLabels[user.role]} size="small" />
                          <Chip
                            label={userStatusLabels[user.status]}
                            size="small"
                            color={user.status === "active" ? "success" : "default"}
                            sx={{ textTransform: "capitalize" }}
                          />
                        </Stack>
                      </Box>
                      <Stack direction="row" spacing={0.5}>
                        <Tooltip title="แก้ไขผู้ใช้">
                          <IconButton aria-label="แก้ไขผู้ใช้" size="small" onClick={() => handleEdit(user)}>
                            <EditOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="ลบผู้ใช้">
                          <span>
                            <IconButton
                              aria-label="ลบผู้ใช้"
                              size="small"
                              color="error"
                              disabled={session?.user.id === user.id}
                              onClick={() => void handleRemove(user)}
                            >
                              <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Stack>
                    </Stack>
                  </Box>
                </Grid>
              ))}
            </Grid>
          ) : (
            <Box
              sx={{
                p: 2,
                borderRadius: 2,
                bgcolor: "background.default",
                border: "1px solid rgba(31, 90, 44, 0.12)"
              }}
            >
              <Typography fontWeight={800}>ต้องใช้สิทธิ์ผู้ดูแลระบบ</Typography>
              <Typography color="text.secondary" variant="body2" sx={{ mt: 0.5 }}>
                บทบาทปัจจุบันคือ {session?.user.role ? userRoleLabels[session.user.role] : "ไม่ทราบ"} การจัดการผู้ใช้จำกัดเฉพาะผู้ดูแลระบบ
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>
      <Dialog open={dialogOpen} onClose={handleClose} fullWidth maxWidth="sm">
        <DialogTitle>{isEditing ? "แก้ไขผู้ใช้" : "เพิ่มผู้ใช้"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.2} sx={{ pt: 1 }}>
            <TextField
              label="ชื่อ"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              fullWidth
              required
            />
            <TextField
              label="อีเมล"
              type="email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              fullWidth
              required
            />
            <Grid container spacing={1.5}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="บทบาท"
                  value={form.role}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, role: event.target.value as UserRole }))
                  }
                  select
                  fullWidth
                >
                  {roleOptions.map((role) => (
                    <MenuItem key={role} value={role} sx={{ textTransform: "capitalize" }}>
                      {userRoleLabels[role]}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="สถานะ"
                  value={form.status}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, status: event.target.value as UserStatus }))
                  }
                  select
                  fullWidth
                >
                  {statusOptions.map((status) => (
                    <MenuItem key={status} value={status} sx={{ textTransform: "capitalize" }}>
                      {userStatusLabels[status]}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
            </Grid>
            <TextField
              label={isEditing ? "รหัสผ่านใหม่" : "รหัสผ่าน"}
              type="password"
              value={form.password}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              helperText={isEditing ? "เว้นว่างเพื่อใช้รหัสผ่านเดิม" : "อย่างน้อย 6 ตัวอักษร"}
              fullWidth
              required={!isEditing}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button color="inherit" onClick={handleClose}>
            ยกเลิก
          </Button>
          <Button variant="contained" onClick={() => void handleSave()}>
            บันทึกผู้ใช้
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
