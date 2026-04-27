import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  Grid,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography
} from "@mui/material";
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
        title: "Missing user details",
        text: "Name and email are required.",
        confirmButtonText: "OK"
      });
      return;
    }

    if (!isEditing && form.password.length < 6) {
      await appSwal.fire({
        icon: "error",
        title: "Password required",
        text: "New users need a password with at least 6 characters.",
        confirmButtonText: "OK"
      });
      return;
    }

    if (isEditing && form.password && form.password.length < 6) {
      await appSwal.fire({
        icon: "error",
        title: "Password too short",
        text: "Use at least 6 characters, or leave the password blank.",
        confirmButtonText: "OK"
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
        title: isEditing ? "User updated" : "User added",
        showConfirmButton: false,
        timer: 1400,
        timerProgressBar: true
      });
    } catch (error) {
      await appSwal.fire({
        icon: "error",
        title: "Unable to save user",
        text: error instanceof Error ? error.message : "Please check the user details.",
        confirmButtonText: "OK"
      });
    }
  }

  async function handleRemove(user: UserAccount) {
    if (session?.user.id === user.id) {
      await appSwal.fire({
        icon: "error",
        title: "Cannot remove yourself",
        text: "Sign in as another administrator before removing this account.",
        confirmButtonText: "OK"
      });
      return;
    }

    const result = await appSwal.fire({
      title: "Remove user?",
      text: user.email,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Remove",
      cancelButtonText: "Cancel"
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
        title: "User removed",
        showConfirmButton: false,
        timer: 1400,
        timerProgressBar: true
      });
    } catch (error) {
      await appSwal.fire({
        icon: "error",
        title: "Unable to remove user",
        text: error instanceof Error ? error.message : "Please try again.",
        confirmButtonText: "OK"
      });
    }
  }

  async function handleResetUsers() {
    const result = await appSwal.fire({
      title: "Reset users?",
      text: "This restores the configured bootstrap user accounts.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Reset",
      cancelButtonText: "Cancel"
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
      title: "Users reset",
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
                <Typography variant="h3">Users</Typography>
                <Typography color="text.secondary">
                  {isAdmin
                    ? "Add, edit, disable, and remove CMS user accounts."
                    : "Only administrator accounts can manage CMS users."}
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
                  Reset users
                </Button>
                <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreate}>
                  Add user
                </Button>
              </Stack>
            )}
          </Stack>
          {isAdmin ? (
            <Grid container spacing={1.5}>
              {usersQuery.isLoading && (
                <Grid item xs={12}>
                  <Typography color="text.secondary">Loading users from backend...</Typography>
                </Grid>
              )}
              {usersQuery.isError && (
                <Grid item xs={12}>
                  <Typography color="error">
                    {usersQuery.error instanceof Error ? usersQuery.error.message : "Unable to load users."}
                  </Typography>
                </Grid>
              )}
              {users.map((user) => (
                <Grid item xs={12} md={6} xl={4} key={user.id}>
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
                          <Chip label={user.role} size="small" sx={{ textTransform: "capitalize" }} />
                          <Chip
                            label={user.status}
                            size="small"
                            color={user.status === "active" ? "success" : "default"}
                            sx={{ textTransform: "capitalize" }}
                          />
                        </Stack>
                      </Box>
                      <Stack direction="row" spacing={0.5}>
                        <Tooltip title="Edit user">
                          <IconButton aria-label="Edit user" size="small" onClick={() => handleEdit(user)}>
                            <EditOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Remove user">
                          <span>
                            <IconButton
                              aria-label="Remove user"
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
              <Typography fontWeight={800}>Admin access required</Typography>
              <Typography color="text.secondary" variant="body2" sx={{ mt: 0.5 }}>
                Your current role is {session?.user.role ?? "unknown"}. User management is restricted to admins.
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>
      <Dialog open={dialogOpen} onClose={handleClose} fullWidth maxWidth="sm">
        <DialogTitle>{isEditing ? "Edit user" : "Add user"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.2} sx={{ pt: 1 }}>
            <TextField
              label="Name"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              fullWidth
              required
            />
            <TextField
              label="Email"
              type="email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              fullWidth
              required
            />
            <Grid container spacing={1.5}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Role"
                  value={form.role}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, role: event.target.value as UserRole }))
                  }
                  select
                  fullWidth
                >
                  {roleOptions.map((role) => (
                    <MenuItem key={role} value={role} sx={{ textTransform: "capitalize" }}>
                      {role}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Status"
                  value={form.status}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, status: event.target.value as UserStatus }))
                  }
                  select
                  fullWidth
                >
                  {statusOptions.map((status) => (
                    <MenuItem key={status} value={status} sx={{ textTransform: "capitalize" }}>
                      {status}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
            </Grid>
            <TextField
              label={isEditing ? "New password" : "Password"}
              type="password"
              value={form.password}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              helperText={isEditing ? "Leave blank to keep the current password." : "Minimum 6 characters."}
              fullWidth
              required={!isEditing}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button color="inherit" onClick={handleClose}>
            Cancel
          </Button>
          <Button variant="contained" onClick={() => void handleSave()}>
            Save user
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
