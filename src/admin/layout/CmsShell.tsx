import { ReactNode, useState } from "react";
import { Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  AppBar,
  Avatar,
  Box,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme
} from "@mui/material";
import ArticleOutlinedIcon from "@mui/icons-material/ArticleOutlined";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import CloudSyncOutlinedIcon from "@mui/icons-material/CloudSyncOutlined";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import EventAvailableOutlinedIcon from "@mui/icons-material/EventAvailableOutlined";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import MenuIcon from "@mui/icons-material/Menu";
import PermMediaOutlinedIcon from "@mui/icons-material/PermMediaOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import ViewCarouselOutlinedIcon from "@mui/icons-material/ViewCarouselOutlined";
import { getCmsSiteName, projectSettings } from "../../config/projectSettings";
import { useAuth } from "../../context/authSessionContext";
import { appSwal } from "../../utils/swal";

const drawerWidth = 280;

interface NavItem {
  label: string;
  to:
    | "/admin"
    | "/admin/carousel"
    | "/admin/content"
    | "/admin/media"
    | "/admin/calendar"
    | "/admin/menus"
    | "/admin/integrations"
    | "/admin/settings";
  icon: ReactNode;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  {
    label: "แดชบอร์ด",
    to: "/admin",
    icon: <DashboardOutlinedIcon />
  },
  {
    label: "เนื้อหา",
    to: "/admin/content",
    icon: <ArticleOutlinedIcon />
  },
  {
    label: "สไลด์หน้าแรก",
    to: "/admin/carousel",
    icon: <ViewCarouselOutlinedIcon />
  },
  {
    label: "สื่อ",
    to: "/admin/media",
    icon: <PermMediaOutlinedIcon />
  },
  {
    label: "ปฏิทิน",
    to: "/admin/calendar",
    icon: <EventAvailableOutlinedIcon />
  },
  {
    label: "เมนู",
    to: "/admin/menus",
    icon: <AccountTreeOutlinedIcon />,
    adminOnly: true
  },
  {
    label: "Google APIs",
    to: "/admin/integrations",
    icon: <CloudSyncOutlinedIcon />,
    adminOnly: true
  },
  {
    label: "ตั้งค่า",
    to: "/admin/settings",
    icon: <SettingsOutlinedIcon />,
    adminOnly: true
  }
];

export default function CmsShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("lg"));
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { session, logout } = useAuth();
  const visibleNavItems = navItems.filter((item) => !item.adminOnly || session?.user.role === "admin");

  function handleNavigate(to: NavItem["to"]) {
    void navigate({ to });
    setMobileOpen(false);
  }

  async function handleLogout() {
    const result = await appSwal.fire({
      title: "ออกจากระบบ?",
      text: "ต้องการออกจากระบบ CMS หรือไม่",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "ออกจากระบบ",
      cancelButtonText: "ยกเลิก"
    });

    if (!result.isConfirmed) {
      return;
    }

    logout();
    void navigate({ to: "/login", replace: true });
  }

  const drawer = (
    <Stack sx={{ height: "100%" }}>
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ p: 2.5 }}>
        <Box
          component="img"
          src={projectSettings.site.logoPath}
          alt={projectSettings.site.logoAlt}
          sx={{ width: 46, height: 46, flex: "0 0 auto", objectFit: "contain" }}
        />
        <Box>
          <Typography variant="h3" sx={{ fontSize: "1.05rem" }}>
            {getCmsSiteName()}
          </Typography>
          <Typography color="text.secondary" variant="body2">
            {"ระบบบริหารจัดการเนื้อหา"}
          </Typography>
        </Box>
      </Stack>
      <Divider />
      <List sx={{ px: 1.5, py: 2 }}>
        {visibleNavItems.map((item) => {
          const selected = item.to === "/admin" ? pathname === item.to : pathname.startsWith(item.to);

          return (
            <ListItemButton
              key={item.to}
              selected={selected}
              onClick={() => handleNavigate(item.to)}
              sx={{
                minHeight: 48,
                mb: 0.5,
                borderRadius: 2,
                "&.Mui-selected": {
                  color: "primary.main",
                  backgroundColor: "primary.light"
                }
              }}
            >
              <ListItemIcon sx={{ color: "inherit", minWidth: 40 }}>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          );
        })}
      </List>
      <Box sx={{ flex: 1 }} />
      <Divider />
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ p: 2 }}>
        <Avatar sx={{ bgcolor: "secondary.main", color: "secondary.contrastText" }}>
          {session?.user.name.slice(0, 1) ?? "A"}
        </Avatar>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="subtitle2" noWrap>
            {session?.user.name}
          </Typography>
          <Typography color="text.secondary" variant="body2" noWrap>
            {session?.user.email}
          </Typography>
        </Box>
        <Tooltip title="ออกจากระบบ">
          <IconButton aria-label="ออกจากระบบ" onClick={() => void handleLogout()}>
            <LogoutOutlinedIcon />
          </IconButton>
        </Tooltip>
      </Stack>
    </Stack>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }} className="cms-shell-main">
      <AppBar
        position="fixed"
        color="inherit"
        elevation={0}
        sx={{
          width: { lg: `calc(100% - ${drawerWidth}px)` },
          ml: { lg: `${drawerWidth}px` },
          borderBottom: "1px solid rgba(31, 90, 44, 0.12)"
        }}
      >
        <Toolbar>
          {!isDesktop && (
            <IconButton aria-label="เปิดเมนูนำทาง" edge="start" onClick={() => setMobileOpen(true)} sx={{ mr: 1 }}>
              <MenuIcon />
            </IconButton>
          )}
          <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
            {"ระบบจัดการเว็บไซต์"}
          </Typography>
          <Box sx={{ flex: 1 }} />
        </Toolbar>
      </AppBar>
      <Box component="nav" sx={{ width: { lg: drawerWidth }, flexShrink: { lg: 0 } }}>
        <Drawer
          variant={isDesktop ? "permanent" : "temporary"}
          open={isDesktop || mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            "& .MuiDrawer-paper": {
              width: drawerWidth,
              borderRight: "1px solid rgba(31, 90, 44, 0.12)"
            }
          }}
        >
          {drawer}
        </Drawer>
      </Box>
      <Box
        component="main"
        className="mx-auto w-full max-w-[1600px]"
        sx={{
          flexGrow: 1,
          width: { lg: `calc(100% - ${drawerWidth}px)` },
          minHeight: "100vh",
          pt: 11,
          px: { xs: 2, sm: 3, lg: 4 },
          pb: 5
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
}
