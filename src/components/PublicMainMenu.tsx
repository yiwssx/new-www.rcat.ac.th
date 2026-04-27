import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Box, Container } from "@mui/material";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import KeyboardArrowRightRoundedIcon from "@mui/icons-material/KeyboardArrowRightRounded";
import { useLanguage } from "../context/LanguageContext";
import { getCmsSnapshot } from "../services/googleApi";
import { PublicMenuItem } from "../types";

function getEnabledMenuItems(items: PublicMenuItem[]): PublicMenuItem[] {
  return items
    .filter((item) => item.enabled)
    .map((item) => ({
      ...item,
      children: item.children ? getEnabledMenuItems(item.children) : undefined
    }));
}

function PublicMenuList({
  items,
  language,
  nested = false
}: {
  items: PublicMenuItem[];
  language: "th" | "en";
  nested?: boolean;
}) {
  return (
    <Box
      component="ul"
      className={nested ? "public-menu-list nested" : "public-menu-list"}
      sx={{
        m: 0,
        p: 0,
        listStyle: "none",
        display: nested ? "block" : "flex",
        flexWrap: nested ? "nowrap" : "wrap"
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
            href={item.href}
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
            <span>{item.label[language]}</span>
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
              <PublicMenuList items={item.children ?? []} language={language} nested />
            </Box>
          )}
        </Box>
      ))}
    </Box>
  );
}

export default function PublicMainMenu() {
  const { language } = useLanguage();
  const { data } = useQuery({
    queryKey: ["cms-snapshot"],
    queryFn: getCmsSnapshot
  });
  const enabledItems = useMemo(() => getEnabledMenuItems(data?.menu ?? []), [data]);

  return (
    <Box
      component="nav"
      aria-label={language === "th" ? "เมนูหลัก" : "Main menu"}
      sx={{
        bgcolor: "primary.main",
        color: "white",
        boxShadow: "0 10px 20px rgba(0, 0, 0, 0.08)"
      }}
    >
      <Container maxWidth="xl">
        <PublicMenuList items={enabledItems} language={language} />
      </Container>
    </Box>
  );
}
