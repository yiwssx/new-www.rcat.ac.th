import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import AccessTimeOutlinedIcon from "@mui/icons-material/AccessTimeOutlined";
import KeyOutlinedIcon from "@mui/icons-material/KeyOutlined";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import PageHeader from "../components/PageHeader";
import UserManagementCard from "../components/UserManagementCard";
import { projectSettings } from "../config/projectSettings";
import {
  dateFormatPresets,
  defaultDisplaySettings,
  loadDisplaySettings,
  saveDisplaySettings
} from "../services/displaySettings";
import { DisplaySettings } from "../types";
import {
  formatDisplayDate,
  formatDisplayDateTime,
  formatDisplayTime
} from "../utils/dateDisplay";
import { appSwal } from "../utils/swal";

function normalizeDisplaySettings(input: Partial<DisplaySettings>): DisplaySettings {
  return {
    dateFormat: String(input.dateFormat || defaultDisplaySettings.dateFormat).trim() || defaultDisplaySettings.dateFormat,
    timeMode: input.timeMode === "12h" ? "12h" : "24h"
  };
}

export default function SettingsPage() {
  const rolePermissions = projectSettings.roles;
  const [displaySettings, setDisplaySettings] = useState<DisplaySettings>(defaultDisplaySettings);

  const displaySettingsQuery = useQuery({
    queryKey: ["display-settings"],
    queryFn: loadDisplaySettings
  });

  const saveDisplaySettingsMutation = useMutation({
    mutationFn: saveDisplaySettings
  });

  useEffect(() => {
    if (displaySettingsQuery.data) {
      setDisplaySettings(normalizeDisplaySettings(displaySettingsQuery.data));
    }
  }, [displaySettingsQuery.data]);

  const previewDate = useMemo(() => {
    const now = new Date();
    return {
      date: formatDisplayDate(now, displaySettings),
      time: formatDisplayTime(now, displaySettings),
      dateTime: formatDisplayDateTime(now, displaySettings)
    };
  }, [displaySettings]);

  async function handleSaveDisplaySettings() {
    try {
      const nextSettings = normalizeDisplaySettings(displaySettings);
      const saved = await saveDisplaySettingsMutation.mutateAsync(nextSettings);
      setDisplaySettings(normalizeDisplaySettings(saved));
      await appSwal.fire({
        icon: "success",
        title: "Display settings saved",
        text: "Date and time display is updated for this CMS.",
        confirmButtonText: "OK"
      });
    } catch (error) {
      await appSwal.fire({
        icon: "error",
        title: "Unable to save display settings",
        text: error instanceof Error ? error.message : "Please try again.",
        confirmButtonText: "OK"
      });
    }
  }

  return (
    <Box>
      <PageHeader
        title="Settings"
        description="Publishing access, user controls, and display preferences."
      />
      <Grid container spacing={2.5}>
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
                <AccessTimeOutlinedIcon color="primary" />
                <Typography variant="h3">Date and Time Display</Typography>
              </Stack>
              <Typography color="text.secondary" sx={{ mb: 2 }}>
                Use WordPress-style date formats and choose 24-hour or 12-hour time display.
              </Typography>
              <Grid container spacing={1.5}>
                <Grid item xs={12} md={5}>
                  <FormControl fullWidth size="small">
                    <InputLabel id="date-format-preset-label">Date format preset</InputLabel>
                    <Select
                      labelId="date-format-preset-label"
                      label="Date format preset"
                      value={
                        dateFormatPresets.some((item) => item.value === displaySettings.dateFormat)
                          ? displaySettings.dateFormat
                          : "__custom__"
                      }
                      onChange={(event) => {
                        const value = event.target.value;
                        if (value === "__custom__") {
                          return;
                        }

                        setDisplaySettings((current) => ({
                          ...current,
                          dateFormat: value
                        }));
                      }}
                    >
                      {dateFormatPresets.map((preset) => (
                        <MenuItem key={preset.value} value={preset.value}>
                          {preset.label}
                        </MenuItem>
                      ))}
                      <MenuItem value="__custom__">Custom format</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={4}>
                  <FormControl fullWidth size="small">
                    <InputLabel id="time-mode-label">Time mode</InputLabel>
                    <Select
                      labelId="time-mode-label"
                      label="Time mode"
                      value={displaySettings.timeMode}
                      onChange={(event) =>
                        setDisplaySettings((current) => ({
                          ...current,
                          timeMode: event.target.value === "12h" ? "12h" : "24h"
                        }))
                      }
                    >
                      <MenuItem value="24h">24-hour (14:30)</MenuItem>
                      <MenuItem value="12h">12-hour (2:30 pm)</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Button
                    fullWidth
                    variant="contained"
                    startIcon={<SaveOutlinedIcon />}
                    disabled={saveDisplaySettingsMutation.isPending}
                    onClick={() => void handleSaveDisplaySettings()}
                    sx={{ height: "100%" }}
                  >
                    {saveDisplaySettingsMutation.isPending ? "Processing" : "Save"}
                  </Button>
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Custom date format"
                    value={displaySettings.dateFormat}
                    onChange={(event) =>
                      setDisplaySettings((current) => ({
                        ...current,
                        dateFormat: event.target.value
                      }))
                    }
                    helperText="Examples: F j, Y | j F Y | Y-m-d | m/d/Y | d/m/Y"
                    size="small"
                    fullWidth
                  />
                </Grid>
              </Grid>
              <Card
                variant="outlined"
                sx={{
                  mt: 2,
                  borderColor: "rgba(31, 90, 44, 0.18)",
                  bgcolor: "background.default"
                }}
              >
                <CardContent>
                  <Typography variant="subtitle2" sx={{ fontWeight: 900, mb: 1 }}>
                    Preview
                  </Typography>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                    <Typography color="text.secondary">Date: {previewDate.date}</Typography>
                    <Typography color="text.secondary">Time: {previewDate.time}</Typography>
                    <Typography color="text.secondary">Date and time: {previewDate.dateTime}</Typography>
                  </Stack>
                  {displaySettingsQuery.isError && (
                    <Typography color="error" variant="body2" sx={{ mt: 1.2 }}>
                      {displaySettingsQuery.error instanceof Error
                        ? displaySettingsQuery.error.message
                        : "Unable to load saved display settings."}
                    </Typography>
                  )}
                </CardContent>
              </Card>
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
                  <Typography fontWeight={900}>Session time</Typography>
                  <Typography color="text.secondary">
                    Signed-in sessions expire automatically based on system settings.
                  </Typography>
                </Box>
                <Box>
                  <Typography fontWeight={900}>Password protection</Typography>
                  <Typography color="text.secondary">
                    Passwords are stored as secure hashes in the Users sheet.
                  </Typography>
                </Box>
                <Box>
                  <Typography fontWeight={900}>Deploy setup</Typography>
                  <Typography color="text.secondary">
                    Routing rewrites are ready for deployment through vercel.json.
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
