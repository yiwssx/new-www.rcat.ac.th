import type { SvgIconProps } from "@mui/material/SvgIcon";
import AppsOutlinedIcon from "@mui/icons-material/AppsOutlined";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import HandshakeOutlinedIcon from "@mui/icons-material/HandshakeOutlined";
import HowToRegOutlinedIcon from "@mui/icons-material/HowToRegOutlined";
import LinkOutlinedIcon from "@mui/icons-material/LinkOutlined";
import MenuBookOutlinedIcon from "@mui/icons-material/MenuBookOutlined";
import SchoolOutlinedIcon from "@mui/icons-material/SchoolOutlined";
import type { ExternalServiceIconKey } from "../../types";

export interface ExternalServiceIconProps extends Omit<SvgIconProps, "children"> {
  iconKey: ExternalServiceIconKey;
}

export default function ExternalServiceIcon({ iconKey, ...props }: ExternalServiceIconProps) {
  const marker = { "data-external-service-icon": iconKey };

  switch (iconKey) {
    case "apps":
      return <AppsOutlinedIcon {...props} {...marker} />;
    case "calendar":
      return <CalendarMonthOutlinedIcon {...props} {...marker} />;
    case "check":
      return <FactCheckOutlinedIcon {...props} {...marker} />;
    case "groups":
      return <GroupsOutlinedIcon {...props} {...marker} />;
    case "handshake":
      return <HandshakeOutlinedIcon {...props} {...marker} />;
    case "registration":
      return <HowToRegOutlinedIcon {...props} {...marker} />;
    case "book":
      return <MenuBookOutlinedIcon {...props} {...marker} />;
    case "school":
      return <SchoolOutlinedIcon {...props} {...marker} />;
    case "link":
    default:
      return <LinkOutlinedIcon {...props} {...marker} />;
  }
}
