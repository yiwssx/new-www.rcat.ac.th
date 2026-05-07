import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Container,
  IconButton,
  Drawer,
  List,
  ListItemButton,
  ListItemText,
  Collapse,
  Stack,
  Typography,
  Divider,
  useMediaQuery
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import ExpandLessRoundedIcon from "@mui/icons-material/ExpandLessRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import KeyboardArrowRightRoundedIcon from "@mui/icons-material/KeyboardArrowRightRounded";
import { usePublicCmsSnapshot } from "../hooks/usePublicCmsSnapshot";
import { PublicMenuItem } from "../../types";
import { normalizeSafeHref } from "../../utils/safeUrl";

function getEnabledMenuItems(items: PublicMenuItem[]): PublicMenuItem[] {
  return items
    .filter((item) => item.enabled)
    .map((item) => ({
      ...item,
      children: item.children ? getEnabledMenuItems(item.children) : undefined
    }));
}

function PublicMenuList({ items, nested = false }: { items: PublicMenuItem[]; nested?: boolean }) {
  return (
    <Box
      component="ul"
      className={nested ? "public-menu-list nested" : "public-menu-list"}
      sx={{
        m: 0,
        p: 0,
        listStyle: "none",
        display: nested ? "block" : "flex",
        flexWrap: "nowrap"
      }}
    >
      {items.map((item) => (
        <Box
          component="li"
          key={item.id}
          className="public-menu-item"
          sx={{
            position: "relative",
            "&:hover > .public-submenu, &:focus-within > .public-submenu": {
              opacity: 1,
              visibility: "visible",
              transform: nested ? "translateX(0)" : "translateY(0)",
              pointerEvents: "auto"
            }
          }}
        >
          <Box
            component="a"
            href={normalizeSafeHref(item.href)}
            sx={{
              minHeight: nested ? 42 : 48,
              px: nested ? 1.5 : 2,
              py: nested ? 1 : 1.15,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 0.8,
              color: nested ? "text.primary" : "white",
              fontWeight: 800,
              whiteSpace: "nowrap",
              borderLeft: nested ? "3px solid transparent" : "none",
              "&:hover, &:focus": {
                bgcolor: nested ? "primary.light" : "rgba(255, 255, 255, 0.14)",
                borderColor: nested ? "secondary.main" : "transparent",
                outline: "none"
              }
            }}
          >
            <span>{item.label}</span>
            {item.children?.length &&
              (nested ? (
                <KeyboardArrowRightRoundedIcon sx={{ fontSize: 18 }} />
              ) : (
                <KeyboardArrowDownRoundedIcon sx={{ fontSize: 18 }} />
              ))}
          </Box>
          {Boolean(item.children?.length) && (
            <Box
              className="public-submenu"
              sx={{
                position: "absolute",
                top: nested ? 0 : "100%",
                left: nested ? "100%" : 0,
                zIndex: 20,
                minWidth: nested ? 300 : 310,
                maxWidth: nested ? 380 : 420,
                bgcolor: "background.paper",
                border: "1px solid rgba(31, 90, 44, 0.14)",
                borderTop: nested ? "1px solid rgba(31, 90, 44, 0.14)" : "3px solid",
                borderTopColor: nested ? "rgba(31, 90, 44, 0.14)" : "secondary.main",
                boxShadow: "0 16px 34px rgba(31, 90, 44, 0.16)",
                opacity: 0,
                visibility: "hidden",
                transform: nested ? "translateX(-6px)" : "translateY(8px)",
                transition: "opacity 140ms ease, transform 140ms ease, visibility 140ms ease",
                pointerEvents: "none"
              }}
            >
              <PublicMenuList items={item.children ?? []} nested />
            </Box>
          )}
        </Box>
      ))}
    </Box>
  );
}

function PublicTopLevelMenuMeasurement({ items }: { items: PublicMenuItem[] }) {
  return (
    <Box
      component="ul"
      sx={{
        m: 0,
        p: 0,
        listStyle: "none",
        display: "flex",
        flexWrap: "nowrap"
      }}
    >
      {items.map((item) => (
        <Box component="li" key={item.id} sx={{ position: "relative" }}>
          <Box
            component="span"
            sx={{
              minHeight: 48,
              px: 2,
              py: 1.15,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 0.8,
              color: "white",
              fontWeight: 800,
              whiteSpace: "nowrap"
            }}
          >
            <span>{item.label}</span>
            {item.children?.length ? <KeyboardArrowDownRoundedIcon sx={{ fontSize: 18 }} /> : null}
          </Box>
        </Box>
      ))}
    </Box>
  );
}

export default function PublicMainMenu() {
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const { data } = usePublicCmsSnapshot();
  const enabledItems = useMemo(() => getEnabledMenuItems(data?.menu ?? []), [data]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileOpenItems, setMobileOpenItems] = useState<Record<string, boolean>>({});
  const [isMenuOverflowing, setIsMenuOverflowing] = useState(false);
  const menuContainerRef = useRef<HTMLDivElement | null>(null);
  const menuMeasurementRef = useRef<HTMLDivElement | null>(null);
  const shouldUseCompactMenu = isSmallScreen || isMenuOverflowing;

  const updateMenuMode = useCallback(() => {
    const container = menuContainerRef.current;
    const content = menuMeasurementRef.current;

    if (!container || !content) {
      return;
    }

    setIsMenuOverflowing(content.scrollWidth > container.clientWidth - 8);
  }, []);

  useEffect(() => {
    updateMenuMode();

    const container = menuContainerRef.current;
    const content = menuMeasurementRef.current;

    if (!container || !content) {
      return undefined;
    }

    if (typeof ResizeObserver !== "undefined") {
      const resizeObserver = new ResizeObserver(updateMenuMode);
      resizeObserver.observe(container);
      resizeObserver.observe(content);

      return () => resizeObserver.disconnect();
    }

    window.addEventListener("resize", updateMenuMode);

    return () => window.removeEventListener("resize", updateMenuMode);
  }, [enabledItems, updateMenuMode]);

  useEffect(() => {
    if (!shouldUseCompactMenu && mobileMenuOpen) {
      const closeTimer = window.setTimeout(() => {
        setMobileMenuOpen(false);
        setMobileOpenItems({});
      }, 0);

      return () => window.clearTimeout(closeTimer);
    }

    return undefined;
  }, [mobileMenuOpen, shouldUseCompactMenu]);

  const toggleMobileItem = (itemId: string) => {
    setMobileOpenItems((prev) => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
    setMobileOpenItems({});
  };

  const handleMobileNavigate = () => {
    closeMobileMenu();
  };

  return (
    <Box
      component="nav"
      aria-label="เมนูหลัก"
      sx={{
        bgcolor: "primary.main",
        color: "white",
        boxShadow: "0 10px 20px rgba(0, 0, 0, 0.08)"
      }}
    >
      <Container ref={menuContainerRef} maxWidth="xl" sx={{ position: "relative", minWidth: 0, py: 0 }}>
        <Box
          sx={{
            position: "absolute",
            visibility: "hidden",
            pointerEvents: "none",
            height: 0,
            overflow: "hidden",
            width: "100%"
          }}
        >
          <Box ref={menuMeasurementRef} sx={{ display: "inline-flex", width: "max-content" }}>
            <PublicTopLevelMenuMeasurement items={enabledItems} />
          </Box>
        </Box>

        {!shouldUseCompactMenu && (
          <Box sx={{ display: "flex", overflow: "hidden", minWidth: 0, width: "100%" }}>
            <PublicMenuList items={enabledItems} />
          </Box>
        )}

        {shouldUseCompactMenu && (
          <Box
            sx={{
              display: "flex",
              width: "100%",
              alignItems: "center",
              justifyContent: "flex-start",
              minHeight: 48,
              gap: 1
            }}
          >
            <IconButton
              aria-label={mobileMenuOpen ? "ปิดเมนูหลัก" : "เปิดเมนูหลัก"}
              onClick={() => setMobileMenuOpen((open) => !open)}
              sx={{ border: "1px solid rgba(255, 255, 255, 0.28)", color: "inherit" }}
            >
              {mobileMenuOpen ? <CloseRoundedIcon /> : <MenuRoundedIcon />}
            </IconButton>
            <Typography fontWeight={900}>เมนูหลัก</Typography>
          </Box>
        )}
      </Container>

      <Drawer
        anchor="left"
        open={mobileMenuOpen}
        onClose={closeMobileMenu}
        ModalProps={{ keepMounted: true }}
        PaperProps={{
          sx: {
            width: { xs: "84vw", sm: 360 },
            maxWidth: 360
          }
        }}
      >
        <Stack spacing={0} sx={{ height: "100%" }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 2, py: 1.5 }}>
            <Typography variant="subtitle1" fontWeight={700}>
              เมนูหลัก
            </Typography>
            <IconButton aria-label="ปิดเมนูหลัก" onClick={closeMobileMenu}>
              <CloseRoundedIcon />
            </IconButton>
          </Box>
          <Divider />
          <Box sx={{ flex: 1, overflowY: "auto" }}>
            {enabledItems.length ? (
              <MobileMenuList
                items={enabledItems}
                level={0}
                onNavigate={handleMobileNavigate}
                openItems={mobileOpenItems}
                toggleOpen={toggleMobileItem}
              />
            ) : (
              <Typography sx={{ px: 2, py: 2 }} color="text.secondary">
                ยังไม่มีรายการเมนู
              </Typography>
            )}
          </Box>
        </Stack>
      </Drawer>
    </Box>
  );
}
function MobileMenuList({
  items,
  level,
  onNavigate,
  openItems,
  toggleOpen
}: {
  items: PublicMenuItem[];
  level: number;
  onNavigate: () => void;
  openItems: Record<string, boolean>;
  toggleOpen: (itemId: string) => void;
}) {
  return (
    <List disablePadding>
      {items.map((item) => {
        const hasChildren = Boolean(item.children?.length);
        const isOpen = Boolean(openItems[item.id]);

        return (
          <Box key={item.id}>
            <ListItemButton
              component={hasChildren ? "div" : "a"}
              href={hasChildren ? undefined : normalizeSafeHref(item.href)}
              onClick={() => {
                if (hasChildren) {
                  toggleOpen(item.id);
                } else {
                  onNavigate();
                }
              }}
              sx={{
                pl: 2 + level * 2,
                pr: 2,
                py: 1.25,
                borderBottom: "1px solid",
                borderColor: "divider",
                color: "text.primary",
                justifyContent: "space-between"
              }}
              aria-expanded={hasChildren ? isOpen : undefined}
              aria-controls={hasChildren ? `${item.id}-mobile-submenu` : undefined}
            >
              <ListItemText
                primary={item.label}
                primaryTypographyProps={{
                  fontWeight: 700,
                  fontSize: level ? { xs: "0.88rem", md: "0.92rem" } : { xs: "0.95rem", md: "0.98rem" },
                  color: level ? "text.secondary" : "text.primary",
                  whiteSpace: "normal"
                }}
              />
              {hasChildren && (isOpen ? <ExpandLessRoundedIcon /> : <ExpandMoreRoundedIcon />)}
            </ListItemButton>

            {hasChildren && (
              <Collapse in={isOpen} timeout="auto" unmountOnExit>
                <MobileMenuList
                  items={item.children ?? []}
                  level={level + 1}
                  onNavigate={onNavigate}
                  openItems={openItems}
                  toggleOpen={toggleOpen}
                />
              </Collapse>
            )}
          </Box>
        );
      })}
    </List>
  );
}
