import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Grid,
  InputAdornment,
  Stack,
  Table as MuiTable,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography
} from "@mui/material";
import KeyOutlinedIcon from "@mui/icons-material/KeyOutlined";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import PageHeader from "../components/PageHeader";
import UserManagementCard from "../components/UserManagementCard";
import { projectSettings } from "../config/projectSettings";
import { defaultPublicLanguageSource } from "./PublicHomePage";
import {
  getPublicLanguageRows,
  loadPublicLanguageSource,
  savePublicLanguageRows,
  savePublicLanguageSource
} from "../services/languageSource";
import { LanguageSourceItem } from "../types";
import { appSwal } from "../utils/swal";

function sortLanguageRows(rows: LanguageSourceItem[]) {
  return [...rows].sort((left, right) => left.key.localeCompare(right.key));
}

export default function SettingsPage() {
  const rolePermissions = projectSettings.roles;
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [languageRows, setLanguageRows] = useState<LanguageSourceItem[]>([]);

  const languageQuery = useQuery({
    queryKey: ["public-language-source"],
    queryFn: async () => {
      await loadPublicLanguageSource(defaultPublicLanguageSource);
      return sortLanguageRows(getPublicLanguageRows(defaultPublicLanguageSource));
    }
  });

  const saveLanguageMutation = useMutation({
    mutationFn: savePublicLanguageRows,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["public-language-source"] });
    }
  });

  useEffect(() => {
    if (languageQuery.data) {
      setLanguageRows(languageQuery.data);
    }
  }, [languageQuery.data]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return languageRows;
    }

    return languageRows.filter(
      (row) =>
        row.key.toLowerCase().includes(query) ||
        row.th.toLowerCase().includes(query) ||
        row.en.toLowerCase().includes(query)
    );
  }, [languageRows, search]);

  function updateLanguageRow(rowKey: string, field: "th" | "en", value: string) {
    setLanguageRows((current) =>
      current.map((row) => (row.key === rowKey ? { ...row, [field]: value } : row))
    );
  }

  async function handleSaveLanguageSource() {
    try {
      await saveLanguageMutation.mutateAsync(sortLanguageRows(languageRows));
      await appSwal.fire({
        icon: "success",
        title: "Language table saved",
        text: "TH/EN compare table is now synced to Apps Script sheet.",
        confirmButtonText: "OK"
      });
    } catch (error) {
      await appSwal.fire({
        icon: "error",
        title: "Unable to save language table",
        text: error instanceof Error ? error.message : "Please try again.",
        confirmButtonText: "OK"
      });
    }
  }

  async function handleResetLanguageSource() {
    const result = await appSwal.fire({
      title: "Reset language source?",
      text: "This will restore the default TH/EN source and overwrite sheet rows.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Reset",
      cancelButtonText: "Cancel"
    });

    if (!result.isConfirmed) {
      return;
    }

    await savePublicLanguageSource(defaultPublicLanguageSource);
    await queryClient.invalidateQueries({ queryKey: ["public-language-source"] });
    await appSwal.fire({
      toast: true,
      position: "top-end",
      icon: "success",
      title: "Language source reset",
      showConfirmButton: false,
      timer: 1400,
      timerProgressBar: true
    });
  }

  return (
    <Box>
      <PageHeader
        title="Settings"
        description="Role permissions, publishing access, and security defaults for the CMS."
      />
      <Grid container spacing={2.5}>
        <Grid item xs={12}>
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
                  <Typography variant="h3">TH/EN Language Compare Table</Typography>
                  <Typography color="text.secondary">
                    Manage public website copy in a side-by-side TH/EN table backed by Google Sheet.
                  </Typography>
                </Box>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                  <Button variant="outlined" color="inherit" onClick={() => void handleResetLanguageSource()}>
                    Reset defaults
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<SaveOutlinedIcon />}
                    disabled={saveLanguageMutation.isPending}
                    onClick={() => void handleSaveLanguageSource()}
                  >
                    {saveLanguageMutation.isPending ? "Saving" : "Save table"}
                  </Button>
                </Stack>
              </Stack>
              <TextField
                placeholder="Search language key or value"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchOutlinedIcon />
                    </InputAdornment>
                  )
                }}
                sx={{ mb: 2, maxWidth: 520 }}
                fullWidth
              />
              <Box className="table-scroll">
                <MuiTable size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 800, width: "22%" }}>Key</TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>TH</TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>EN</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {languageQuery.isLoading && (
                      <TableRow>
                        <TableCell colSpan={3}>
                          <Typography color="text.secondary">Loading language rows...</Typography>
                        </TableCell>
                      </TableRow>
                    )}
                    {languageQuery.isError && (
                      <TableRow>
                        <TableCell colSpan={3}>
                          <Typography color="error">
                            {languageQuery.error instanceof Error
                              ? languageQuery.error.message
                              : "Unable to load language rows."}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                    {!languageQuery.isLoading &&
                      !languageQuery.isError &&
                      filteredRows.map((row) => (
                        <TableRow key={row.key} hover>
                          <TableCell
                            sx={{
                              verticalAlign: "top",
                              fontFamily: "\"Cascadia Code\", Consolas, monospace",
                              fontSize: "0.78rem"
                            }}
                          >
                            {row.key}
                          </TableCell>
                          <TableCell sx={{ verticalAlign: "top", minWidth: 280 }}>
                            <TextField
                              value={row.th}
                              onChange={(event) => updateLanguageRow(row.key, "th", event.target.value)}
                              minRows={1}
                              multiline
                              fullWidth
                            />
                          </TableCell>
                          <TableCell sx={{ verticalAlign: "top", minWidth: 280 }}>
                            <TextField
                              value={row.en}
                              onChange={(event) => updateLanguageRow(row.key, "en", event.target.value)}
                              minRows={1}
                              multiline
                              fullWidth
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    {!languageQuery.isLoading && !languageQuery.isError && !filteredRows.length && (
                      <TableRow>
                        <TableCell colSpan={3}>
                          <Typography color="text.secondary">No language rows match your search.</Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </MuiTable>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12}>
          <UserManagementCard />
        </Grid>
        <Grid item xs={12} lg={7}>
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
                <ShieldOutlinedIcon color="primary" />
                <Typography variant="h3">Roles</Typography>
              </Stack>
              <Stack spacing={1.5}>
                {rolePermissions.map((role) => (
                  <Stack
                    key={role.id}
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1.5}
                    justifyContent="space-between"
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      border: "1px solid rgba(31, 90, 44, 0.12)"
                    }}
                  >
                    <Box>
                      <Typography fontWeight={900}>{role.role}</Typography>
                      <Typography color="text.secondary" variant="body2">
                        {role.scope}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={2}>
                      <Stack direction="row" alignItems="center">
                        <Checkbox checked={role.canPublish} readOnly />
                        <Typography variant="body2">Publish</Typography>
                      </Stack>
                      <Stack direction="row" alignItems="center">
                        <Checkbox checked={role.canManageUsers} readOnly />
                        <Typography variant="body2">Users</Typography>
                      </Stack>
                    </Stack>
                  </Stack>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} lg={5}>
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
                <KeyOutlinedIcon color="secondary" />
                <Typography variant="h3">Security</Typography>
              </Stack>
              <Stack spacing={2}>
                <Box>
                  <Typography fontWeight={900}>JWT session window</Typography>
                  <Typography color="text.secondary">
                    Tokens expire after 8 hours in the template auth adapter.
                  </Typography>
                </Box>
                <Box>
                  <Typography fontWeight={900}>Password hashing</Typography>
                  <Typography color="text.secondary">
                    Passwords are verified with bcrypt hash values stored in the Users sheet.
                  </Typography>
                </Box>
                <Box>
                  <Typography fontWeight={900}>Deployment</Typography>
                  <Typography color="text.secondary">
                    SPA rewrites are ready for Vercel through vercel.json.
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
